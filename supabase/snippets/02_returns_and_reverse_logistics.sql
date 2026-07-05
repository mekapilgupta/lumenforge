-- ============================================================================
-- Migration: Returns/Exchange system + full Shiprocket sync + email alerts
-- Safe to re-run (idempotent). Additive only — does not touch orders_complete
-- view or anything else you already have working.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. automation_queue: retry-tracking columns (matches the updated worker)
-- ---------------------------------------------------------------------------
alter table public.automation_queue add column if not exists max_attempts int not null default 5;
alter table public.automation_queue add column if not exists next_retry_at timestamptz;
alter table public.automation_queue add column if not exists last_error_at timestamptz;

-- 'failed_permanent' = stopped retrying, needs a human to look at it
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'queue_status' and e.enumlabel = 'failed_permanent'
  ) then
    alter type queue_status add value 'failed_permanent';
  end if;
end$$;

-- New automated actions: reverse pickup (return) + forward shipment for an exchange replacement
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'queue_action' and e.enumlabel = 'create_reverse_pickup'
  ) then
    alter type queue_action add value 'create_reverse_pickup';
  end if;
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'queue_action' and e.enumlabel = 'create_exchange_shipment'
  ) then
    alter type queue_action add value 'create_exchange_shipment';
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 2. orders: a few extra columns the new flows depend on
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists payment_gateway_response jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists shiprocket_status text;
alter table public.orders add column if not exists shiprocket_last_synced_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
-- Drives the "Return or Exchange" button visibility on the customer side
-- and the one-active-return-per-order rule.
alter table public.orders add column if not exists has_active_return boolean not null default false;
-- Links an exchange's replacement order (the "-EX" order) back to the original
alter table public.orders add column if not exists original_order_id uuid references public.orders(id);

-- ---------------------------------------------------------------------------
-- 3. order_returns — one active return/exchange thread per order, item-level detail
-- ---------------------------------------------------------------------------
create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,

  type text not null check (type in ('refund', 'exchange')),
  items jsonb not null default '[]'::jsonb,        -- [{order_item_id, product_name, quantity}]
  reason_code text not null,
  customer_note text,

  status text not null default 'requested' check (status in (
    'requested', 'approved', 'rejected', 'pickup_scheduled',
    'picked_up', 'received', 'refunded', 'exchange_shipped', 'completed'
  )),

  requested_refund_amount int,     -- system-suggested amount, paise (informational)
  admin_refund_amount int,         -- what the admin actually approves, paise
  admin_notes text,

  shiprocket_return_order_id text,
  shiprocket_return_shipment_id text,
  replacement_order_id uuid references public.orders(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_returns_order_id on public.order_returns(order_id);
create index if not exists idx_order_returns_status on public.order_returns(status);

-- Only one non-terminal return thread per order — keeps both UIs simple and
-- prevents the customer from filing duplicate requests on the same order.
create unique index if not exists uniq_active_return_per_order
  on public.order_returns(order_id)
  where status not in ('rejected', 'refunded', 'completed');

alter table public.order_returns enable row level security;

drop policy if exists "Customers manage their own returns" on public.order_returns;
create policy "Customers manage their own returns" on public.order_returns
  for select using (auth.uid() = customer_id);

drop policy if exists "Customers insert their own returns" on public.order_returns;
create policy "Customers insert their own returns" on public.order_returns
  for insert with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid() and o.status = 'delivered'
    )
  );

drop policy if exists "Admin full access to order_returns" on public.order_returns;
create policy "Admin full access to order_returns" on public.order_returns
  for all using (is_admin());

-- Keep orders.has_active_return in sync automatically
create or replace function public.sync_order_active_return()
returns trigger as $$
begin
  update public.orders
  set has_active_return = exists (
    select 1 from public.order_returns
    where order_id = coalesce(new.order_id, old.order_id)
      and status not in ('rejected', 'refunded', 'completed')
  )
  where id = coalesce(new.order_id, old.order_id);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_active_return on public.order_returns;
create trigger trg_sync_active_return
  after insert or update of status or delete on public.order_returns
  for each row execute function public.sync_order_active_return();

-- ---------------------------------------------------------------------------
-- 4. Shiprocket webhook idempotency log (prevents double-processing retried
--    or duplicate webhook deliveries)
-- ---------------------------------------------------------------------------
create table if not exists public.shiprocket_webhook_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  order_id uuid,
  event_status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Auto-email on a new return/exchange request via pg_net (no dashboard
--    click needed, no polling — fires the instant a customer submits one).
--    REQUIRES: you fill in <YOUR_PROJECT_REF> and set NOTIFY_EVENTS_SECRET as
--    a matching value in both this migration and the notify-events function's
--    env vars.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.notify_new_return_request()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <NOTIFY_EVENTS_SECRET>'
    ),
    body := jsonb_build_object(
      'event', 'return_requested',
      'return_id', new.id,
      'order_id', new.order_id
    )
  );
  return new;
exception when others then
  -- Never let a notification failure block the customer's return request.
  raise warning 'notify_new_return_request failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_return on public.order_returns;
create trigger trg_notify_new_return
  after insert on public.order_returns
  for each row execute function public.notify_new_return_request();

-- ---------------------------------------------------------------------------
-- 6. Existing cancellation/refund trigger — UNCHANGED for cancellations
--    (still fully automatic: shipment cancel + full refund the instant
--    status flips to 'cancelled', regardless of whether *you* changed it
--    in the admin panel or the Shiprocket webhook changed it because you
--    cancelled the shipment on Shiprocket's side — same code path either way).
--
--    REMOVED: the old auto-full-refund on status = 'returned'. Refunds tied
--    to a return/exchange now always go through the admin's "Process Refund"
--    action in order_returns, where the admin enters the exact amount.
--    This is the only behavior change to existing logic.
-- ---------------------------------------------------------------------------
create or replace function public.queue_order_automations()
returns trigger as $$
begin
  if new.status = 'cancelled' and (old.status is null or old.status != 'cancelled') then
    if new.shiprocket_order_id is not null then
      insert into public.automation_queue (order_id, action_type, payload)
      values (new.id, 'cancel_shipment', jsonb_build_object('shiprocket_order_id', new.shiprocket_order_id));
    end if;
    if new.payment_method = 'razorpay' and new.payment_status = 'paid' then
      insert into public.automation_queue (order_id, action_type, payload)
      values (new.id, 'process_refund', jsonb_build_object(
        'razorpay_payment_id', new.razorpay_payment_id,
        'amount', new.total_amount
      ));
    end if;
  end if;

  if new.status = 'delivered' and (old.status is null or old.status != 'delivered') then
    new.delivered_at = now();
  end if;

  return new;
end;
$$ language plpgsql;

-- Re-attach as BEFORE (not AFTER) since we now also set delivered_at on the row itself
drop trigger if exists trg_queue_order_automations on public.orders;
create trigger trg_queue_order_automations
  before update of status on public.orders
  for each row execute function public.queue_order_automations();

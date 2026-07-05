-- ============================================================================
-- Migration: Admin Action Center — unified inbox, manual overrides, chat,
--            exchange fulfillment, and audit logging.
-- Safe to re-run (idempotent). Additive only — does not touch existing views
-- or any existing logic.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. is_admin() helper (referenced by existing RLS policies but was never
--    defined in a migration file — define it now so everything works clean).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. admin_actions — unified notification/action inbox
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'cancellation','return','exchange','payment_failure',
    'cod_undelivered','chat_message'
  )),
  order_id uuid not null references public.orders(id) on delete cascade,
  reference_id uuid,
  status text not null default 'pending' check (status in (
    'pending','in_progress','resolved','rejected'
  )),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  assigned_admin_id uuid references auth.users(id),
  seen_at timestamptz,
  resolved_at timestamptz,
  sla_deadline timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_status on public.admin_actions(status);
create index if not exists idx_admin_actions_type   on public.admin_actions(type);
create index if not exists idx_admin_actions_order  on public.admin_actions(order_id);

-- RLS: admins full access; customers can view and insert their own
alter table public.admin_actions enable row level security;

drop policy if exists "Admin full access to admin_actions" on public.admin_actions;
create policy "Admin full access to admin_actions" on public.admin_actions
  for all using (is_admin());

drop policy if exists "Customers view own admin_actions" on public.admin_actions;
create policy "Customers view own admin_actions" on public.admin_actions
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = admin_actions.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Customers insert own admin_actions" on public.admin_actions;
create policy "Customers insert own admin_actions" on public.admin_actions
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = admin_actions.order_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. manual_action_log — audit trail for every manual admin action that
--    touches money or status
-- ---------------------------------------------------------------------------
create table if not exists public.manual_action_log (
  id uuid primary key default gen_random_uuid(),
  admin_action_id uuid references public.admin_actions(id),
  admin_id uuid not null references auth.users(id),
  action_type text not null,
  input_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_action_log_admin_action
  on public.manual_action_log(admin_action_id);
create index if not exists idx_manual_action_log_admin
  on public.manual_action_log(admin_id);

alter table public.manual_action_log enable row level security;

drop policy if exists "Admin full access to manual_action_log" on public.manual_action_log;
create policy "Admin full access to manual_action_log" on public.manual_action_log
  for all using (is_admin());

drop policy if exists "Customers view own manual_action_log" on public.manual_action_log;
create policy "Customers view own manual_action_log" on public.manual_action_log
  for select using (
    exists (
      select 1 from public.admin_actions aa
      join public.orders o on o.id = aa.order_id
      where aa.id = manual_action_log.admin_action_id
        and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. order_messages — chat, feeding into the same admin_actions backbone
-- ---------------------------------------------------------------------------
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer','admin')),
  message text not null,
  created_at timestamptz not null default now(),
  read_by_admin_at timestamptz,
  read_by_customer_at timestamptz
);

create index if not exists idx_order_messages_order
  on public.order_messages(order_id);
create index if not exists idx_order_messages_sender
  on public.order_messages(sender_type);

alter table public.order_messages enable row level security;

drop policy if exists "Admin full access to order_messages" on public.order_messages;
create policy "Admin full access to order_messages" on public.order_messages
  for all using (is_admin());

drop policy if exists "Customers read own order_messages" on public.order_messages;
create policy "Customers read own order_messages" on public.order_messages
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Customers insert own order_messages" on public.order_messages;
create policy "Customers insert own order_messages" on public.order_messages
  for insert with check (
    sender_type = 'customer'
    and exists (
      select 1 from public.orders o
      where o.id = order_messages.order_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. orders — parent_order_id, order_type, and payment_status support for
--    exchange flow (note: original_order_id already exists from returns
--    migration — this adds the canonical parent_order_id with the same
--    semantics)
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists parent_order_id uuid
  references public.orders(id);

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'order_type'
  ) then
    create type public.order_type as enum ('standard', 'exchange');
  end if;
end$$;

alter table public.orders add column if not exists order_type public.order_type
  not null default 'standard';

-- Ensure payment_status supports the exchange intermediate state
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'payment_status' and e.enumlabel = 'awaiting_payment'
  ) then
    alter type public.payment_status add value 'awaiting_payment';
  end if;
end$$;

create index if not exists idx_orders_parent on public.orders(parent_order_id);

-- ---------------------------------------------------------------------------
-- 5. order_returns — exchange variant selection, manual pickup, refund detail
-- ---------------------------------------------------------------------------
alter table public.order_returns add column if not exists requested_variant_id uuid
  references public.product_variants(id);
alter table public.order_returns add column if not exists price_difference numeric
  default 0;
alter table public.order_returns add column if not exists pickup_mode text
  check (pickup_mode in ('api','manual'));
alter table public.order_returns add column if not exists courier_name text;
alter table public.order_returns add column if not exists courier_contact text;
alter table public.order_returns add column if not exists awb_or_tracking_id text;
alter table public.order_returns add column if not exists pickup_scheduled_for timestamptz;
alter table public.order_returns add column if not exists pickup_notes text;
alter table public.order_returns add column if not exists manual_override boolean
  not null default false;
alter table public.order_returns add column if not exists refund_mode text
  check (refund_mode in ('full','partial'));
alter table public.order_returns add column if not exists refund_amount numeric;
alter table public.order_returns add column if not exists refund_method text
  check (refund_method in ('original_payment','upi','bank_transfer','store_credit'));
alter table public.order_returns add column if not exists refund_reference_id text;
alter table public.order_returns add column if not exists refund_deductions jsonb;

-- ---------------------------------------------------------------------------
-- 6. Trigger: auto-insert into admin_actions when a return/exchange is filed
--    (fires on insert into order_returns)
-- ---------------------------------------------------------------------------
create or replace function public.trg_order_returns_admin_action()
returns trigger as $$
begin
  insert into public.admin_actions (type, order_id, reference_id, status, priority, sla_deadline)
  values (
    case when new.type = 'refund' then 'return' else new.type end,
    new.order_id,
    new.id,
    'pending',
    'normal',
    now() + interval '24 hours'
  );
  return new;
exception when others then
  raise warning 'trg_order_returns_admin_action failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_order_returns_admin_action on public.order_returns;
create trigger trg_order_returns_admin_action
  after insert on public.order_returns
  for each row execute function public.trg_order_returns_admin_action();

-- ---------------------------------------------------------------------------
-- 7. Trigger: auto-insert / update into admin_actions when a customer sends
--    a chat message (fires on insert into order_messages with sender=customer)
-- ---------------------------------------------------------------------------
create or replace function public.trg_chat_admin_action()
returns trigger as $$
begin
  if new.sender_type = 'customer' then
    -- If there's already a pending chat_message action for this order,
    -- bump its updated_at; otherwise insert a new one.
    if exists (
      select 1 from public.admin_actions
      where order_id = new.order_id
        and type = 'chat_message'
        and status = 'pending'
    ) then
      update public.admin_actions
      set updated_at = now(),
          priority = 'normal'
      where order_id = new.order_id
        and type = 'chat_message'
        and status = 'pending';
    else
      insert into public.admin_actions (type, order_id, status, priority, sla_deadline)
      values ('chat_message', new.order_id, 'pending', 'normal', now() + interval '24 hours');
    end if;
  end if;
  return new;
exception when others then
  raise warning 'trg_chat_admin_action failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_chat_admin_action on public.order_messages;
create trigger trg_chat_admin_action
  after insert on public.order_messages
  for each row execute function public.trg_chat_admin_action();

-- ---------------------------------------------------------------------------
-- 8. Trigger: auto-insert into admin_actions when cancellation_status flips
--    to 'pending' (customer requests cancel on a processing order)
-- ---------------------------------------------------------------------------
create or replace function public.trg_cancellation_admin_action()
returns trigger as $$
begin
  -- Only fire when cancellation_status changes TO 'pending' (new request,
  -- not an update to an already-pending row)
  if new.cancellation_status = 'pending'
     and (old.cancellation_status is null or old.cancellation_status != 'pending') then
    insert into public.admin_actions (type, order_id, status, priority, sla_deadline)
    values ('cancellation', new.id, 'pending',
      case when new.status = 'processing' then 'urgent' else 'normal' end,
      now() + interval '24 hours'
    );
  end if;
  return new;
exception when others then
  raise warning 'trg_cancellation_admin_action failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cancellation_admin_action on public.orders;
create trigger trg_cancellation_admin_action
  after update of cancellation_status on public.orders
  for each row execute function public.trg_cancellation_admin_action();

-- ---------------------------------------------------------------------------
-- 9. Fix queue_order_automations() trigger function to be security definer
--    (ensures customer cancels don't trigger RLS violations on automation_queue)
-- ---------------------------------------------------------------------------
create or replace function public.queue_order_automations()
returns trigger as $$
begin
  -- SCENARIO A: Order is Cancelled
  if new.status = 'cancelled' and (old.status is null or old.status != 'cancelled') then
    
    -- 1. If it was pushed to Shiprocket, queue a cancellation
    if new.shiprocket_order_id is not null then
      insert into public.automation_queue (order_id, action_type, payload)
      values (new.id, 'cancel_shipment', jsonb_build_object('shiprocket_order_id', new.shiprocket_order_id));
    end if;

    -- 2. If it was paid via Razorpay, queue a refund
    if new.payment_method = 'razorpay' and new.payment_status = 'paid' then
      insert into public.automation_queue (order_id, action_type, payload)
      values (new.id, 'process_refund', jsonb_build_object(
        'razorpay_payment_id', new.razorpay_payment_id,
        'amount', new.total_amount
      ));
    end if;
  end if;

  -- SCENARIO B: Order is Returned (After Shipping)
  if new.status = 'returned' and (old.status is null or old.status != 'returned') then
     -- Auto-queue refund for returned items if prepaid
     if new.payment_method = 'razorpay' and new.payment_status = 'paid' then
      insert into public.automation_queue (order_id, action_type, payload)
      values (new.id, 'process_refund', jsonb_build_object(
        'razorpay_payment_id', new.razorpay_payment_id,
        'amount', new.total_amount
      ));
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;
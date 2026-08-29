-- 1. Drop existing trigger if it exists (for re-runnability)
drop trigger if exists trg_queue_order_automations on public.orders;

-- 2. Create the Queue Status and Actions if they do not exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_status') then
    create type queue_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'queue_action') then
    create type queue_action as enum ('create_shipment', 'cancel_shipment', 'process_refund', 'send_cancellation_email');
  else
    alter type queue_action add value if not exists 'send_cancellation_email';
  end if;
end$$;

-- 3. Create the Queue Table
create table if not exists public.automation_queue (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  action_type queue_action not null,
  status queue_status default 'pending' not null,
  payload jsonb default '{}'::jsonb,
  error_log text,
  attempts integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS (Admin only)
alter table public.automation_queue enable row level security;

-- Drop policy if it exists and recreate it
drop policy if exists "Admin full access to queue" on public.automation_queue;
create policy "Admin full access to queue" on public.automation_queue for all using (is_admin());

-- 4. The Magic Trigger: Auto-Queue Tasks on Order Status Change
-- SECURITY DEFINER: runs as DB owner, bypasses RLS so customers cancelling
--                   orders can insert into automation_queue without admin rights.
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

    -- 3. Queue cancellation email to the customer
    insert into public.automation_queue (order_id, action_type, payload)
    values (new.id, 'send_cancellation_email', jsonb_build_object('order_id', new.id));
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

create trigger trg_queue_order_automations
  after update of status on public.orders
  for each row execute function public.queue_order_automations();

-- 5. Immediate Queue Worker Invocation via pg_net
create extension if not exists pg_net;

create or replace function public.trigger_queue_worker()
returns trigger as $$
begin
  return public.invoke_queue_worker_on_insert();
end;
$$ language plpgsql security definer;

create or replace function public.invoke_queue_worker_on_insert()
returns trigger as $$
begin
  if new.status = 'pending' then
    perform net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/queue-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object(
        'task_id', new.id,
        'action_type', new.action_type
      )
    );
  end if;
  return new;
exception when others then
  -- Failures in trigger call will degrade gracefully to polling worker
  raise warning 'invoke_queue_worker_on_insert failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_invoke_queue_worker on public.automation_queue;
create trigger trg_invoke_queue_worker
  after insert on public.automation_queue
  for each row execute function public.invoke_queue_worker_on_insert();


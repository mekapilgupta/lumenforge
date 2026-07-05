-- 1. Drop existing trigger if it exists (for re-runnability)
drop trigger if exists trg_queue_order_automations on public.orders;

-- 2. Create the Queue Status and Actions if they do not exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_status') then
    create type queue_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'queue_action') then
    create type queue_action as enum ('create_shipment', 'cancel_shipment', 'process_refund');
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
$$ language plpgsql;

create trigger trg_queue_order_automations
  after update of status on public.orders
  for each row execute function public.queue_order_automations();

-- Migration: Add advance_amount and cod_balance_due to orders table and support partial_paid status

alter table public.orders add column if not exists advance_amount bigint default 0;
alter table public.orders add column if not exists cod_balance_due bigint default 0;

-- Ensure payment_status supports partial_paid and paid_advance
do $$
begin
  if exists (select 1 from pg_type where typname = 'payment_status') then
    if not exists (
      select 1 from pg_enum e
      join pg_type t on e.enumtypid = t.oid
      where t.typname = 'payment_status' and e.enumlabel = 'partial_paid'
    ) then
      alter type public.payment_status add value 'partial_paid';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on e.enumtypid = t.oid
      where t.typname = 'payment_status' and e.enumlabel = 'paid_advance'
    ) then
      alter type public.payment_status add value 'paid_advance';
    end if;
  end if;
end$$;

-- Fix COD orders whose payment_status was wrongly set to 'paid' by an older
-- razorpay-verify deployment, while amounts show balance still due.
-- Amounts (advance_amount / cod_balance_due) are the source of truth.

-- 1. One-off repair for known affected order
update public.orders
set payment_status = 'partial_paid', updated_at = now()
where order_number = 'FT2610051270'
  and payment_method = 'cod'
  and coalesce(cod_balance_due, 0) > 0
  and coalesce(advance_amount, 0) < coalesce(total_amount, 0);

-- 2. Global heal: any COD order marked 'paid' but with balance due and advance < total
update public.orders
set payment_status = 'partial_paid', updated_at = now()
where payment_method = 'cod'
  and payment_status = 'paid'
  and coalesce(cod_balance_due, 0) > 0
  and coalesce(advance_amount, 0) < coalesce(total_amount, 0);

-- 3. Guard rail (optional but recommended): prevent future bad writes at the DB level.
--    Create or replace a trigger that normalizes COD payment_status on insert/update.
create or replace function public.fn_normalize_cod_payment_status()
returns trigger as $$
begin
  if new.payment_method = 'cod' then
    if coalesce(new.cod_balance_due, 0) > 0 and coalesce(new.advance_amount, 0) < coalesce(new.total_amount, 0) then
      -- balance outstanding: cannot be 'paid'
      if new.payment_status = 'paid' then
        new.payment_status = 'partial_paid';
      end if;
    elsif coalesce(new.cod_balance_due, 0) = 0 and coalesce(new.advance_amount, 0) >= coalesce(new.total_amount, 0) then
      -- nothing due: it is fully paid
      new.payment_status = 'paid';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_normalize_cod_payment_status on public.orders;
create trigger trg_normalize_cod_payment_status
before insert or update on public.orders
for each row execute function public.fn_normalize_cod_payment_status();

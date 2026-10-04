-- ============================================================================
-- Migration: Cart variant/size management fix
-- Problem: cart rows keyed only by (user_id, product_id, variant_id) with no
--          size stored — different sizes/colors clubbed into one cart line.
-- Safe to re-run (idempotent).
-- ============================================================================

-- 1. Add size column to cart
alter table public.cart
  add column if not exists size text;

-- 2. Normalize existing rows' size (fall back to variant size or 38)
update public.cart c
set size = v.size
from public.product_variants v
where c.variant_id = v.id
  and (c.size is null or c.size = '');

update public.cart set size = '38' where size is null or size = '';

-- 3. Backfill variant_id for legacy rows that have none (best-effort by color, if color column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cart' and column_name = 'color'
  ) then
    update public.cart c
    set variant_id = (
      select v.id
      from public.product_variants v
      where v.product_id = c.product_id
        and lower(trim(v.color)) = lower(trim(c.color))
      limit 1
    )
    where c.variant_id is null;
  end if;
end $$;

-- 4. Dedupe: keep one row per (user_id, product_id, variant_id, size)
delete from public.cart c
using public.cart c2
where c.user_id = c2.user_id
  and c.product_id = c2.product_id
  and coalesce(c.variant_id::text, 'none') = coalesce(c2.variant_id::text, 'none')
  and coalesce(c.size, '38') = coalesce(c2.size, '38')
  and c.id > c2.id;

-- 5. Unique constraint so different sizes/colors can never merge again
create unique index if not exists uq_cart_user_product_variant_size
  on public.cart (user_id, product_id, coalesce(variant_id::text, 'none'), coalesce(size, '38'));

-- 6. Helpful lookup index
create index if not exists idx_cart_user_id on public.cart(user_id);

-- 7. Reload schema cache
notify pgrst, 'reload schema';

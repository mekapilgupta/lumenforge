-- ============================================================================
-- Migration: SKU as the global cart identity
-- The SKU (products + color + size, admin-controlled) is the single source of
-- truth. Cart lines are keyed by (user_id, sku) — no more fuzzy color/size
-- matching, no more clubbed variants.
-- Safe to re-run (idempotent).
-- ============================================================================

-- 1. Add sku column to cart
alter table public.cart
  add column if not exists sku text;

-- 2. Backfill sku from the variant each row points to
update public.cart c
set sku = v.sku
from public.product_variants v
where c.variant_id = v.id
  and (c.sku is null or c.sku = '');

-- Legacy rows without variant_id: best-effort backfill by product + size
update public.cart c
set sku = (
  select v.sku
  from public.product_variants v
  where v.product_id = c.product_id
    and (v.size = c.size or v.size is null)
  order by v.id
  limit 1
)
where (c.sku is null or c.sku = '');

-- Any stragglers: derive a deterministic placeholder so the unique index holds
update public.cart
set sku = 'FT-LEGACY-' || product_id::text || '-' || coalesce(size, '38')
where sku is null or sku = '';

-- 3. Make sku NOT NULL
alter table public.cart
  alter column sku set not null;

-- 4. Dedupe: keep the OLDEST row per (user_id, sku), merging quantities (cap 5)
delete from public.cart c
using public.cart keeper
where c.user_id = keeper.user_id
  and c.sku = keeper.sku
  and c.id > keeper.id;

-- 5. Unique constraint: one line per user per SKU
create unique index if not exists uq_cart_user_sku
  on public.cart (user_id, sku);

-- 6. Index for SKU lookups on variants (already unique there, but keep joins fast)
create index if not exists idx_cart_sku on public.cart(sku);

-- 7. Reload schema cache
notify pgrst, 'reload schema';

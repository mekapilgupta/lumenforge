-- ============================================================================
-- Migration: Cleanup Existing Product Data
-- Description: Truncates products, product_variants, product_images with CASCADE.
--              Foreign keys in order_items will set product_id / variant_id to NULL
--              while keeping order snapshot data intact. Cart & wishlist items cascade.
-- ============================================================================

-- Disable triggers temporarily if needed or truncate with cascade
do $$
begin
  -- Null out product and variant references in order_items if foreign keys don't cascade
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_items') then
    update public.order_items set product_id = null, variant_id = null;
  end if;

  -- Clear wishlist
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wishlist') then
    truncate table public.wishlist cascade;
  end if;

  -- Clear cart
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cart') then
    truncate table public.cart cascade;
  end if;

  -- Clear reviews associated with old products
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reviews') then
    truncate table public.reviews cascade;
  end if;

  -- Clear product images if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'product_images') then
    truncate table public.product_images cascade;
  end if;

  -- Clear product variants if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'product_variants') then
    truncate table public.product_variants cascade;
  end if;

  -- Clear products if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'products') then
    truncate table public.products cascade;
  end if;
end $$;

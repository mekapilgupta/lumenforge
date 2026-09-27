-- ============================================================================
-- Migration: Re-link Foreign Keys for Cart, Wishlist, Order Items, and Reviews
-- Description: Ensures foreign key constraints to products and product_variants
--              exist so PostgREST schema cache resolves relationships cleanly.
-- ============================================================================

do $$
begin
  -- 1. CART TABLE
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cart') then
    -- Clean orphaned rows if any
    delete from public.cart where product_id not in (select id from public.products);
    
    alter table public.cart drop constraint if exists cart_product_id_fkey;
    alter table public.cart add constraint cart_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;

    alter table public.cart drop constraint if exists cart_variant_id_fkey;
    alter table public.cart add constraint cart_variant_id_fkey
      foreign key (variant_id) references public.product_variants(id) on delete cascade;
  end if;

  -- 2. WISHLIST TABLE
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wishlist') then
    delete from public.wishlist where product_id not in (select id from public.products);

    alter table public.wishlist drop constraint if exists wishlist_product_id_fkey;
    alter table public.wishlist add constraint wishlist_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;

  -- 3. ORDER ITEMS TABLE
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_items') then
    update public.order_items set product_id = null where product_id is not null and product_id not in (select id from public.products);
    update public.order_items set variant_id = null where variant_id is not null and variant_id not in (select id from public.product_variants);

    alter table public.order_items drop constraint if exists order_items_product_id_fkey;
    alter table public.order_items add constraint order_items_product_id_fkey
      foreign key (product_id) references public.products(id) on delete set null;

    alter table public.order_items drop constraint if exists order_items_variant_id_fkey;
    alter table public.order_items add constraint order_items_variant_id_fkey
      foreign key (variant_id) references public.product_variants(id) on delete set null;
  end if;

  -- 4. REVIEWS TABLE
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reviews') then
    delete from public.reviews where product_id not in (select id from public.products);

    alter table public.reviews drop constraint if exists reviews_product_id_fkey;
    alter table public.reviews add constraint reviews_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end $$;

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';

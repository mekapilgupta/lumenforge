-- ============================================================================
-- Migration: Add sizes and size-wise variation support to products and variants
-- ============================================================================

-- 1. Add sizes column to public.products and size/color to product_variants
alter table public.products 
  add column if not exists sizes text[] default array['36', '37', '38', '39', '40', '41']::text[];

alter table public.product_variants 
  add column if not exists size text;

alter table public.product_variants 
  add column if not exists color text;

-- 2. Update Dynamic products_complete view
drop view if exists public.products_complete cascade;
create view public.products_complete as
select
  p.id,
  p.slug,
  p.name,
  coalesce(p.description, '') as description,
  coalesce(p.brand, 'French Toes') as brand,
  coalesce(p.category, 'Footwear') as category,
  p.base_price,
  (p.base_price * 100)::integer as price, -- in paise for legacy checkout compatibility
  p.compare_at_price,
  case 
    when p.compare_at_price is not null then (p.compare_at_price * 100)::integer 
    else null 
  end as original_price, -- in paise for legacy format
  p.status,
  (p.status = 'published') as is_active,
  false as is_best_seller,
  false as is_new_arrival,
  false as is_limited_edition,
  p.created_at,
  p.updated_at,
  
  -- Colors JSON array: [{ name, hex, slug, sku, image }]
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', v.color_name,
          'hex', coalesce(v.color_hex, '#f4a7c3'),
          'slug', v.color_slug,
          'sku', v.sku,
          'image', (
            select img.image_url
            from public.product_images img
            where img.variant_id = v.id
            order by img.is_primary desc, img.position asc
            limit 1
          )
        )
        order by v.position asc, v.created_at asc
      )
      from public.product_variants v
      where v.product_id = p.id
    ),
    '[]'::jsonb
  ) as colors,

  -- Flat images array
  coalesce(
    (
      select jsonb_agg(img.image_url order by v.position asc, img.position asc)
      from public.product_variants v
      join public.product_images img on img.variant_id = v.id
      where v.product_id = p.id
    ),
    '[]'::jsonb
  ) as images,

  -- Rich imageDetails
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'url', img.image_url,
          'alt', coalesce(img.alt_text, p.name),
          'order', img.position,
          'color', v.color_name,
          'is_primary', img.is_primary
        )
        order by v.position asc, img.position asc
      )
      from public.product_variants v
      join public.product_images img on img.variant_id = v.id
      where v.product_id = p.id
    ),
    '[]'::jsonb
  ) as image_details,

  -- Sizes array from product record or default
  coalesce(p.sizes, array['36', '37', '38', '39', '40', '41']::text[]) as sizes,

  -- Total stock quantity
  coalesce(
    (
      select sum(v.stock_quantity)::integer
      from public.product_variants v
      where v.product_id = p.id
    ),
    0
  ) as stock_quantity,

  -- Variants full JSON array with attributes (size_stock), prices, images
  coalesce(
    (
      select jsonb_agg(
        row_to_json(v)::jsonb || jsonb_build_object(
          'images', (
            select coalesce(jsonb_agg(row_to_json(img) order by img.position asc, img.created_at asc), '[]'::jsonb)
            from public.product_images img
            where img.variant_id = v.id
          )
        )
        order by v.position asc, v.created_at asc
      )
      from public.product_variants v
      where v.product_id = p.id
    ),
    '[]'::jsonb
  ) as variants

from public.products p;

-- 3. Update save_complete_product RPC to accept and persist sizes & full variant attributes
create or replace function public.save_complete_product(
  p_product jsonb,
  p_variants jsonb,
  p_images jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_product_id uuid;
  v_variant_record jsonb;
  v_variant_id uuid;
  v_image_record jsonb;
  v_sizes text[];
  v_result jsonb;
begin
  -- Resolve Product ID
  if (p_product->>'id') is not null and (p_product->>'id') != '' then
    v_product_id := (p_product->>'id')::uuid;
  else
    v_product_id := gen_random_uuid();
  end if;

  -- Parse sizes array if provided in jsonb
  if (p_product->'sizes') is not null and jsonb_typeof(p_product->'sizes') = 'array' then
    select coalesce(array_agg(value), array['36', '37', '38', '39', '40', '41']::text[])
    into v_sizes
    from jsonb_array_elements_text(p_product->'sizes') as value;
  else
    v_sizes := array['36', '37', '38', '39', '40', '41']::text[];
  end if;

  -- Upsert Product
  insert into public.products (
    id,
    slug,
    name,
    description,
    brand,
    category,
    base_price,
    compare_at_price,
    sizes,
    status
  ) values (
    v_product_id,
    p_product->>'slug',
    p_product->>'name',
    p_product->>'description',
    p_product->>'brand',
    p_product->>'category',
    (p_product->>'base_price')::numeric,
    case when (p_product->>'compare_at_price') is not null and (p_product->>'compare_at_price') != '' 
      then (p_product->>'compare_at_price')::numeric 
      else null 
    end,
    v_sizes,
    coalesce(p_product->>'status', 'draft')
  )
  on conflict (id) do update set
    slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    brand = excluded.brand,
    category = excluded.category,
    base_price = excluded.base_price,
    compare_at_price = excluded.compare_at_price,
    sizes = excluded.sizes,
    status = excluded.status,
    updated_at = now();

  -- Process Variants
  for v_variant_record in select * from jsonb_array_elements(p_variants) loop
    if (v_variant_record->>'id') is not null and (v_variant_record->>'id') != '' then
      v_variant_id := (v_variant_record->>'id')::uuid;
    else
      v_variant_id := gen_random_uuid();
    end if;

    insert into public.product_variants (
      id,
      product_id,
      sku,
      color_name,
      color_slug,
      color_hex,
      color,
      size,
      attributes,
      price_override,
      compare_at_price,
      stock_quantity,
      is_default,
      position
    ) values (
      v_variant_id,
      v_product_id,
      v_variant_record->>'sku',
      v_variant_record->>'color_name',
      v_variant_record->>'color_slug',
      v_variant_record->>'color_hex',
      coalesce(v_variant_record->>'color_name', v_variant_record->>'color'),
      v_variant_record->>'size',
      coalesce(v_variant_record->'attributes', '{}'::jsonb),
      case when (v_variant_record->>'price_override') is not null and (v_variant_record->>'price_override') != ''
        then (v_variant_record->>'price_override')::numeric
        else null
      end,
      case when (v_variant_record->>'compare_at_price') is not null and (v_variant_record->>'compare_at_price') != ''
        then (v_variant_record->>'compare_at_price')::numeric
        else null
      end,
      coalesce((v_variant_record->>'stock_quantity')::int, 0),
      coalesce((v_variant_record->>'is_default')::boolean, false),
      coalesce((v_variant_record->>'position')::int, 0)
    )
    on conflict (id) do update set
      sku = excluded.sku,
      color_name = excluded.color_name,
      color_slug = excluded.color_slug,
      color_hex = excluded.color_hex,
      color = excluded.color,
      size = excluded.size,
      attributes = excluded.attributes,
      price_override = excluded.price_override,
      compare_at_price = excluded.compare_at_price,
      stock_quantity = excluded.stock_quantity,
      is_default = excluded.is_default,
      position = excluded.position;
  end loop;

  -- Process Images if provided in RPC call
  if p_images is not null and jsonb_array_length(p_images) > 0 then
    for v_image_record in select * from jsonb_array_elements(p_images) loop
      insert into public.product_images (
        id,
        variant_id,
        imagekit_file_id,
        image_url,
        file_name,
        alt_text,
        position,
        is_primary
      ) values (
        coalesce((v_image_record->>'id')::uuid, gen_random_uuid()),
        (v_image_record->>'variant_id')::uuid,
        v_image_record->>'imagekit_file_id',
        v_image_record->>'image_url',
        v_image_record->>'file_name',
        v_image_record->>'alt_text',
        coalesce((v_image_record->>'position')::int, 0),
        coalesce((v_image_record->>'is_primary')::boolean, false)
      )
      on conflict (id) do update set
        alt_text = excluded.alt_text,
        position = excluded.position,
        is_primary = excluded.is_primary;
    end loop;
  end if;

  -- Build return payload
  select jsonb_build_object(
    'product', (select row_to_json(p) from public.products p where p.id = v_product_id),
    'variants', (
      select jsonb_agg(
        row_to_json(v)::jsonb || jsonb_build_object(
          'images', (
            select coalesce(jsonb_agg(row_to_json(img) order by img.position asc, img.created_at asc), '[]'::jsonb)
            from public.product_images img
            where img.variant_id = v.id
          )
        )
        order by v.position asc, v.created_at asc
      )
      from public.product_variants v
      where v.product_id = v_product_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Reload schema cache
notify pgrst, 'reload schema';

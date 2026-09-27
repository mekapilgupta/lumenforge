import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, url }) => {
  const { slug } = params;
  const colorParam = url.searchParams.get('color');

  // Fetch product + all variants + all images in ONE query
  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      variants:product_variants(
        *,
        images:product_images(*)
      )
    `)
    .eq('slug', slug)
    .single();

  if (prodErr || !product) {
    console.error(`[Product Page] Product not found for slug "${slug}":`, prodErr?.message);
    throw error(404, `Product "${slug}" was not found.`);
  }

  // Sort variants and images by position
  const variants = (product.variants || [])
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((v: any) => ({
      ...v,
      images: (v.images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    }));

  // Determine initially selected variant from ?color= param, fallback to is_default = true
  let selectedVariant = null;
  if (colorParam) {
    const cleanParam = decodeURIComponent(colorParam).toLowerCase().trim();
    selectedVariant = variants.find(
      (v: any) => v.color_slug === cleanParam || v.color_name.toLowerCase() === cleanParam
    );
  }

  if (!selectedVariant) {
    selectedVariant = variants.find((v: any) => v.is_default) || variants[0] || null;
  }

  // Related products query (other products in same category or published)
  const { data: relatedData } = await supabaseAdmin
    .from('products')
    .select(`
      id, slug, name, brand, category, base_price,
      variants:product_variants(
        id, color_name, color_slug, color_hex, is_default,
        images:product_images(image_url, is_primary)
      )
    `)
    .eq('status', 'published')
    .neq('slug', slug)
    .limit(4);

  return {
    product: {
      ...product,
      variants
    },
    initialSelectedVariantId: selectedVariant?.id || null,
    initialColorSlug: selectedVariant?.color_slug || null,
    relatedProducts: relatedData || []
  };
};

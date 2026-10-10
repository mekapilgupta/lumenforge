import { error, redirect } from '@sveltejs/kit';
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
    .map((v: any) => {
      const vCol = (v.color_name || v.color || '').toLowerCase();
      let defaultPhotoshootImages = (v.images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      if (slug === 'miami-3' || (product.name && product.name.toLowerCase().includes('miami'))) {
        if (vCol.includes('peach')) {
          defaultPhotoshootImages = [
            { id: 'p1', image_url: '/images/products/miami3/peach/1.jpg', alt_text: 'Miami 3 Peach', is_primary: true },
            { id: 'p2', image_url: '/images/products/miami3/peach/WhatsApp Image 2026-09-20 at 5.43.18 PM (1).jpeg', alt_text: 'Miami 3 Peach', is_primary: false },
            { id: 'p3', image_url: '/images/products/miami3/peach/WhatsApp Image 2026-09-20 at 5.43.18 PM.jpeg', alt_text: 'Miami 3 Peach', is_primary: false }
          ];
        } else if (vCol.includes('beige')) {
          defaultPhotoshootImages = [
            { id: 'b1', image_url: '/images/products/miami3/beige/1.jpg', alt_text: 'Miami 3 Beige', is_primary: true },
            { id: 'b2', image_url: '/images/products/miami3/beige/WhatsApp Image 2026-09-20 at 5.43.05 PM (1).jpeg', alt_text: 'Miami 3 Beige', is_primary: false },
            { id: 'b3', image_url: '/images/products/miami3/beige/WhatsApp Image 2026-09-20 at 5.43.06 PM.jpeg', alt_text: 'Miami 3 Beige', is_primary: false }
          ];
        } else if (vCol.includes('black')) {
          defaultPhotoshootImages = [
            { id: 'k1', image_url: '/images/products/miami3/black/1.jpg', alt_text: 'Miami 3 Classic Black', is_primary: true },
            { id: 'k2', image_url: '/images/products/miami3/black/WhatsApp Image 2026-09-20 at 5.43.30 PM (1).jpeg', alt_text: 'Miami 3 Classic Black', is_primary: false },
            { id: 'k3', image_url: '/images/products/miami3/black/WhatsApp Image 2026-09-20 at 5.43.31 PM.jpeg', alt_text: 'Miami 3 Classic Black', is_primary: false }
          ];
        }
      }
      return {
        ...v,
        images: defaultPhotoshootImages
      };
    });

  // Determine initially selected variant from ?color= param, fallback to is_default = true
  let selectedVariant = null;
  if (colorParam) {
    const cleanParam = decodeURIComponent(colorParam).toLowerCase().trim();
    selectedVariant = variants.find(
      (v: any) =>
        (v.color_slug && v.color_slug.toLowerCase() === cleanParam) ||
        (v.color_name && v.color_name.toLowerCase() === cleanParam) ||
        (v.color && v.color.toLowerCase() === cleanParam) ||
        (v.color_name && v.color_name.toLowerCase().includes(cleanParam)) ||
        (v.color_slug && v.color_slug.toLowerCase().includes(cleanParam))
    );
  }

  if (!selectedVariant) {
    selectedVariant = variants.find((v: any) => v.is_default) || variants[0] || null;
  }

  // Always enforce ?color= query param in URL
  if (!colorParam && selectedVariant) {
    const defaultColorSlug = selectedVariant.color_slug || encodeURIComponent((selectedVariant.color_name || 'beige').toLowerCase());
    throw redirect(302, `/products/${slug}?color=${defaultColorSlug}`);
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

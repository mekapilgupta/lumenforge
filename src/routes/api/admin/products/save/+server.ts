export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { product, variants, images = [] } = body;

    if (!product || !product.name || !product.slug || product.base_price === undefined) {
      return json({ success: false, error: 'Product name, slug, and base price are required.' }, { status: 400 });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return json({ success: false, error: 'At least one color variant is required.' }, { status: 400 });
    }

    // Validate default variant
    const defaultVariants = variants.filter(v => v.is_default);
    if (defaultVariants.length === 0) {
      // Auto-assign first as default
      variants[0].is_default = true;
    } else if (defaultVariants.length > 1) {
      return json({ success: false, error: 'Only one variant can be marked as default.' }, { status: 400 });
    }

    // Validate SKUs uniqueness and completeness
    const skuSet = new Set<string>();
    for (const v of variants) {
      if (!v.sku || !v.sku.trim()) {
        return json({ success: false, error: `SKU is missing for variant "${v.color_name || 'unnamed'}".` }, { status: 400 });
      }
      const upperSku = v.sku.trim().toUpperCase();
      if (skuSet.has(upperSku)) {
        return json({ success: false, error: `Duplicate SKU "${upperSku}" found. SKUs must be unique.` }, { status: 400 });
      }
      skuSet.add(upperSku);
      v.sku = upperSku;
      v.color_slug = slugify(v.color_name || 'color');
    }

    // Clean product payload
    const sizesArray = Array.isArray(product.sizes) && product.sizes.length > 0 
      ? product.sizes.map(String) 
      : ['36', '37', '38', '39', '40', '41'];

    const productPayload = {
      id: product.id || undefined,
      name: product.name.trim(),
      slug: slugify(product.slug),
      description: product.description || '',
      brand: product.brand || 'French Toes',
      category: product.category || 'Footwear',
      base_price: Number(product.base_price),
      compare_at_price: product.compare_at_price !== null && product.compare_at_price !== undefined && product.compare_at_price !== '' ? Number(product.compare_at_price) : null,
      sizes: sizesArray,
      status: product.status || 'draft'
    };

    // Format variants payload
    const variantsPayload = variants.map((v, index) => ({
      id: v.id || undefined,
      sku: v.sku.trim(),
      color_name: v.color_name.trim(),
      color_slug: slugify(v.color_name),
      color_hex: v.color_hex || '#000000',
      attributes: v.attributes || {},
      price_override: v.price_override !== null && v.price_override !== undefined && v.price_override !== '' ? Number(v.price_override) : null,
      compare_at_price: v.compare_at_price !== null && v.compare_at_price !== undefined && v.compare_at_price !== '' ? Number(v.compare_at_price) : null,
      stock_quantity: Number(v.stock_quantity || 0),
      is_default: Boolean(v.is_default),
      position: v.position !== undefined ? Number(v.position) : index
    }));

    // If publishing, check image count validation
    if (productPayload.status === 'published') {
      for (const v of variantsPayload) {
        if (v.id) {
          const { count } = await supabaseAdmin
            .from('product_images')
            .select('id', { count: 'exact' })
            .eq('variant_id', v.id);

          const totalImages = (count ?? 0) + images.filter((img: any) => img.variant_id === v.id).length;
          if (totalImages === 0) {
            return json({
              success: false,
              error: `Variant "${v.color_name}" must have at least one image before publishing.`
            }, { status: 400 });
          }
        }
      }
    }

    // Try executing atomic Supabase RPC if available
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('save_complete_product', {
      p_product: productPayload,
      p_variants: variantsPayload,
      p_images: images
    });

    if (!rpcErr && rpcData) {
      return json({ success: true, ...rpcData });
    }

    // Fallback: Direct table operations
    console.warn('[Save Product] RPC error or unavailable, falling back to direct operations:', rpcErr?.message);

    // 1. Upsert product
    const { data: savedProduct, error: prodErr } = await supabaseAdmin
      .from('products')
      .upsert(productPayload)
      .select('*')
      .single();

    if (prodErr || !savedProduct) {
      return json({ success: false, error: 'Failed to save product: ' + prodErr?.message }, { status: 500 });
    }

    // 2. Upsert variants
    const variantInsertData = variantsPayload.map(v => ({
      ...v,
      product_id: savedProduct.id
    }));

    const { data: savedVariants, error: varErr } = await supabaseAdmin
      .from('product_variants')
      .upsert(variantInsertData)
      .select('*');

    if (varErr) {
      return json({ success: false, error: 'Failed to save variants: ' + varErr.message }, { status: 500 });
    }

    // 3. Upsert images if provided
    if (images.length > 0) {
      await supabaseAdmin
        .from('product_images')
        .upsert(images);
    }

    return json({
      success: true,
      product: savedProduct,
      variants: savedVariants
    });

  } catch (err: any) {
    console.error('[Save Product Exception]', err);
    return json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

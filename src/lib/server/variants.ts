import { supabaseAdmin } from '$lib/server/shiprocket';
import { canonicalizeSize } from '$lib/sizes';

/**
 * Generates a deterministic 8-digit unique SKU from product, color, and size.
 */
export function generate8DigitSku(productSlugOrId: string, colorName: string, size: string | number): string {
  const seed = `FT_${productSlugOrId}_${colorName}_${size}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash) % 90000000 + 10000000;
  return String(positive);
}

/**
 * Ensures product variants exist in product_variants table for all products in DB.
 * Generates an 8-digit unique SKU for every (Color x Size) combination.
 */
export async function ensureAllProductVariants(): Promise<{ total: number; inserted: number }> {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, colors, sizes');

  if (error || !products) {
    console.error('[Variants] Failed to fetch products:', error);
    return { total: 0, inserted: 0 };
  }

  // Fetch existing variants to avoid duplicates
  const { data: existingVariants } = await supabaseAdmin
    .from('product_variants')
    .select('id, product_id, size, color, color_name, sku');

  const existingSet = new Set(
    (existingVariants || []).map(v => `${v.product_id}_${String(v.size).trim()}_${String(v.color_name || v.color).trim().toLowerCase()}`)
  );
  const usedSkus = new Set((existingVariants || []).map(v => v.sku).filter(Boolean));

  const variantsToInsert: any[] = [];

  for (const p of products) {
    const colors = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : [{ name: 'Default', hex: '#f4a7c3' }];
    const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['36', '37', '38', '39', '40', '41'];

    let pos = 0;
    for (const color of colors) {
      const colorName = color.name || 'Default';
      for (const size of sizes) {
        const key = `${p.id}_${String(size).trim()}_${colorName.trim().toLowerCase()}`;
        if (!existingSet.has(key)) {
          let sku = generate8DigitSku(p.slug || p.id, colorName, size);
          while (usedSkus.has(sku)) {
            sku = String(Number(sku) + 1);
          }
          usedSkus.add(sku);

          variantsToInsert.push({
            product_id: p.id,
            sku,
            size: String(size),
            color: colorName,
            color_name: colorName,
            color_hex: color.hex || '#000000',
            color_slug: color.slug || colorName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            stock_quantity: 15,
            price_override: null,
            is_default: false,
            position: pos++
          });
          existingSet.add(key);
        }
      }
    }
  }

  if (variantsToInsert.length === 0) {
    console.log('[Variants] All product variants already exist in database.');
    return { total: products.length, inserted: 0 };
  }

  console.log(`[Variants] Inserting ${variantsToInsert.length} new product variants into database...`);
  const { error: insertErr } = await supabaseAdmin
    .from('product_variants')
    .insert(variantsToInsert);

  if (insertErr) {
    console.error('[Variants] Error inserting variants:', insertErr);
    throw insertErr;
  }

  console.log(`[Variants] Successfully created ${variantsToInsert.length} product variants!`);
  return { total: products.length, inserted: variantsToInsert.length };
}

/**
 * Resolve by SKU — the global identity. Returns variant id + sku + product id.
 */
export async function resolveSku(sku: string): Promise<{ variantId: string | null; sku: string; productId: string | null }> {
  const wanted = String(sku).trim();

  // 1. Exact SKU hit
  const { data: exact } = await supabaseAdmin
    .from('product_variants')
    .select('id, sku, product_id')
    .eq('sku', wanted)
    .limit(1);

  if (exact && exact.length > 0) {
    return { variantId: exact[0].id, sku: exact[0].sku, productId: exact[0].product_id };
  }

  return { variantId: null, sku: wanted, productId: null };
}

/**
 * Resolve (product, size, color) → variant id + canonical 8-digit SKU.
 * Strictly matches BOTH size AND color so different sizes NEVER club.
 */
export async function resolveVariantSku(productId: string, size: number | string, colorName: string): Promise<{ variantId: string | null; sku: string | null; productId: string }> {
  const colorStr = String(colorName || '').trim();
  const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  const { data: variants } = await supabaseAdmin
    .from('product_variants')
    .select('id, sku, size, color, color_name, stock_quantity')
    .eq('product_id', productId)
    .limit(500);

  const list = variants || [];
  const wantedSize = canonicalizeSize(size);

  const colorMatch = (v: any) => {
    const vColor = norm(v.color_name || v.color || '');
    const reqColor = norm(colorStr);
    return vColor === reqColor || vColor.startsWith(reqColor) || reqColor.startsWith(vColor);
  };

  const sizeMatch = (v: any) => canonicalizeSize(v.size ?? '') === wantedSize;

  // Strict match: BOTH size AND color must match
  const exactHit = list.find(v => sizeMatch(v) && colorMatch(v));
  if (exactHit) {
    return { variantId: exactHit.id, sku: exactHit.sku, productId };
  }

  // Size only match if color is unspecified/default
  const sizeOnlyHit = list.find(v => sizeMatch(v));
  if (sizeOnlyHit && (!colorStr || colorStr.toLowerCase() === 'default')) {
    return { variantId: sizeOnlyHit.id, sku: sizeOnlyHit.sku, productId };
  }

  // No variant row — generate unique 8-digit SKU and create row
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, slug, name')
    .eq('id', productId)
    .maybeSingle();

  const sku = generate8DigitSku(product?.slug || productId, colorStr, wantedSize);

  const { data: newVariant, error } = await supabaseAdmin
    .from('product_variants')
    .insert({
      product_id: productId,
      sku,
      size: String(wantedSize),
      color: colorStr || 'Default',
      color_name: colorStr || 'Default',
      color_hex: '#000000',
      color_slug: norm(colorStr || 'default'),
      stock_quantity: 15,
      price_override: null,
      is_default: false
    })
    .select('id, sku')
    .single();

  if (error) {
    console.warn('[Variants] Could not create on-the-fly variant:', error.message);
    return { variantId: null, sku, productId };
  }

  return { variantId: newVariant.id, sku: newVariant.sku, productId };
}

/**
 * Legacy helper kept for compatibility.
 */
export async function resolveVariantId(productId: string, size: number | string, colorName: string): Promise<string | null> {
  const res = await resolveVariantSku(productId, size, colorName);
  return res.variantId;
}

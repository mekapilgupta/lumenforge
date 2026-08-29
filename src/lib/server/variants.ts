import { supabaseAdmin } from '$lib/server/shiprocket';

/**
 * Ensures product variants exist in product_variants table for all products in DB.
 */
export async function ensureAllProductVariants(): Promise<{ total: number; inserted: number }> {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, name, sku, slug, colors, sizes, stock_quantity');

  if (error || !products) {
    console.error('[Variants] Failed to fetch products:', error);
    return { total: 0, inserted: 0 };
  }

  // Fetch existing variants to avoid duplicates
  const { data: existingVariants } = await supabaseAdmin
    .from('product_variants')
    .select('id, product_id, size, color');

  const existingSet = new Set(
    (existingVariants || []).map(v => `${v.product_id}_${String(v.size).trim()}_${String(v.color).trim().toLowerCase()}`)
  );

  const variantsToInsert: any[] = [];

  for (const p of products) {
    const colors = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : [{ name: 'Default', hex: '#f4a7c3' }];
    const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['4', '5', '6', '7', '8'];

    for (const color of colors) {
      const colorName = color.name || 'Default';
      for (const size of sizes) {
        const key = `${p.id}_${String(size).trim()}_${colorName.trim().toLowerCase()}`;
        if (!existingSet.has(key)) {
          const colorCode = colorName.substring(0, 3).toUpperCase();
          const sku = `${p.sku || 'FT'}-${colorCode}-${size}`;
          variantsToInsert.push({
            product_id: p.id,
            sku: sku,
            size: String(size),
            color: colorName,
            stock_quantity: p.stock_quantity || 100,
            price_adjustment: 0,
            is_active: true
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
 * Resolve or get variant ID for (productId, size, color)
 */
export async function resolveVariantId(productId: string, size: number | string, colorName: string): Promise<string | null> {
  const sizeStr = String(size).trim();
  const colorStr = String(colorName).trim();

  const { data: variant } = await supabaseAdmin
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('size', sizeStr)
    .ilike('color', colorStr)
    .maybeSingle();

  if (variant) return variant.id;

  // Create variant on the fly if missing
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('sku, stock_quantity')
    .eq('id', productId)
    .maybeSingle();

  const colorCode = colorStr.substring(0, 3).toUpperCase();
  const sku = `${product?.sku || 'FT'}-${colorCode}-${sizeStr}`;

  const { data: newVariant, error } = await supabaseAdmin
    .from('product_variants')
    .insert({
      product_id: productId,
      sku: sku,
      size: sizeStr,
      color: colorStr,
      stock_quantity: product?.stock_quantity || 100,
      price_adjustment: 0,
      is_active: true
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Variants] Could not create on-the-fly variant:', error.message);
    return null;
  }

  return newVariant?.id || null;
}

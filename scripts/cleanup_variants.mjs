import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envStr.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
}

const url = env.PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

function generate8DigitSku(productSlugOrId, colorName, size) {
  const seed = `FT_${productSlugOrId}_${colorName}_${size}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash) % 90000000 + 10000000;
  return String(positive);
}

// 1. Fetch products & variants
const { data: products } = await supabase.from('products').select('*');
const { data: variants } = await supabase.from('product_variants').select('*');

console.log("Total variants currently in DB:", variants.length);

// Handle any variants where size is null
for (const v of variants) {
  if (!v.size) {
    // If this is an old color-level variant, assign size '37' (or 36) if not already existing
    const existing37 = variants.find(other => other.product_id === v.product_id && other.color === v.color && other.size === '37');
    if (!existing37) {
      const p = products.find(prod => prod.id === v.product_id);
      const sku = generate8DigitSku(p?.slug || v.product_id, v.color_name || v.color, '37');
      const stock = v.attributes?.size_stock?.['37'] || 6;
      await supabase.from('product_variants').update({ size: '37', sku, stock_quantity: stock }).eq('id', v.id);
      console.log(`Updated null-size variant ${v.sku} -> size: 37, sku: ${sku}, stock: ${stock}`);
    } else {
      // Delete redundant legacy row
      await supabase.from('product_variants').delete().eq('id', v.id);
      console.log(`Deleted duplicate legacy null-size variant ${v.sku}`);
    }
  }
}

// Now list all variants per product
const { data: allVariants } = await supabase.from('product_variants').select('product_id, sku, color_name, size, stock_quantity');
console.log("\nALL UPDATED VARIANTS:");
for (const p of products) {
  const pVars = allVariants.filter(v => v.product_id === p.id);
  console.log(`\nProduct: ${p.name} (Total: ${pVars.length} SKUs)`);
  for (const v of pVars) {
    console.log(`  SKU: ${v.sku} | Color: ${v.color_name} | Size: ${v.size} | Stock: ${v.stock_quantity}`);
  }
}

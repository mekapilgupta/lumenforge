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

// 1. Fetch all products
const { data: products, error: pErr } = await supabase.from('products').select('*');
if (pErr || !products) {
  console.error("Products fetch error:", pErr);
  process.exit(1);
}

console.log(`Found ${products.length} products in database.`);

// 2. Fetch all existing variants
const { data: existingVariants } = await supabase.from('product_variants').select('*');
console.log(`Found ${existingVariants?.length || 0} existing variant rows.`);

const usedSkus = new Set((existingVariants || []).map(v => v.sku).filter(Boolean));

for (const p of products) {
  console.log(`\nProcessing product: ${p.name} (${p.slug})`);

  const prodColorVariants = (existingVariants || []).filter(v => v.product_id === p.id);
  
  let colors = [];
  if (prodColorVariants.length > 0) {
    const colorMap = new Map();
    for (const v of prodColorVariants) {
      const name = v.color_name || v.color || 'Default';
      if (!colorMap.has(name.toLowerCase())) {
        colorMap.set(name.toLowerCase(), {
          name,
          hex: v.color_hex || '#f4a7c3',
          slug: v.color_slug || 'default',
          size_stock: v.attributes?.size_stock || {}
        });
      }
    }
    colors = Array.from(colorMap.values());
  } else if (Array.isArray(p.colors) && p.colors.length > 0) {
    colors = p.colors;
  } else {
    colors = [{ name: 'Default', hex: '#f4a7c3', slug: 'default' }];
  }

  const sizes = Array.isArray(p.sizes) && p.sizes.length > 0
    ? p.sizes.map(String)
    : ['36', '37', '38', '39', '40', '41'];

  console.log(`  Colors (${colors.length}):`, colors.map(c => c.name));
  console.log(`  Sizes (${sizes.length}):`, sizes);

  let pos = 0;
  for (const color of colors) {
    const colorName = color.name || 'Default';
    for (const size of sizes) {
      // Check if exact variant for (product_id, color, size) already exists
      const existing = (existingVariants || []).find(v =>
        v.product_id === p.id &&
        (v.color_name || v.color || '').toLowerCase() === colorName.toLowerCase() &&
        String(v.size || '') === String(size)
      );

      if (existing) {
        // If it doesn't have an 8-digit SKU, generate one
        if (!existing.sku || existing.sku.length !== 8 || isNaN(Number(existing.sku))) {
          let newSku = generate8DigitSku(p.slug || p.id, colorName, size);
          while (usedSkus.has(newSku) && newSku !== existing.sku) {
            newSku = String(Number(newSku) + 1);
          }
          usedSkus.add(newSku);
          await supabase.from('product_variants').update({ sku: newSku }).eq('id', existing.id);
          console.log(`    Updated existing variant ${colorName} size ${size} -> SKU: ${newSku}`);
        }
        continue;
      }

      // Generate unique 8-digit SKU
      let sku = generate8DigitSku(p.slug || p.id, colorName, size);
      while (usedSkus.has(sku)) {
        sku = String(Number(sku) + 1);
      }
      usedSkus.add(sku);

      // Stock from color variant attributes.size_stock or default
      const stock = color.size_stock?.[size] ?? color.size_stock?.[String(size)] ?? 10;

      const newRow = {
        product_id: p.id,
        sku,
        size: String(size),
        color: colorName,
        color_name: colorName,
        color_hex: color.hex || '#000000',
        color_slug: color.slug || colorName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        stock_quantity: stock,
        price_override: null,
        is_default: pos === 0,
        position: pos++
      };

      const { data: inserted, error: insErr } = await supabase.from('product_variants').insert(newRow).select('id, sku').single();
      if (insErr) {
        console.error(`    Failed to insert ${colorName} size ${size}:`, insErr.message);
      } else {
        console.log(`    Created variant ${colorName} size ${size} -> SKU: ${inserted.sku} (Stock: ${stock})`);
      }
    }
  }
}

console.log("\nMigration completed!");

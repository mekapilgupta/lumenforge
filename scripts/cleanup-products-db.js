/**
 * Wipe all products, product_variants, product_images from Supabase DB.
 * Usage: node scripts/cleanup-products-db.js
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local if exists
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDatabaseProducts() {
  console.log('🧹 Starting Supabase Products Cleanup...');

  // 1. Check order_items table and nullify references if needed
  console.log('Checking order_items references...');
  try {
    const { error: orderItemsErr } = await supabase
      .from('order_items')
      .update({ product_id: null, variant_id: null })
      .not('product_id', 'is', null);
    if (orderItemsErr) console.warn('Note on order_items update:', orderItemsErr.message);
  } catch (e) {
    console.warn('order_items check note:', e.message);
  }

  // 2. Clear cart
  try {
    const { error: cartErr } = await supabase
      .from('cart')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (cartErr) console.warn('cart delete note:', cartErr.message);
    else console.log('Cart items cleared.');
  } catch (e) {
    console.warn('cart delete:', e.message);
  }

  // 3. Clear wishlist
  try {
    const { error: wishErr } = await supabase
      .from('wishlist')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (wishErr) console.warn('wishlist delete note:', wishErr.message);
    else console.log('Wishlist items cleared.');
  } catch (e) {
    console.warn('wishlist delete:', e.message);
  }

  // 4. Clear product images
  try {
    const { error: imgErr } = await supabase
      .from('product_images')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (imgErr) console.warn('product_images delete note:', imgErr.message);
    else console.log('Product images table cleared.');
  } catch (e) {
    console.warn('product_images delete:', e.message);
  }

  // 5. Clear product variants
  try {
    const { error: varErr } = await supabase
      .from('product_variants')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (varErr) console.warn('product_variants delete note:', varErr.message);
    else console.log('Product variants table cleared.');
  } catch (e) {
    console.warn('product_variants delete:', e.message);
  }

  // 6. Clear products
  try {
    const { error: prodErr } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (prodErr) console.warn('products delete note:', prodErr.message);
    else console.log('Products table cleared.');
  } catch (e) {
    console.warn('products delete:', e.message);
  }

  console.log('✅ Supabase Products Database Cleanup Complete!');
}

cleanDatabaseProducts().catch(err => {
  console.error('DB cleanup failed:', err);
  process.exit(1);
});

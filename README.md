# French Toes — E-Commerce Store

High-performance e-commerce platform built with **SvelteKit**, **Supabase (PostgreSQL)**, and **ImageKit** for real-time CDN image optimization.

---

## 🛍️ Product Data Architecture

The catalog uses a normalized 3-tier hierarchy: **Product → Color Variant → Images**.

```
products
  └── product_variants (Color variants with SKU & pricing)
        └── product_images (ImageKit assets per color)
```

### 1. Database Schema (`supabase/migrations/`)

#### `products` Table
- `id` (`uuid`, PK): Default `gen_random_uuid()`
- `slug` (`text`, Unique, Not Null): URL handle (e.g. `cloud-slippers`)
- `name` (`text`, Not Null): Title
- `description` (`text`): Detailed copy
- `brand` (`text`): Default `'French Toes'`
- `category` (`text`): e.g. `'Slippers'`, `'Flats'`, `'Heels'`
- `base_price` (`numeric(10,2)`, Not Null): Base price in INR
- `status` (`text`, Not Null): `'draft'` | `'published'` | `'archived'`
- `created_at` & `updated_at` (`timestamptz`)

#### `product_variants` Table
- `id` (`uuid`, PK): Default `gen_random_uuid()`
- `product_id` (`uuid`, FK → `products(id)` ON DELETE CASCADE)
- `sku` (`text`, Unique, Not Null): Unique variant SKU (e.g. `FT-CLOUD-BLUSH`)
- `color_name` (`text`, Not Null): e.g. `'Blush Pink'`
- `color_slug` (`text`, Not Null): Slugified color name (e.g. `'blush-pink'`)
- `color_hex` (`text`): Hex code for UI swatch picker (e.g. `'#f4a7c3'`)
- `attributes` (`jsonb`): Future-proof attributes (sizes, materials, tags)
- `price_override` (`numeric(10,2)`): Optional color-specific price
- `stock_quantity` (`int`): Quantity in stock
- `is_default` (`boolean`): Partial unique index ensures only **one** variant per product has `is_default = true`
- `position` (`int`): Display order

#### `product_images` Table
- `id` (`uuid`, PK): Default `gen_random_uuid()`
- `variant_id` (`uuid`, FK → `product_variants(id)` ON DELETE CASCADE)
- `imagekit_file_id` (`text`, Not Null): Unique ImageKit file identifier
- `image_url` (`text`, Not Null): Full HTTPS CDN image URL
- `file_name` (`text`, Not Null): Formatted filename
- `alt_text` (`text`): Accessibility and SEO description
- `position` (`int`): Sort order in thumbnail gallery
- `is_primary` (`boolean`): Primary hero photo for this color variant

---

## 🖼️ ImageKit Naming & Tagging Convention

All asset uploads must go through the server-side endpoint `/api/admin/products/upload-image` using the server private key.

### Folder Structure
```
/products/{product-slug}/{color-slug}/
```

### File Naming Convention
```
{product-slug}-{color-slug}-{sequence}.{ext}
```
*Example:* `/products/cloud-slippers/blush-pink/cloud-slippers-blush-pink-01.jpg`

### Mandatory ImageKit Tags
Every file uploaded attaches 4 key metadata tags:
- `product:{product_id}`
- `variant:{variant_id}`
- `color:{color-slug}`
- `slug:{product-slug}`

---

## ⚡ Storefront URL & Variant Switching

- **Route:** `/products/[slug]`
- **Query Parameter:** `?color={color-slug}` (e.g. `/products/cloud-slippers?color=blush-pink`)
- **SSR Hydration:** `+page.server.ts` fetches product + variants + images in a single join query.
- **Client-Side Switching:** Clicking a color swatch instantaneously swaps active images, price, SKU, and stock status without full page reload, and updates the URL via `goto(url, { replaceState: true, noScroll: true })`.
- **Dynamic Image CDN Transformations:**
  - Gallery Main Photo: `?tr=w-800,q-85`
  - Thumbnail Previews: `?tr=w-150,q-75`
  - Lightbox High-Res: `?tr=w-1400,q-95`

---

## 🛠️ Admin Management & Wizard Flow

- **Products List:** `/admin/products` — Filter by status, category, search, edit, archive, and delete.
- **Product Wizard:** `/admin/products/new` & `/admin/products/[id]/edit`
  1. **Step 1 — Product Info:** Title, auto-slug, brand, category, base price, status.
  2. **Step 2 — Variants:** Color name, hex picker + preset palette, SKU, stock quantity, price override, default variant toggle, duplicate variant action.
  3. **Step 3 — Images per Variant:** Tabbed variant selector, drag-and-drop multi-file upload, automatic server-side ImageKit sequencing/tagging, primary image designation, and drag-to-reorder thumbnails.
  4. **Step 4 — Review & Publish:** Interactive live storefront preview simulation, pre-flight checklist validation, and atomic commit to database.

---

## 🧹 Database & Media Cleanup Scripts

Before testing clean migrations:
```sh
# 1. Truncate database products & variants safely
node scripts/cleanup-products-db.js

# 2. Bulk delete old media under /products/ on ImageKit
node scripts/cleanup-imagekit.js
```

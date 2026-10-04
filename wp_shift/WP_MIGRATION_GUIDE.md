# 🌸 French Toes — WordPress / Woodmart + Elementor Migration Kit

All migration assets have been generated in the `wp_shift` folder.

---

## 📂 Folder Contents

```
wp_shift/
├── style.css                     # Master CSS (Woodmart Child Theme / Customizer)
├── header/
│   ├── header-block.html         # Announcement marquee + main header HTML block
│   └── header-styles.css         # Dedicated header styling
├── footer/
│   ├── footer-block.html         # Trust badges + 4-col footer + bottom copyright
│   └── footer-styles.css         # Dedicated footer styling
├── elementor/
│   ├── custom-widgets-css.css    # Reusable Elementor CSS classes (.lush-card, .ft-cpill, etc.)
│   └── color-palette-tokens.json # Exact color codes & typography tokens
├── images/                       # Ready-to-upload brand assets
│   ├── logo-bird-brand.png       # Primary navbar & footer brand logo
│   ├── logo-bird-original.png    # High-res master logo
│   ├── sales-banner-1.jpg        # Hero banner 1
│   ├── sales-banner-2.jpg        # Hero banner 2
│   ├── sales-banner-3.jpg        # Hero banner 3
│   ├── favicon.png               # Site icon
│   └── favicon.ico               # Favicon
└── WP_MIGRATION_GUIDE.md         # This migration guide
```

---

## 🎨 1. How to Apply `style.css` in WordPress / Woodmart

### Option A: Woodmart Child Theme (Recommended)
1. Install and activate the **Woodmart Child Theme**.
2. Replace or append the contents of `wp_shift/style.css` into `wp-content/themes/woodmart-child/style.css`.

### Option B: Theme Settings / Custom CSS
1. In WP Admin, navigate to **Woodmart → Theme Settings → Custom CSS**.
2. Paste the contents of `wp_shift/style.css` into the **Global Custom CSS** field.
3. Save changes.

---

## 🔝 2. Header Setup (Marquee + Navigation)

### In Woodmart Header Builder:
1. Go to **Woodmart → Header Builder**.
2. Edit your active header (or create a new one).
3. **Top Bar**:
   - Add an **HTML Block** element and paste the `<div class="ft-header-marquee-bar">...</div>` markup from `wp_shift/header/header-block.html`.
4. **Main Header**:
   - **Logo**: Upload `wp_shift/images/logo-bird-brand.png` in Woodmart Header Builder Logo element.
   - **Menu**: Assign your primary menu.
   - **Header Elements**: Enable Search (Full screen or dropdown), Wishlist, My Account, and Cart.

### In Elementor (Theme Builder Header):
1. Go to **Templates → Theme Builder → Header**.
2. Insert an **HTML Widget** and paste the entire content of `wp_shift/header/header-block.html`.
3. Add `wp_shift/header/header-styles.css` to Elementor Page Settings → Custom CSS.

---

## 🦶 3. Footer Setup (Trust Badges + Links + Newsletter)

### In Woodmart HTML Blocks:
1. Go to **HTML Blocks → Add New**.
2. Title it: `French Toes Custom Footer`.
3. Switch to **Text / Code editor** (or Elementor) and paste `wp_shift/footer/footer-block.html`.
4. Publish the HTML Block.
5. Go to **Woodmart → Theme Settings → Footer**.
6. Under **Footer content**, select **HTML Block** and choose `French Toes Custom Footer`.

---

## 🎯 4. Elementor Global Design Tokens

Set these under **Elementor → Site Settings → Global Colors & Fonts**:

### 🎨 Global Colors:
- **Brand Primary (Magenta)**: `#D81B60`
- **Accent Blush Deep**: `#f4a7c3`
- **Blush Light**: `#f9d5e5`
- **Peach**: `#ffdab9`
- **Mint Deep**: `#7ecba1`
- **Dark Text / Footer**: `#2d1b2e`
- **Mid Text**: `#6b4c6e`
- **Soft Text**: `#9e7ca0`
- **Warm White Background**: `#FAFAFA`
- **Cream Card Background**: `#fdf8f3`

### 🔤 Global Typography:
- **Headings (H1–H3)**: `Playfair Display` (Weight: 600 / 700)
- **Body / Buttons / Nav**: `Outfit` (Weight: 400 / 500 / 600)
- **Secondary**: `Inter`

---

## 🚀 5. Additional Things We Can Assist With

1. **WooCommerce Product Data Export (CSV)**:
   - We can extract all your existing products, categories, images, and sizes from Supabase into a ready-to-import **WooCommerce CSV** (WP Admin → Products → Import).
2. **Prepaid Discount & COD Logic**:
   - We can provide a lightweight PHP snippet for `functions.php` to automatically apply a **5% discount on prepaid orders (UPI/Card)** in WooCommerce checkout.
3. **Elementor Home Page Section Templates**:
   - We can create Elementor JSON templates for the Hero Slider, Category Carousel, "Shop by Color" section, and Reviews marquee.
4. **Order / Inventory Sync**:
   - If you want to sync WooCommerce orders with Shiprocket / NimbusPost / WhatsApp alerts, we can provide the webhook setups.

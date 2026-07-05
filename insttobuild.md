You are tasked with building the **French Toes – Women’s Slippers E-commerce MVP** as a production-ready SvelteKit application with Supabase backend. The Supabase schema, enums, triggers, RLS, views, and seed settings are already in place. An admin user (`kapilgupta@duck.com`) already exists with `role = 'admin'` in the `profiles` table.

### 🎯 Goal
Deliver a fully functional e-commerce site where customers can browse products, filter, add to cart (guest + logged-in), checkout with **Cash on Delivery (COD) only**, place orders (auto order-number via trigger), view orders/wishlist/profile in My Account, and where admins can manage orders and update statuses from `/admin` with real-time updates. No Razorpay, no Shiprocket, no Otpless — only Supabase Email/Password Auth.

### 🧰 Tech Stack (strict)
- **SvelteKit 2 + Svelte 5 (Runes)** (`$state`, `$derived`, `$effect`, etc.)
- **Tailwind CSS v4**
- **Supabase JS Client** (`@supabase/supabase-js`)
- **Static export / prerendering enabled** (adapter-static) so the site can be deployed to Netlify/Vercel/Cloudflare Pages/S3+CloudFront
- Environment variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`

### 🗄️ Database (use existing schema exactly)
You MUST integrate against these tables (and their fields, enums, triggers, RLS, views):
- `profiles` (user profile + role + stats + preferences; linked 1:1 to `auth.users`)
- `addresses` (shipping/billing; enforce single default via partial unique index + trigger)
- `categories`
- `products` (price/original_price in **paise**, GST/HSN, stock, images JSONB, SEO, rating_avg/rating_count, etc.)
- `product_variants` (size/color combinations, stock, price_adjustment)
- `orders` (COD-only checkout; amounts in paise; auto `order_number` via trigger; status/payment_status enums)
- `order_items` (snapshot of product/variant at time of order)
- `order_logs` (audit trail of status changes; created_by = auth.uid())
- `wishlist`, `cart`, `reviews`, `notifications`, `coupons`, `coupon_usage`, `shipping_zones`, `abandoned_carts`, `settings`
- Views: `user_profiles_complete`, `products_complete`, `orders_complete`, `sales_analytics`, `top_products`, `low_stock_products`

**Important constraints/automation (do not re-implement in app logic unless necessary):**
- `profiles` auto-created on `auth.users` insert (trigger)
- `orders.order_number` auto-generated (trigger)
- `products.sku` and `product_variants.sku` auto-generated (triggers)
- Stock decremented on order `confirmed`; restored on `cancelled` (trigger)
- Profile stats (total_orders, total_spent, loyalty_points, last_order_at) updated on `delivered` (trigger)
- Order status changes logged to `order_logs` (trigger)
- Product ratings updated on review insert/update (trigger)
- Coupon usage tracked (trigger)
- Notifications created on key order status changes (trigger)
- RLS is enabled everywhere — queries must run in the authenticated Supabase client context (or public read policies where appropriate)

### 🎨 Design Direction (must match)
- **Feminine, summer vibe**: blossom pastel theme (blush `#f4a7c3`, peach `#ffb347`, lavender `#c9a0dc`, mint `#7ecba1`, coral `#ff7f6e`, gold `#d4a853`, white `#f5f0eb`, nude `#d4a574`)
- Modern, clean, **mobile-first**, responsive
- Micro-interactions: hover lift, soft shadows, button press feedback, smooth transitions
- Accessible: semantic HTML, focus rings, sufficient contrast, ARIA where needed

### 🧩 Features to Implement (end-to-end, fully functional)

#### 1) Authentication (Supabase Email/Password only)
- Signup page (`/signup`): email + password (+ optional full_name). On signup, trigger creates `profiles` row (already handled). After signup, send user to `/account` or `/shop`.
- Login page (`/login`)
- Logout
- Protected routes: `/account/*`, `/checkout`, `/admin/*` (middleware/`load` guards)
- Persist session; handle `onAuthStateChange`
- Show user avatar/name in header when logged in

#### 2) Customer Experience
**Header / Layout**
- Responsive header with logo, nav (Home, Shop, Cart, Wishlist icon, Account/Login), search (basic name/slug search), and cart badge (count)
- Footer with links, policies, contact
- Global toast/notification system for success/error feedback

**Home (`/`)**
- Hero slider (use `LIFESTYLE_IMAGES.hero1/2/3`)
- Best Sellers section (query `products` where `is_best_seller = true` or use `getBestSellers()` logic)
- New Arrivals section
- Sale / Limited Edition highlights
- “Why Us” + testimonials (static is fine)
- Newsletter signup (stub OK; store in Supabase table optional)

**Shop / Product Listing (`/shop`)**
- Product grid (responsive)
- Filters (client + server-appropriate):
  - Color (from `products.colors` JSONB / available colors)
  - Size (from `products.sizes` / `product_variants.size`)
  - Price range slider (by `price` in paise; display in ₹)
  - Category filter (join `categories`)
  - Sort: price low-high, high-low, newest, best sellers, rating
- Pagination or infinite scroll (your choice; keep performant)
- Search by product name/slug (use `pg_trgm` index: `idx_products_name_search`)
- Each card: image, name, price (₹), original price (struck), badges, rating stars + count, “Add to Cart” button

**Product Detail (`/product/[slug]`)**
- Dynamic route `[slug]`
- Fetch `products_complete` (or join `products` + `categories` + `product_variants`) by `slug`
- Gallery (main image + thumbnails)
- Color swatches (from `colors` JSONB) — selecting updates preview images if color-specific images exist
- Size selector (from `sizes` or available `product_variants.size` with stock)
- Price display in ₹ (convert paise → rupees)
- Stock status (`stock_status`: in_stock / low / out)
- Quantity selector (with bounds by stock)
- Add to Cart button
- Highlights, Description, Materials, Care, Shipping
- Related Products (use `getRelatedProducts`)
- Reviews section (read approved reviews; logged-in users can submit reviews if they purchased the product — verify `is_verified_purchase` by checking `orders` + `order_items`)

**Cart (guest + logged-in)**
- Cart lives in **Supabase `cart` table when logged in**, and in **localStorage when guest**
- Cart drawer (slide-in) accessible from header + dedicated `/cart` page
- Cart item: product image, name, selected color/size (variant), unit price, quantity controls, line total, remove
- Sync logic (on login):
  1. Read guest cart from localStorage
  2. Upsert into Supabase `cart` (merge quantities by `user_id`, `product_id`, `variant_id`)
  3. Clear localStorage guest cart
- Cart summary: subtotal, shipping estimate (call `calculate_shipping_charges` function or compute via `shipping_zones` by pincode), COD charges (from shipping zone), GST (if applicable), total
- “Proceed to Checkout” button (requires cart not empty; if guest → redirect to login/signup then back to checkout)

**Checkout (`/checkout`) — COD ONLY**
- Steps: Shipping Address → Review Order → Place Order (COD confirmation)
- Address management:
  - Select existing address (from `addresses`) or add new address
  - Enforce Indian phone (`^[6-9][0-9]{9}$`) and PIN (`^[1-9][0-9]{5}$`)
  - Only one default address enforced (by partial unique index + trigger)
- Order review: items snapshot (name, sku, variant, qty, unit price, line total), subtotal, discount (if coupon), shipping, COD charges, GST, total
- Coupon support (optional but implement): validate via `validate_coupon(p_code, p_user_id, p_subtotal, p_product_ids)`; apply discount_amount; record usage via trigger
- Place Order:
  - Insert into `orders` with `payment_method = 'cod'`, `payment_status = 'pending'`, `status = 'pending'`
  - Insert `order_items` (snapshot all cart items: product_name, product_sku, variant_info, unit_price, quantity, total_price, gst_amount, product_image_url)
  - Clear user cart (Supabase) after successful order creation
  - Redirect to `/account/orders/[order_number]` with success message
- Order number is auto-generated by DB trigger — do NOT generate in frontend
- All amounts in paise in DB; display in ₹ in UI

**My Account (`/account`)**
- Protected route (logged-in users only)
- Sidebar/Tabs: Profile, Addresses, My Orders, Wishlist, Logout
- **Profile**: view/edit `profiles` fields (full_name, phone, preferred_language, marketing_consent, whatsapp_updates). Phone must validate Indian format. Show `total_orders`, `total_spent` (₹), `loyalty_points`, `last_order_at`
- **Addresses**: list, add, edit, delete, set default (respect DB constraints)
- **My Orders**: list of user’s orders (from `orders_complete` or query `orders` joined with `order_items`), filter by status, view order detail page (`/account/orders/[order_number]`) showing items, shipping address, amounts, tracking info (tracking_id/tracking_url placeholders until Shiprocket integration), and **order_logs** timeline (status history)
- **Wishlist**: list products in `wishlist`, add/remove, “Move to Cart”
- Real-time updates (nice-to-have but required): subscribe to `orders` changes for the logged-in user so order status updates appear live (Supabase Realtime)

#### 3) Admin Panel (`/admin`) — ONLY for `role = 'admin'`
- Protected route: check `profiles.role = 'admin'` (admin email `kapilgupta@duck.com` already has admin role)
- Admin layout with sidebar: Dashboard, Orders, Products (basic CRUD), Categories (basic CRUD), Coupons (optional), Low Stock, Settings (read-only/view)
- **Dashboard**: KPIs from `sales_analytics` view (today/week/month revenue, orders, AOV, unique customers), top products (`top_products`), low stock alerts (`low_stock_products`)
- **Orders Management**:
  - List all orders with filters: status, payment_status, date range, search by order_number/customer email/phone
  - Order detail view: full snapshot (customer, addresses, items, amounts, payment info, shipping info, notes)
  - **One-click status updates**: Pending → Confirmed → Processing → Packed → Shipped → Out for Delivery → Delivered (and Cancelled/Refunded where applicable). Each update must create an `order_logs` entry (DB trigger handles; ensure `created_by = auth.uid()`)
  - View `order_logs` timeline
- **Products (basic admin CRUD)**:
  - List products (with stock_status, price, category, is_active)
  - Create/Edit product: name, slug, description, price/original_price (paise), category, colors JSONB, sizes array, images JSONB, stock_quantity, low_stock_threshold, GST/HSN, SEO fields, flags (is_featured, is_new_arrival, is_best_seller, is_limited_edition)
  - Manage `product_variants` (size/color) with independent stock + price_adjustment
  - Soft-delete via `is_active = false`
- **Categories CRUD**
- **Low Stock view** from `low_stock_products`
- **Settings view** (read `settings` table; editing optional for MVP)

### 🧱 SvelteKit Project Setup & Prerendering (must implement exactly)
1. **svelte.config.js**
   - Use `@sveltejs/adapter-static`
   - Output: `pages: 'build'`, `assets: 'build'`
   - `fallback: '404.html'`
   - `prerender = { crawl: true }`

2. **src/routes/+layout.ts**
   - `export const prerender = true;` (global prerender for all routes)

3. **src/routes/product/[slug]/+page.ts**
   - Export `entries()` that returns **all product slugs** from the DB (or from the seeded product list) so dynamic product pages prerender. Example approach: fetch active product slugs in `entries()` (server-side) and return `{ slug: '...' }[]`.

4. **URL access during prerender**
   - Do NOT read `$page.url.searchParams` or `$page.url.search` at module/init time during prerender.  
   - In `Header.svelte` and any page that reads query params (e.g., `/shop`), guard with `import { browser } from '$app/environment'` and read params inside a `$effect` or `onMount`/client-only code path.

### 🔐 Supabase Integration Details
- Create a Supabase client in `src/lib/supabaseClient.ts` using `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
- Use the authenticated client for user-specific queries (cart, orders, wishlist, addresses, profile). Use anon client only for public reads (active products, categories, shipping_zones, approved reviews).
- Respect RLS: never attempt admin-only operations from anon context; ensure admin checks happen server-side or via authenticated admin session.
- Realtime (recommended): subscribe to `orders` table changes filtered by `user_id = auth.uid()` for My Orders live updates; subscribe to `order_logs` for order timeline updates.
- All monetary values: store in **paise** (integers). Convert to ₹ in UI with proper formatting (e.g., `₹1,799.00`).

### 🧪 Data Seeding (products) — implement after DB is ready
Insert the 6 sample products from the provided TypeScript catalogue into Supabase so the frontend can render real data immediately. Use the SQL seed script below (Section B). Ensure:
- Categories exist (`slippers`, `flip-flops`, `slides`, `limited-edition`, `best-sellers`, etc.)
- Each product gets a valid `category_id`
- `price` and `original_price` stored in **paise**
- `colors` stored as JSONB array; `sizes` as text array
- `images` stored as JSONB array with `{url, alt, order}`
- Set appropriate flags (`is_best_seller`, `is_new_arrival`, `is_limited_edition`, `is_active = true`)
- Stock quantities initialized (e.g., 50 each) and `track_inventory = true`

### 🧭 Acceptance Criteria (MVP is DONE only when all pass)
1. ✅ User can signup/login/logout with Supabase Email/Password; protected routes work.  
2. ✅ Home + Shop load with real products from Supabase; filters/sort/search work; product detail pages prerender for all 6 slugs.  
3. ✅ Cart works for guest (localStorage) and logged-in (Supabase `cart`), with correct merge on login.  
4. ✅ Checkout (COD only) creates an `orders` row + `order_items`, clears cart, redirects to order detail; order_number auto-generated; amounts correct in paise/₹.  
5. ✅ My Account shows profile, addresses (CRUD + default), orders (with status + logs timeline), wishlist (CRUD + move to cart).  
6. ✅ Admin (`/admin`, role=admin, email `kapilgupta@duck.com`) can view dashboard KPIs, manage orders (status updates create `order_logs`), manage products/categories (basic), view low stock.  
7. ✅ Realtime updates show order status changes in My Orders without refresh.  
8. ✅ Static build (`npm run build`) succeeds and outputs `/build` with `index.html`, `shop.html`, `checkout.html`, `product/<slug>.html` for all 6 products, and `404.html`.  
9. ✅ No external payment/shipping SDKs used anywhere; only Supabase.  
10. ✅ UI matches pastel feminine theme, mobile-first, responsive, accessible.

### 📦 Deliverables
- Complete SvelteKit project in a clean repo structure (`src/routes`, `src/lib/components`, `src/lib/stores`, `src/lib/supabaseClient.ts`, `src/lib/types.ts`, etc.)
- Tailwind configured (v4) with the pastel color tokens/utilities
- All pages/routes implemented: `/`, `/shop`, `/product/[slug]`, `/cart`, `/checkout`, `/account/*`, `/admin/*`, `/login`, `/signup`
- Supabase queries with proper error handling + loading states
- Seed SQL executed (Section B) and verified in Supabase
- README with: setup steps, env vars, how to run dev/build, how to seed, admin login details
- Final `npm run build` output verified

Begin development now. Provide concise progress updates after completing each major milestone: (1) Auth + Layout/Header, (2) Products/Shop/Detail + Prerender, (3) Cart (guest+sync), (4) Checkout+Orders, (5) My Account (Profile/Addresses/Orders/Wishlist), (6) Admin Panel, (7) Realtime + QA + Final Build.
```

# ================================================================
# FRENCH TOES — COMPLETE BUILD COMMAND
# ================================================================
# Tech: SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS v4 + Supabase
# No Razorpay, No Shiprocket, No OTPless
# Pure Supabase Auth + DB + Storage
# ================================================================

# ─────────────────────────────────────────────────────────────────
# STEP 0: PROJECT STRUCTURE
# ─────────────────────────────────────────────────────────────────

src/
├── lib/
│   ├── supabase.ts                    # Supabase client
│   ├── types.ts                       # All TypeScript types
│   ├── stores/
│   │   ├── auth.ts                    # Auth store
│   │   ├── cart.ts                    # Cart store (localStorage + supabase sync)
│   │   └── wishlist.ts               # Wishlist store
│   ├── utils/
│   │   ├── currency.ts               # Format paise → ₹1,799
│   │   ├── phone.ts                  # Indian phone validation
│   │   ├── address.ts                # Address formatting
│   │   └── helpers.ts                # General helpers
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.svelte         # Main header with nav, cart icon, user menu
│   │   │   ├── Footer.svelte         # Footer with links, socials
│   │   │   ├── MobileNav.svelte      # Bottom mobile navigation
│   │   │   └── CartDrawer.svelte     # Slide-in cart drawer
│   │   ├── ui/
│   │   │   ├── Button.svelte         # Reusable button
│   │   │   ├── Input.svelte          # Form input
│   │   │   ├── Modal.svelte          # Modal wrapper
│   │   │   ├── Toast.svelte          # Toast notification
│   │   │   ├── Loader.svelte         # Spinner
│   │   │   ├── Badge.svelte          # Badge (Best Seller, Sale, etc)
│   │   │   ├── ColorSwatch.svelte    # Color picker circle
│   │   │   ├── SizeSelector.svelte   # Size grid selector
│   │   │   ├── QuantityPicker.svelte # +/- quantity
│   │   │   └── ImageCarousel.svelte  # Product image slider
│   │   ├── product/
│   │   │   ├── ProductCard.svelte    # Grid card for product listing
│   │   │   ├── ProductGallery.svelte # Detail page image gallery
│   │   │   ├── ProductInfo.svelte    # Detail page info section
│   │   │   ├── ProductReviews.svelte # Reviews section
│   │   │   └── ProductFilters.svelte # Shop page filters sidebar
│   │   ├── cart/
│   │   │   ├── CartItem.svelte       # Single cart item row
│   │   │   ├── CartSummary.svelte    # Subtotal, discount, total
│   │   │   └── EmptyCart.svelte      # Empty cart state
│   │   ├── checkout/
│   │   │   ├── AddressForm.svelte    # Shipping address form
│   │   │   ├── OrderSummary.svelte   # Checkout order summary
│   │   │   └── CheckoutSteps.svelte  # Step indicator
│   │   ├── account/
│   │   │   ├── OrderCard.svelte      # Order history card
│   │   │   ├── OrderTimeline.svelte  # Status timeline
│   │   │   ├── ProfileForm.svelte    # Edit profile form
│   │   │   └── WishlistGrid.svelte   # Wishlist product grid
│   │   └── admin/
│   │       ├── AdminSidebar.svelte   # Admin nav sidebar
│   │       ├── AdminHeader.svelte    # Admin top bar
│   │       ├── StatsCard.svelte      # Dashboard stat card
│   │       ├── OrderTable.svelte     # Orders list table
│   │       ├── OrderDetail.svelte    # Order detail modal
│   │       ├── StatusBadge.svelte    # Order status colored badge
│   │       └── StatusUpdater.svelte  # One-click status change
│   └── data/
│       └── products.ts               # (REMOVE — use DB only now)
├── routes/
│   ├── +layout.svelte                # Root layout (header, footer, toasts)
│   ├── +layout.ts                    # Root layout load (auth check)
│   ├── +layout.server.ts             # Server-side root layout
│   ├── +page.svelte                  # HOME PAGE
│   ├── +page.server.ts               # Home page data
│   ├── shop/
│   │   ├── +page.svelte              # SHOP PAGE (grid + filters)
│   │   └── +page.server.ts           # Load products from DB
│   ├── product/[slug]/
│   │   ├── +page.svelte              # PRODUCT DETAIL PAGE
│   │   ├── +page.server.ts           # Load product by slug
│   │   └── +page.ts                  # Prerender entries
│   ├── cart/
│   │   └── +page.svelte              # CART PAGE
│   ├── checkout/
│   │   ├── +page.svelte              # CHECKOUT PAGE (COD only)
│   │   └── +page.server.ts           # Create order action
│   ├── account/
│   │   ├── +layout.svelte            # Account layout (sidebar/nav)
│   │   ├── +layout.ts                # Auth guard
│   │   ├── +page.svelte              # Profile overview
│   │   ├── orders/
│   │   │   ├── +page.svelte          # Order list
│   │   │   └── [id]/
│   │   │       └── +page.svelte      # Order detail with timeline
│   │   └── wishlist/
│   │       └── +page.svelte          # Wishlist page
│   ├── auth/
│   │   ├── login/
│   │   │   └── +page.svelte          # Login page
│   │   ├── signup/
│   │   │   └── +page.svelte          # Signup page
│   │   └── +page.server.ts           # Auth actions
│   └── admin/
│       ├── +layout.svelte            # Admin layout
│       ├── +layout.server.ts         # Admin auth guard
│       ├── +page.svelte              # Admin dashboard
│       ├── orders/
│       │   ├── +page.svelte          # Orders management
│       │   └── [id]/
│       │       └── +page.svelte      # Order detail + status update
│       └── products/
│           └── +page.svelte          # Product list (view only for now)
├── app.html
├── app.css                           # Global styles + Tailwind
└── svelte.config.js


# ─────────────────────────────────────────────────────────────────
# STEP 1: TYPES
# ─────────────────────────────────────────────────────────────────

# File: src/lib/types.ts

Create ALL TypeScript types that match the Supabase schema exactly.
Use the database schema from previous context.

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  role: 'customer' | 'admin' | 'staff';
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: string;
  currency: string;
  timezone: string;
  email_verified: boolean;
  phone_verified: boolean;
  marketing_consent: boolean;
  whatsapp_updates: boolean;
  last_login_at: string | null;
  last_order_at: string | null;
  total_orders: number;
  total_spent: number;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: 'Home' | 'Work' | 'Other';
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: boolean;
  is_billing: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface ProductColor {
  name: string;
  hex: string;
  image: string;
}

export interface ProductImage {
  url: string;
  alt: string;
  order: number;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;
  price: number;          // in paise
  original_price: number | null;
  cost_price: number | null;
  gst_percentage: number;
  hsn_code: string | null;
  category_id: string | null;
  colors: ProductColor[];
  sizes: string[];
  material: string | null;
  highlights: string[];
  care_instructions: string | null;
  images: ProductImage[];
  thumbnail_url: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_limited_edition: boolean;
  is_best_seller: boolean;
  allow_backorder: boolean;
  weight_grams: number | null;
  views_count: number;
  sales_count: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  category_name?: string;
  category_slug?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  price_adjustment: number;
  stock_quantity: number;
  images: ProductImage[];
  is_active: boolean;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refund_requested' | 'refunded' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cod' | 'refunded' | 'partial_refund';
export type PaymentMethod = 'cod' | 'razorpay' | 'phonepe' | 'paytm' | 'upi';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount_amount: number;
  shipping_charges: number;
  cod_charges: number;
  gst_amount: number;
  total_amount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  shipping_address_id: string | null;
  billing_address_id: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  estimated_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  items?: OrderItem[];
  logs?: OrderLog[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  product_sku: string;
  variant_info: { size?: string; color?: string } | null;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  gst_amount: number;
  total_price: number;
  product_image_url: string | null;
}

export interface OrderLog {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  metadata: Json | null;
  created_by: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  // Joined
  product?: Product;
}

export interface CartItem {
  id?: string;
  user_id?: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at?: string;
  // Local additions
  product?: Product;
  variant?: ProductVariant;
  selected_size?: string;
  selected_color?: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: string;
  // Joined
  user_name?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_type: string | null;
  link_id: string | null;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  max_uses: number | null;
  max_uses_per_user: number;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  states: string[];
  base_charge: number;
  per_kg_charge: number;
  free_shipping_threshold: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  cod_available: boolean;
  cod_charge: number;
}

export interface Setting {
  key: string;
  value: Json;
  description: string | null;
}
```


# ─────────────────────────────────────────────────────────────────
# STEP 2: SUPABASE CLIENT
# ─────────────────────────────────────────────────────────────────

# File: src/lib/supabase.ts

Create a Supabase client using environment variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY

Use @supabase/ssr for proper cookie handling in SvelteKit.
Create both browser client and server client helpers.

```typescript
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Database } from './types';

// Define the database type mapping (for Supabase type safety)
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      addresses: { Row: Address; Insert: Partial<Address>; Update: Partial<Address> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      product_variants: { Row: ProductVariant; Insert: Partial<ProductVariant>; Update: Partial<ProductVariant> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem> };
      order_logs: { Row: OrderLog; Insert: Partial<OrderLog>; Update: Partial<OrderLog> };
      wishlist: { Row: WishlistItem; Insert: Partial<WishlistItem>; Update: Partial<WishlistItem> };
      cart: { Row: CartItem; Insert: Partial<CartItem>; Update: Partial<CartItem> };
      reviews: { Row: Review; Insert: Partial<Review>; Update: Partial<Review> };
      coupons: { Row: Coupon; Insert: Partial<Coupon>; Update: Partial<Coupon> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      shipping_zones: { Row: ShippingZone; Insert: Partial<ShippingZone>; Update: Partial<ShippingZone> };
      settings: { Row: Setting; Insert: Partial<Setting>; Update: Partial<Setting> };
    };
  };
};

export function createSupabaseClient() {
  return createBrowserClient<Database>(
    env.PUBLIC_SUPABASE_URL!,
    env.PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createSupabaseServerClient(fetch: typeof globalThis.fetch, cookies: Cookies) {
  return createServerClient<Database>(
    env.PUBLIC_SUPABASE_URL!,
    env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookies.get(key),
        set: (key, value, options) => cookies.set(key, value, options),
        remove: (key, options) => cookies.delete(key, options),
      },
    }
  );
}
```


# ─────────────────────────────────────────────────────────────────
# STEP 3: UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────────

# File: src/lib/utils/currency.ts

```typescript
/**
 * Convert paise to formatted INR string
 * 179900 → "₹1,799"
 * 0 → "₹0"
 */
export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Convert rupees to paise
 * 1799 → 179900
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise to rupees
 * 179900 → 1799
 */
export function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Calculate discount percentage
 * original: 249900, current: 179900 → 28
 */
export function discountPercent(original: number, current: number): number {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

/**
 * Format price range
 * min: 129900, max: 219900 → "₹1,299 – ₹2,199"
 */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)} – ${formatPrice(max)}`;
}
```

# File: src/lib/utils/phone.ts

```typescript
/**
 * Validate Indian mobile number
 * 9876543210 → true
 * 1234567890 → false (doesn't start with 6-9)
 * 98765 → false (too short)
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Format phone for display
 * 9876543210 → "+91 98765 43210"
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10) return phone;
  return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
}

/**
 * Format phone for WhatsApp link
 * 9876543210 → "919876543210"
 */
export function phoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return '91' + cleaned;
}
```

# File: src/lib/utils/helpers.ts

```typescript
/**
 * Generate a short ID for local use
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Format date for Indian display
 * "2025-01-15T10:30:00Z" → "15 Jan 2025"
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date with time
 * "2025-01-15T10:30:00Z" → "15 Jan 2025, 10:30 AM"
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate estimated delivery date
 */
export function getEstimatedDelivery(minDays: number, maxDays: number): string {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + minDays);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + maxDays);
  
  const format = { day: 'numeric', month: 'short' } as const;
  if (minDays === maxDays) {
    return minDate.toLocaleDateString('en-IN', format);
  }
  return `${minDate.toLocaleDateString('en-IN', format)} – ${maxDate.toLocaleDateString('en-IN', format)}`;
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Slugify text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
```

# ─────────────────────────────────────────────────────────────────
# STEP 4: STORES (Svelte 5 Runes)
# ─────────────────────────────────────────────────────────────────

# File: src/lib/stores/auth.ts

Auth store using Svelte 5 runes ($state, $effect).
Handle:
- Current user session
- Login (email/password)
- Signup (email/password)
- Logout
- Profile fetching
- Role checking (customer vs admin)

```typescript
// Use $state for reactive auth state
// Listen to Supabase auth state changes
// Fetch profile on login
// Provide: user, profile, isAdmin, login(), signup(), logout()
```

# File: src/lib/stores/cart.ts

Cart store with:
- localStorage persistence for guest users
- Supabase sync for logged-in users
- Add, remove, update quantity, clear
- Auto-sync on login

```typescript
// Cart items stored as CartItem[]
// localStorage key: 'frenchtoes_cart'
// On login: merge localStorage cart into supabase cart table
// Provide: items, addItem(), removeItem(), updateQuantity(), clear(), total, itemCount
```

IMPORTANT Cart Logic:
```
When user is NOT logged in:
  - Store cart in localStorage
  - cart item shape: { product_id, variant_id, quantity, selected_size, selected_color }

When user IS logged in:
  - Read from supabase 'cart' table
  - On login: push localStorage cart → supabase cart (merge by product_id+variant_id)
  - On logout: clear supabase cart, keep localStorage

Cart item validation:
  - Before adding, check product exists and is active
  - Check stock_quantity >= requested quantity
  - If out of stock, show toast warning
```

# File: src/lib/stores/wishlist.ts

```typescript
// Supabase-backed wishlist
// Provide: items, toggle(product_id), isWishlisted(product_id), load()
// RLS ensures users only see their own wishlist
```


# ─────────────────────────────────────────────────────────────────
# STEP 5: LAYOUT COMPONENTS
# ─────────────────────────────────────────────────────────────────

# File: src/lib/components/layout/Header.svelte

Requirements:
```
- Sticky top header
- Left: Logo "French Toes" with flower icon
- Center: Nav links (Home, Shop, About)
- Right: Search icon, Wishlist heart icon (with count badge), 
         Cart bag icon (with count badge), User avatar/profile icon
- Mobile: Hamburger menu
- Cart icon click → opens CartDrawer
- User icon:
  - Not logged in → link to /auth/login
  - Logged in → dropdown with: My Account, My Orders, Wishlist, Logout
  - Admin → also shows Admin Dashboard link
- Background: white with subtle shadow
- Use $page.url.pathname for active link highlighting
- DO NOT use $page.url.search or $page.url.searchParams (breaks prerender)
- Smooth hover transitions on nav links
- Cart badge: show count if > 0, hide if 0
- Wishlist badge: show count if > 0
```

# File: src/lib/components/layout/Footer.svelte

Requirements:
```
- Dark/brown background with cream text
- 4 columns:
  1. Brand: Logo, tagline "Walk Pretty, Live Pretty", social icons
  2. Shop: Links to categories
  3. Support: Contact, FAQ, Shipping, Returns, Size Guide
  4. Legal: Privacy Policy, Terms, Cancellation Policy
- Bottom bar: "© 2025 French Toes. Made with ❤️ in India"
- Responsive: stacks on mobile
- Social icons: Instagram, Facebook (use simple SVG or unicode)
```

# File: src/lib/components/layout/MobileNav.svelte

Requirements:
```
- Fixed bottom bar on mobile only (hidden on desktop)
- 5 icons: Home, Shop, Cart, Wishlist, Account
- Active state highlighting
- Cart icon shows count badge
- Smooth tap animations
```

# File: src/lib/components/layout/CartDrawer.svelte

Requirements:
```
- Slide-in from right side
- Overlay backdrop (click to close)
- Header: "Your Cart" + item count + close X button
- Scrollable list of CartItem components
- Empty state: illustration + "Your cart is empty" + "Start Shopping" button
- Footer: Subtotal, "View Cart" button, "Checkout" button
- Shows shipping estimate if subtotal < ₹999
- Responsive: full-width on mobile, 400px on desktop
- Smooth slide animation
- Uses cart store for data
```


# ─────────────────────────────────────────────────────────────────
# STEP 6: UI COMPONENTS
# ─────────────────────────────────────────────────────────────────

# File: src/lib/components/ui/Button.svelte
```
Props: variant ('primary' | 'secondary' | 'outline' | 'ghost' | 'danger'), 
       size ('sm' | 'md' | 'lg'), disabled, loading, href, type
Renders: <button> or <a> if href provided
Primary: peach/coral gradient background, white text
Secondary: lavender background
Outline: border with hover fill
Ghost: text only with hover background
Danger: red for delete/cancel actions
Loading state: show spinner, disable click
Full rounded corners, smooth hover scale(1.02) transition
```

# File: src/lib/components/ui/Input.svelte
```
Props: label, placeholder, type, value, error, required, disabled, icon
Styled: rounded-lg border, focus ring in peach color
Error state: red border + error message below
Supports: text, email, password, tel, number, textarea
```

# File: src/lib/components/ui/ColorSwatch.svelte
```
Props: color {name, hex}, selected (boolean), size ('sm'|'md'|'lg')
Renders: circle with color fill
Selected: 3px ring around circle + checkmark overlay
Hover: slight scale up
Tooltip on hover showing color name
```

# File: src/lib/components/ui/SizeSelector.svelte
```
Props: sizes (string[]), availableSizes (string[]), selected (string|null), onSelect
Renders: grid of size boxes
Available: clickable, white bg with border
Unavailable: grayed out, not clickable, "X" or strikethrough
Selected: filled with peach bg
```

# File: src/lib/components/ui/Badge.svelte
```
Props: text, variant ('sale' | 'best-seller' | 'new' | 'limited' | 'default')
Sale: coral/red background
Best Seller: gold background
New: mint green background
Limited: lavender background
Small rounded pill shape
```

# File: src/lib/components/ui/Loader.svelte
```
Full page loader or inline spinner
Pastel-colored spinning animation
```

# File: src/lib/components/ui/Toast.svelte
```
Positioned bottom-right on desktop, bottom on mobile
Types: success (green), error (red), warning (yellow), info (blue)
Auto-dismiss after 4 seconds
Slide-in animation
Close button
Stack multiple toasts
```


# ─────────────────────────────────────────────────────────────────
# STEP 7: PRODUCT COMPONENTS
# ─────────────────────────────────────────────────────────────────

# File: src/lib/components/product/ProductCard.svelte
```
Props: product (Product)
- Image with hover zoom effect
- Badges (Best Seller, Sale, New) positioned on image
- Product name
- Price: show original price with strikethrough + current price in bold
- Discount percentage badge if on sale
- Rating stars + review count
- Heart icon for wishlist (top-right of image)
- Click → navigate to /product/{slug}
- Responsive: 2 columns on mobile, 3-4 on desktop
- Subtle shadow on hover
- Card rounded-xl with overflow-hidden
```

# File: src/lib/components/product/ProductFilters.svelte
```
Props: filters (object), onFilterChange (function)
Filters:
  - Price range (slider or min/max inputs)
  - Colors (clickable color swatches, multi-select)
  - Sizes (clickable boxes, multi-select)
  - Sort by: Popularity, Price Low-High, Price High-Low, Newest, Best Rating
  - Clear All button
Mobile: collapsible accordion
Desktop: sticky sidebar
```

# File: src/lib/components/product/ProductGallery.svelte
```
Props: images (ProductImage[])
- Main large image with zoom on hover
- Thumbnail strip below (clickable)
- Swipe support on mobile (or simple left/right arrows)
- Lazy loading for images
```

# File: src/lib/components/product/ProductInfo.svelte
```
Props: product (Product)
- Product name (large heading)
- Rating stars + review count (clickable to scroll to reviews)
- Price section: original price strikethrough, current price large, discount % badge
- Color swatches: click to select, shows color name
- Size selector: grid of sizes, out-of-stock sizes grayed
- Quantity picker: - / number / +
- Add to Cart button (large, peach gradient)
- Buy Now button (outline style)
- Wishlist heart icon button
- Highlights: bullet list with checkmark icons
- Description: expandable "Read More" section
- Material & Care: collapsible section
- Shipping info: collapsible section
- "Free shipping on orders above ₹999" banner
- Delivery estimate based on selected address (if available)
```

# ─────────────────────────────────────────────────────────────────
# STEP 8: PAGES
# ─────────────────────────────────────────────────────────────────

# File: src/routes/+page.svelte (HOME PAGE)
```
Sections:
1. Hero Banner:
   - Full-width image slider (3 slides)
   - Pastel gradient overlay
   - Headline: "Slip Into Summer"
   - Subtext: "Handcrafted slippers made for Indian women"
   - "Shop Now" CTA button
   - Auto-rotate every 5 seconds with dots indicator

2. Best Sellers:
   - Section heading: "Our Bestsellers ✨"
   - Horizontal scroll on mobile, grid on desktop
   - ProductCard components
   - "View All" link to /shop?filter=best-sellers

3. Shop by Collection:
   - Grid of collection cards (Blossom Classics, Garden Party, Home Luxe, Beach Days)
   - Each card: image + collection name + "Shop" link
   - Hover: scale up slightly

4. Why French Toes:
   - 4 feature icons in a row:
     🌸 Breathable & Light | 👣 Memory Foam Comfort | 🌊 Quick-Dry Fabric | 🇮🇳 Made for Indian Summers
   - Subtle background color

5. New Arrivals:
   - Section heading: "Fresh Drops 🆕"
   - ProductCard grid
   - "View All" link to /shop?filter=new-arrivals

6. Testimonials:
   - 3-4 customer review cards
   - Star ratings, customer name, review text
   - Subtle pastel background

7. Newsletter / CTA:
   - "Stay in the loop" with email input + subscribe button
   - "Get 10% off your first order" incentive

8. Instagram Feed (placeholder):
   - "Follow us @frenchtoes"
   - Grid of placeholder lifestyle images
```

# File: src/routes/+page.server.ts
```
Load from Supabase:
- Best sellers: products where is_best_seller = true and is_active = true, limit 8
- New arrivals: products where is_new_arrival = true and is_active = true, limit 8
- Categories: all active categories
- Site settings: hero_headline, hero_subtext
```

# File: src/routes/shop/+page.svelte (SHOP PAGE)
```
Layout:
- Breadcrumb: Home > Shop
- Page heading: "All Slippers" or category name
- Filter bar at top (mobile: filter icon opens drawer)
- Product grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
- ProductFilters sidebar on desktop (left side)
- Sort dropdown (top-right)
- Product count: "Showing X products"
- Loading skeleton while fetching
- Empty state: "No products found matching your filters"
- Infinite scroll or "Load More" button

IMPORTANT: Read URL searchParams ONLY inside browser check:
```svelte
import { browser } from '$app/environment';
import { page } from '$app/state';

let filters = $state({...});

$effect(() => {
  if (browser) {
    // Read URL params here safely
    const params = page.url.searchParams;
    if (params.get('filter')) filters.category = params.get('filter');
    if (params.get('sort')) filters.sort = params.get('sort');
  }
});
```

# File: src/routes/shop/+page.server.ts
```
Load products from Supabase:
- Query: select *, categories!inner(name, slug) from products where is_active = true
- Apply filters passed from page: color, size, price range, sort
- Return: products array, categories array
- Limit to 50 products per page
```

# File: src/routes/product/[slug]/+page.svelte (PRODUCT DETAIL)
```
Layout:
- Breadcrumb: Home > Shop > {product.name}
- Two-column on desktop:
  Left: ProductGallery
  Right: ProductInfo
- Full-width on mobile (gallery on top, info below)
- Related Products section below (4 cards)
- Reviews section (if reviews exist)
- Recently viewed products (optional)
- Schema.org JSON-LD for SEO
```

# File: src/routes/product/[slug]/+page.server.ts
```
Load from Supabase:
- Product by slug: select * from products where slug = ? and is_active = true
- Related products: same category, different slug, limit 4
- Reviews: select * from reviews where product_id = ? and is_approved = true
- Error handling: if product not found, throw 404
```

# File: src/routes/cart/+page.svelte (CART PAGE)
```
Layout:
- Page heading: "Your Cart ({itemCount})"
- Two-column on desktop:
  Left: List of CartItem components
  Right: CartSummary (subtotal, estimated shipping, total, Checkout button)
- Mobile: stacked layout
- Empty cart: illustration + "Your cart is empty" + "Continue Shopping" link
- Each CartItem:
  - Product image (thumbnail)
  - Product name + color + size
  - Price per item
  - Quantity picker
  - Remove (trash icon)
  - Line total
- CartSummary:
  - Subtotal
  - Shipping: "Free" or "₹X (Free shipping above ₹999)"
  - COD charges: show if COD selected later
  - Total
  - "Proceed to Checkout" button
  - "Continue Shopping" link
```

# File: src/routes/checkout/+page.svelte (CHECKOUT PAGE)
```
This is the KEY page. COD only.

Layout:
- Breadcrumb: Cart > Checkout
- Steps: 1. Address → 2. Review → 3. Place Order

Step 1 — Address:
- If user has saved addresses: show list with radio select + "Add New" button
- If no address: show AddressForm (full_name, phone, address_line1, address_line2, landmark, city, state dropdown, pincode)
- State dropdown: list of all Indian states
- Pincode: 6-digit validation
- Phone: 10-digit Indian mobile validation
- "Save this address" checkbox

Step 2 — Review Order:
- Order items summary (read from cart)
- Shipping address display
- Coupon code input + "Apply" button (use validate_coupon function)
- Price breakdown:
  - Items total
  - Discount (if coupon applied)
  - Shipping (calculate based on state/pincode)
  - COD charges (₹49)
  - GST (5%)
  - Grand total
- "Edit" links for address and items

Step 3 — Place Order:
- Large "Place Order (COD)" button
- Order confirmation: "Your order #{order_number} has been placed!"
- Redirect to /account/orders/{order_id} after 3 seconds
- Clear cart after successful order

IMPORTANT: Use +page.server.ts form action for order creation:
```

# File: src/routes/checkout/+page.server.ts
```
Form action "placeOrder":
1. Validate user is logged in (redirect to /auth/login if not)
2. Validate cart is not empty
3. Validate shipping address is provided
4. Create order in 'orders' table:
   {
     user_id: auth.uid(),
     status: 'pending',
     payment_status: 'cod',
     payment_method: 'cod',
     subtotal: calculated_subtotal,
     discount_amount: coupon_discount,
     shipping_charges: calculated_shipping,
     cod_charges: 4900, // ₹49
     gst_amount: calculated_gst,
     total_amount: calculated_total,
     shipping_address: { full JSON of address },
     items: { JSON array of cart items },
     coupon_code: applied_coupon_code (if any)
   }
5. Create order_items rows for each cart item
6. Clear cart (delete from cart table where user_id = auth.uid())
7. Return { order_id, order_number }
8. Redirect to /account/orders/{order_id}

IMPORTANT: The order_number is auto-generated by the DB trigger, so don't set it.
IMPORTANT: items column in orders table stores JSONB snapshot of all items.
```

# File: src/routes/auth/login/+page.svelte
```
- Centered card on pastel background
- Email + password inputs
- "Login" button
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Error display for invalid credentials
- Loading state on submit
- On success: redirect to previous page or home
- Google login: DISABLED for now (hide the button)
```

# File: src/routes/auth/signup/+page.svelte
```
- Full name input
- Email input
- Phone input (optional, 10-digit Indian validation)
- Password input (min 6 chars)
- Confirm password input
- "Create Account" button
- "Already have an account? Login" link
- Validation: all fields required, passwords match, phone format
- On success: redirect to home with toast "Account created! Please check your email."
- Profile is auto-created by DB trigger
```

# File: src/routes/auth/+page.server.ts
```
Form actions:
- login: supabase.auth.signInWithPassword({ email, password })
- signup: supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })
- logout: supabase.auth.signOut()
- Handle errors and redirect
```

# File: src/routes/account/+layout.svelte
```
- Sidebar navigation (desktop): Profile, Orders, Wishlist, Logout
- Mobile: horizontal scrollable tabs at top
- Active state highlighting
- Auth guard: redirect to /auth/login if not authenticated
```

# File: src/routes/account/+layout.ts
```
- Check if user is authenticated
- If not: redirect to /auth/login
- Fetch profile data
```

# File: src/routes/account/+page.svelte (PROFILE PAGE)
```
- Profile card: avatar, name, email, phone, member since
- Stats: Total Orders, Total Spent (₹), Loyalty Points
- Edit profile: name, phone, marketing preferences
- Address list with add/edit/delete
- Change password (link to Supabase reset)
```

# File: src/routes/account/orders/+page.svelte (ORDER LIST)
```
- Heading: "My Orders"
- List of OrderCard components
- Each card: order number, date, status badge, total, item count
- Click → expand to show items or navigate to detail page
- Filter tabs: All, Pending, Confirmed, Shipped, Delivered, Cancelled
- Empty state: "No orders yet" + "Start Shopping" link
- Sorted by created_at desc
```

# File: src/routes/account/orders/[id]/+page.svelte (ORDER DETAIL)
```
- Order number + date
- Status badge (colored)
- OrderTimeline: visual timeline showing each status change
  - Icons for each step: Pending → Confirmed → Processing → Packed → Shipped → Delivered
  - Completed steps: filled circle with checkmark
  - Current step: animated pulse
  - Future steps: empty circle with dotted line
  - Timestamps on completed steps
- Items list with images, names, quantities, prices
- Shipping address display
- Price breakdown (subtotal, discount, shipping, COD, GST, total)
- Payment: "Cash on Delivery"
- Cancel order button (only if status is pending or confirmed)
- Real-time updates: subscribe to order changes using Supabase realtime
```

# File: src/routes/account/wishlist/+page.svelte
```
- Heading: "My Wishlist ❤️"
- Product grid (same as shop but from wishlist)
- Each card: product image, name, price, "Add to Cart" button, remove heart icon
- Empty state: "Your wishlist is empty" + "Browse Products"
```


# ─────────────────────────────────────────────────────────────────
# STEP 9: ADMIN PANEL
# ─────────────────────────────────────────────────────────────────

# File: src/routes/admin/+layout.svelte
```
- Dark sidebar on left (desktop)
- Mobile: top header with hamburger
- Sidebar links: Dashboard, Orders, Products, Settings (disabled)
- Logo + "Admin" label
- Current admin name + role
- Protected: only role='admin' can access
- Redirect non-admins to home with toast "Access Denied"
```

# File: src/routes/admin/+layout.server.ts
```
- Check user role from profiles table
- If role !== 'admin': redirect to home
- Return profile data for admin display
```

# File: src/routes/admin/+page.svelte (DASHBOARD)
```
- Stats cards row:
  - Total Orders (today)
  - Revenue (today, in ₹)
  - Pending Orders
  - Total Customers
- Recent Orders table (last 10):
  - Order #, Customer, Amount, Status, Date
  - Click → /admin/orders/{id}
- Low Stock Products alert (if any)
- Top selling products (top 5)
```

# File: src/routes/admin/orders/+page.svelte (ORDERS MANAGEMENT)
```
- Heading: "Orders Management"
- Filter bar: Status tabs (All, Pending, Confirmed, Processing, Packed, Shipped, Delivered, Cancelled)
- Search by order number or customer name
- Date range filter (optional)
- Orders table:
  - Checkbox (for bulk actions later)
  - Order #, Customer (name + phone), Items count, Total ₹, Status badge, Payment, Date, Actions
  - Actions: View, Update Status
- Pagination or infinite scroll
- Export CSV button (optional)
- Sorted by created_at desc
```

# File: src/routes/admin/orders/[id]/+page.svelte (ORDER DETAIL + STATUS UPDATE)
```
- Full order details
- Customer info: name, email, phone
- Shipping address
- Items list with images
- Price breakdown
- Payment: COD status
- STATUS UPDATE SECTION (key feature):
  - Current status highlighted
  - Next possible status buttons:
    - Pending → [Confirm] [Cancel]
    - Confirmed → [Start Processing] [Cancel]
    - Processing → [Mark Packed]
    - Packed → [Mark Shipped]
    - Shipped → [Mark Out for Delivery]
    - Out for Delivery → [Mark Delivered]
  - Each button: one click, updates status, logs the change
  - Cancel: show modal for cancellation reason
- Order timeline (same as customer view)
- Admin notes: text input + save button
- Customer notes display
```

# File: src/routes/admin/orders/[id]/+page.server.ts
```
Form action "updateStatus":
1. Verify user is admin
2. Update orders.status to new value
3. DB trigger automatically:
   - Creates order_log entry
   - Updates timestamps (shipped_at, delivered_at, cancelled_at)
   - Creates notification for customer
   - Updates stock if confirmed/cancelled
4. Re-fetch order data
5. Return success toast

Form action "addNote":
1. Update orders.admin_notes
```

# ─────────────────────────────────────────────────────────────────
# STEP 10: STYLING / THEME
# ─────────────────────────────────────────────────────────────────

# File: src/app.css (Global Styles + Tailwind)

```css
/* Import Tailwind v4 */
@import "tailwindcss";

/* Custom theme: French Toes Blossom Pastel */
@theme {
  /* Primary palette */
  --color-blush: #f4a7c3;
  --color-peach: #ffb347;
  --color-lavender: #c9a0dc;
  --color-mint: #7ecba1;
  --color-coral: #ff7f6e;
  --color-gold: #d4a853;
  --color-cream: #faf5f0;
  --color-nude: #d4a574;
  
  /* Text colors */
  --color-brown: #5c3d2e;
  --color-brown-light: #8b6f5e;
  
  /* Backgrounds */
  --color-bg-primary: #fffdf9;
  --color-bg-secondary: #faf5f0;
  --color-bg-accent: #fef0e4;
  
  /* Status colors */
  --color-pending: #f59e0b;
  --color-confirmed: #3b82f6;
  --color-processing: #8b5cf6;
  --color-shipped: #06b6d4;
  --color-delivered: #22c55e;
  --color-cancelled: #ef4444;
  --color-returned: #6b7280;
  
  /* Fonts */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
  
  /* Border radius */
  --radius-card: 1rem;
  --radius-button: 0.75rem;
  --radius-full: 9999px;
}

/* Base styles */
body {
  font-family: var(--font-body);
  background-color: var(--color-bg-primary);
  color: var(--color-brown);
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
}
::-webkit-scrollbar-thumb {
  background: var(--color-blush);
  border-radius: 3px;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

.animate-slide-right {
  animation: slideInRight 0.3s ease-out;
}

/* Gradient buttons */
.btn-primary {
  background: linear-gradient(135deg, var(--color-peach), var(--color-coral));
  color: white;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(255, 127, 110, 0.3);
}

/* Card hover effect */
.card-hover {
  transition: all 0.3s ease;
}
.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(92, 61, 46, 0.1);
}
```

# ─────────────────────────────────────────────────────────────────
# STEP 11: ENVIRONMENT & CONFIG
# ─────────────────────────────────────────────────────────────────

# File: .env
```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

# File: svelte.config.js
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false,
    }),
    prerender: {
      crawl: true,
      entries: ['/', '/shop', '/auth/login', '/auth/signup'],
    },
  },
};

export default config;
```

# ─────────────────────────────────────────────────────────────────
# STEP 12: CRITICAL RULES
# ─────────────────────────────────────────────────────────────────

RULES TO FOLLOW STRICTLY:

1. NEVER use $page.url.search or $page.url.searchParams outside 
   of a browser-only $effect() block. Use `browser` from 
   '$app/environment' guard.

2. NEVER reference $page.url.pathname in Header.svelte isActive() 
   function — just use window.location.pathname or 
   page.url.pathname (without .search).

3. ALL prices stored and transmitted in PAISE (integer). 
   Only format to ₹ in UI using formatPrice().

4. ALL phone numbers: 10-digit Indian format, starts with 6-9. 
   Strip non-digits before saving.

5. ALL pincodes: 6-digit Indian format, starts with 1-9.

6. RLS is enabled on ALL tables. NEVER bypass RLS. 
   Use service role key only in server-side actions where admin 
   access is verified.

7. Order creation MUST be in a server-side form action 
   (+page.server.ts), NEVER in client-side code.

8. Cart sync: localStorage for guests, Supabase for logged-in. 
   On login, merge localStorage → Supabase.

9. Use Svelte 5 runes: $state, $derived, $effect, $props. 
   NO legacy reactive declarations ($:).

10. All components use $props() for inputs, NOT export let.

11. Images from Unsplash URLs are fine for demo. 
    Don't try to download or proxy them.

12. The admin email is kapilgupta@duck.com. 
    This user already has role='admin' in profiles table.

13. Order status flow:
    pending → confirmed → processing → packed → shipped → out_for_delivery → delivered
    Any non-delivered → cancelled

14. COD is the ONLY payment method. 
    Payment status should be 'cod' for all orders.

15. Free shipping on orders above ₹999 (99900 paise).

16. COD charges: ₹49 (4900 paise).

17. GST: 5% on all products.

18. Order number is AUTO-GENERATED by the DB trigger. 
    Format: FT-YYMMDD-XXXX. Do NOT generate in app code.

19. On order creation, store a JSONB snapshot of all items 
    in the orders.items column AND create individual rows 
    in order_items table.

20. The addresses are stored separately in the addresses table, 
    but the shipping_address in orders table stores a JSONB 
    snapshot for historical accuracy.

# ─────────────────────────────────────────────────────────────────
# STEP 13: BUILD & DEPLOY
# ─────────────────────────────────────────────────────────────────

After all files are created:

1. npm install
2. npm run dev (test locally)
3. npm run build (verify static export works)
4. Check build/ folder has all HTML files
5. Deploy build/ folder to hosting (Vercel/Netlify/S3)
6. Set environment variables in hosting platform
7. Test full flow: signup → browse → add to cart → checkout → 
   place order → view in account → admin sees it

```


# ─────────────────────────────────────────────────────────────────
# SAMPLE PRODUCT SQL (ALREADY PROVIDED ABOVE)
# ─────────────────────────────────────────────────────────────────

Run the SQL from Part 1 in Supabase SQL Editor BEFORE testing.
This inserts:
- 7 categories
- 6 products (Chicago, Maxico, Milano, Indiano, Dummyano, Loremano)
- 6 shipping zones (covering all Indian states)
- 24 site settings
- 2 sample coupons (WELCOME10, SUMMER50)

# ─────────────────────────────────────────────────────────────────
# VERIFICATION QUERY (Run after seeding)
# ─────────────────────────────────────────────────────────────────

```sql
-- Quick check everything is in place
select '✅ Products' as item, count(*) as count from products
union all select '✅ Categories', count(*) from categories
union all select '✅ Shipping Zones', count(*) from shipping_zones
union all select '✅ Settings', count(*) from settings
union all select '✅ Coupons', count(*) from coupons;

-- Check admin user
select '✅ Admin Profile' as item, email, role 
from profiles where email = 'kapilgupta@duck.com';

-- Preview products
select name, '₹' || (price/100)::text as price, 
  case when original_price is not null 
    then '₹' || (original_price/100)::text 
    else '-' 
  end as original_price,
  rating_avg, sales_count
from products order by sales_count desc;
```



below is our db schema idea .

-- =============================================
-- FRENCH TOES - COMPLETE E-COMMERCE SCHEMA
-- Indian Slipper Store - Production Ready
-- =============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- For fuzzy search

-- =============================================
-- ENUMS (Better than text checks)
-- =============================================

do $$ begin
  create type user_role as enum ('customer', 'admin', 'staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum (
    'pending', 'confirmed', 'processing', 'packed', 
    'shipped', 'out_for_delivery', 'delivered', 
    'cancelled', 'refund_requested', 'refunded', 'returned'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'cod', 'refunded', 'partial_refund');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('cod', 'razorpay', 'phonepe', 'paytm', 'upi');
exception when duplicate_object then null;
end $$;

-- =============================================
-- CORE TABLES
-- =============================================

-- 1. PROFILES (Extended User Info)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role default 'customer' not null,
  
  -- Personal Info
  full_name text not null,
  email text unique not null,
  phone text unique check (phone ~ '^[6-9][0-9]{9}$'), -- Indian phone validation
  avatar_url text,
  
  -- Preferences
  preferred_language text default 'en' check (preferred_language in ('en', 'hi')),
  currency text default 'INR' not null,
  timezone text default 'Asia/Kolkata',
  
  -- Marketing
  email_verified boolean default false,
  phone_verified boolean default false,
  marketing_consent boolean default false,
  whatsapp_updates boolean default true,
  
  -- Metadata
  last_login_at timestamptz,
  last_order_at timestamptz,
  total_orders integer default 0,
  total_spent integer default 0, -- in paise
  loyalty_points integer default 0,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Constraints
  constraint valid_email check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 2. ADDRESSES (Separate table for flexibility)
create table if not exists public.addresses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  
  -- Address Details
  label text default 'Home' check (label in ('Home', 'Work', 'Other')),
  full_name text not null,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address_line1 text not null,
  address_line2 text,
  landmark text,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'), -- Indian PIN
  country text default 'India' not null,
  
  -- Flags
  is_default boolean default false,
  is_billing boolean default false,
  
  -- Geo (optional, for delivery optimization)
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add unique constraint for default address separately
create unique index unique_default_address_per_user 
  on addresses(user_id) 
  where is_default = true;

-- 3. CATEGORIES
create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  name text not null,
  description text,
  parent_id uuid references categories(id) on delete set null,
  image_url text,
  icon text,
  display_order integer default 0,
  is_active boolean default true,
  meta_title text,
  meta_description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. PRODUCTS
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  sku text unique not null,
  slug text unique not null,
  
  -- Basic Info
  name text not null,
  description text,
  short_description text,
  
  -- Pricing (in paise)
  price integer not null check (price > 0),
  original_price integer check (original_price >= price),
  cost_price integer, -- for margin calculation
  
  -- Tax
  gst_percentage decimal(5,2) default 5.00, -- India GST
  hsn_code text, -- HSN code for GST
  
  -- Categorization
  category_id uuid references categories(id) on delete set null,
  
  -- Variants & Attributes
  colors jsonb default '[]'::jsonb, -- [{name, hex, image}]
  sizes text[] default array[]::text[], -- ['S', 'M', 'L']
  material text,
  highlights text[] default array[]::text[],
  care_instructions text,
  
  -- Images
  images jsonb default '[]'::jsonb, -- [{url, alt, order}]
  thumbnail_url text,
  
  -- Inventory
  stock_quantity integer default 0 check (stock_quantity >= 0),
  low_stock_threshold integer default 5,
  track_inventory boolean default true,
  
  -- Flags
  is_active boolean default true,
  is_featured boolean default false,
  is_new_arrival boolean default false,
  is_limited_edition boolean default false,
  is_best_seller boolean default false,
  allow_backorder boolean default false,
  
  -- Dimensions & Weight (for shipping)
  weight_grams integer, -- in grams
  length_cm decimal(10,2),
  width_cm decimal(10,2),
  height_cm decimal(10,2),
  
  -- SEO
  meta_title text,
  meta_description text,
  meta_keywords text[],
  
  -- Stats
  views_count integer default 0,
  sales_count integer default 0,
  rating_avg decimal(3,2) default 0.00 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count integer default 0,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Ensure discount makes sense
  constraint valid_pricing check (original_price is null or original_price >= price)
);

-- 5. PRODUCT VARIANTS (For size/color combinations)
create table if not exists public.product_variants (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  sku text unique not null,
  
  -- Variant attributes
  size text,
  color text,
  
  -- Variant-specific pricing
  price_adjustment integer default 0, -- difference from base price
  
  -- Inventory
  stock_quantity integer default 0 check (stock_quantity >= 0),
  
  -- Images
  images jsonb default '[]'::jsonb,
  
  is_active boolean default true,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Unique combination
  constraint unique_variant unique (product_id, size, color)
);

-- 6. COUPONS
create table if not exists public.coupons (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  description text,
  
  -- Discount
  discount_type text check (discount_type in ('percentage', 'fixed')) not null,
  discount_value integer not null check (discount_value > 0),
  max_discount_amount integer, -- cap for percentage discounts
  
  -- Conditions
  min_order_value integer default 0,
  max_uses integer, -- null = unlimited
  max_uses_per_user integer default 1,
  current_uses integer default 0,
  
  -- Applicability
  applicable_categories uuid[] default array[]::uuid[],
  applicable_products uuid[] default array[]::uuid[],
  
  -- Validity
  valid_from timestamptz default now() not null,
  valid_until timestamptz,
  
  is_active boolean default true,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  constraint valid_dates check (valid_until is null or valid_until > valid_from)
);

-- 7. ORDERS
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text unique not null,
  
  -- User
  user_id uuid references profiles(id) on delete set null,
  
  -- Status
  status order_status default 'pending' not null,
  payment_status payment_status default 'pending' not null,
  payment_method payment_method,
  
  -- Amounts (in paise)
  subtotal integer not null check (subtotal >= 0),
  discount_amount integer default 0 check (discount_amount >= 0),
  shipping_charges integer default 0 check (shipping_charges >= 0),
  cod_charges integer default 0 check (cod_charges >= 0),
  gst_amount integer default 0 check (gst_amount >= 0),
  total_amount integer not null check (total_amount >= 0),
  
  -- Coupon
  coupon_id uuid references coupons(id) on delete set null,
  coupon_code text,
  
  -- Payment Gateway
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_gateway_response jsonb,
  payment_attempted_at timestamptz,
  payment_completed_at timestamptz,
  
  -- Shipping
  shipping_address_id uuid references addresses(id) on delete set null,
  billing_address_id uuid references addresses(id) on delete set null,
  
  -- Shipping Provider
  shiprocket_order_id text,
  shiprocket_shipment_id text,
  courier_name text,
  tracking_id text,
  tracking_url text,
  awb_code text, -- Air Waybill
  
  -- Estimated & Actual Delivery
  estimated_delivery_date date,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  -- Customer Notes
  customer_notes text,
  admin_notes text,
  
  -- Cancellation/Return
  cancelled_at timestamptz,
  cancellation_reason text,
  refund_initiated_at timestamptz,
  refund_completed_at timestamptz,
  refund_amount integer,
  
  -- Invoice
  invoice_number text unique,
  invoice_url text,
  invoice_generated_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  constraint valid_total check (total_amount = subtotal - discount_amount + shipping_charges + cod_charges + gst_amount)
);

-- 8. ORDER ITEMS
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  
  -- Snapshot (for historical accuracy)
  product_name text not null,
  product_sku text not null,
  variant_info jsonb, -- {size, color}
  
  -- Pricing (in paise)
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  discount_amount integer default 0,
  gst_amount integer default 0,
  total_price integer not null check (total_price >= 0),
  
  -- Product snapshot
  product_image_url text,
  
  created_at timestamptz default now() not null
);

-- 9. ORDER LOGS (Activity Trail)
create table if not exists public.order_logs (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  
  status order_status not null,
  note text,
  metadata jsonb, -- extra info like tracking updates
  
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 10. WISHLIST
create table if not exists public.wishlist (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  
  created_at timestamptz default now() not null,
  
  constraint unique_wishlist unique (user_id, product_id)
);

-- 11. CART
create table if not exists public.cart (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  variant_id uuid references product_variants(id) on delete cascade,
  
  quantity integer not null check (quantity > 0),
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  constraint unique_cart_item unique (user_id, product_id, variant_id)
);

-- 12. REVIEWS
create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  order_id uuid references orders(id) on delete set null,
  
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  comment text,
  images jsonb default '[]'::jsonb,
  
  is_verified_purchase boolean default false,
  is_approved boolean default false,
  
  helpful_count integer default 0,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- One review per user per product
  constraint unique_review unique (product_id, user_id)
);

-- 13. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  
  type text not null check (type in (
    'order_confirmed', 'order_shipped', 'order_delivered', 
    'order_cancelled', 'payment_failed', 'low_stock', 
    'price_drop', 'back_in_stock', 'promotional'
  )),
  
  title text not null,
  message text not null,
  
  -- Links
  link_type text check (link_type in ('order', 'product', 'category', 'url')),
  link_id uuid,
  link_url text,
  
  -- Delivery channels
  sent_email boolean default false,
  sent_sms boolean default false,
  sent_whatsapp boolean default false,
  sent_push boolean default false,
  
  is_read boolean default false,
  read_at timestamptz,
  
  created_at timestamptz default now() not null
);

-- 14. SETTINGS (Site-wide configuration)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now() not null
);

-- 15. SHIPPING ZONES
create table if not exists public.shipping_zones (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  states text[] not null, -- Indian states
  
  -- Pricing
  base_charge integer not null, -- in paise
  per_kg_charge integer default 0,
  free_shipping_threshold integer, -- free shipping above this amount
  
  -- Delivery
  estimated_days_min integer default 3,
  estimated_days_max integer default 7,
  
  cod_available boolean default true,
  cod_charge integer default 5000, -- ₹50 in paise
  
  is_active boolean default true,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 16. ABANDONED CARTS (For remarketing)
create table if not exists public.abandoned_carts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  
  cart_items jsonb not null,
  total_amount integer,
  
  -- Remarketing
  email_sent boolean default false,
  email_sent_at timestamptz,
  recovered boolean default false,
  recovered_order_id uuid references orders(id),
  
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '30 days') not null
);

-- 17. COUPON USAGE TRACKING
create table if not exists public.coupon_usage (
  id uuid default uuid_generate_v4() primary key,
  coupon_id uuid references coupons(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  
  discount_applied integer not null,
  
  created_at timestamptz default now() not null
);

-- =============================================
-- INDEXES (Performance Optimization)
-- =============================================

-- Profiles
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_phone on profiles(phone);
create index if not exists idx_profiles_role on profiles(role);

-- Addresses
create index if not exists idx_addresses_user_id on addresses(user_id);
create index if not exists idx_addresses_default on addresses(user_id, is_default) where is_default = true;
create index if not exists idx_addresses_pincode on addresses(pincode);

-- Products
create index if not exists idx_products_slug on products(slug);
create index if not exists idx_products_sku on products(sku);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_active on products(is_active) where is_active = true;
create index if not exists idx_products_featured on products(is_featured) where is_featured = true;
create index if not exists idx_products_price on products(price);
create index if not exists idx_products_stock on products(stock_quantity);
create index if not exists idx_products_name_search on products using gin(name gin_trgm_ops); -- Fuzzy search

-- Product Variants
create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_variants_sku on product_variants(sku);

-- Categories
create index if not exists idx_categories_slug on categories(slug);
create index if not exists idx_categories_parent on categories(parent_id);

-- Orders
create index if not exists idx_orders_user on orders(user_id);
create index if not exists idx_orders_number on orders(order_number);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_orders_razorpay on orders(razorpay_order_id) where razorpay_order_id is not null;

-- Order Items
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

-- Order Logs
create index if not exists idx_order_logs_order on order_logs(order_id);
create index if not exists idx_order_logs_created on order_logs(created_at desc);

-- Wishlist
create index if not exists idx_wishlist_user on wishlist(user_id);
create index if not exists idx_wishlist_product on wishlist(product_id);

-- Cart
create index if not exists idx_cart_user on cart(user_id);
create index if not exists idx_cart_product on cart(product_id);

-- Reviews
create index if not exists idx_reviews_product on reviews(product_id);
create index if not exists idx_reviews_user on reviews(user_id);
create index if not exists idx_reviews_approved on reviews(is_approved) where is_approved = true;

-- Notifications
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id, is_read) where is_read = false;
create index if not exists idx_notifications_created on notifications(created_at desc);

-- Coupons
create index if not exists idx_coupons_code on coupons(code);
create index if not exists idx_coupons_active on coupons(is_active, valid_from, valid_until);

-- =============================================
-- FUNCTIONS
-- =============================================

-- 1. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, 
    full_name, 
    email,
    phone,
    role,
    email_verified
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.phone,
    'customer',
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    email_verified = new.email_confirmed_at is not null,
    updated_at = now();
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Generate unique order number
create or replace function public.generate_order_number()
returns trigger as $$
declare
  new_order_number text;
  counter integer := 0;
begin
  loop
    new_order_number := 'FT' || to_char(now(), 'YYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
    
    -- Check if exists
    if not exists (select 1 from orders where order_number = new_order_number) then
      exit;
    end if;
    
    counter := counter + 1;
    if counter > 10 then
      raise exception 'Could not generate unique order number';
    end if;
  end loop;
  
  new.order_number := new_order_number;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_order_number on orders;
create trigger trg_generate_order_number
  before insert on orders
  for each row
  when (new.order_number is null)
  execute function generate_order_number();

-- 3. Auto-generate SKU for products
create or replace function public.generate_product_sku()
returns trigger as $$
declare
  category_prefix text;
  random_suffix text;
begin
  if new.sku is not null then
    return new;
  end if;
  
  -- Get category prefix (first 3 letters)
  select upper(left(name, 3)) into category_prefix
  from categories where id = new.category_id;
  
  category_prefix := coalesce(category_prefix, 'PRD');
  
  random_suffix := upper(substring(md5(random()::text) from 1 for 6));
  
  new.sku := category_prefix || '-' || random_suffix;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_product_sku on products;
create trigger trg_generate_product_sku
  before insert on products
  for each row
  when (new.sku is null)
  execute function generate_product_sku();

-- 4. Auto-generate variant SKU
create or replace function public.generate_variant_sku()
returns trigger as $$
declare
  base_sku text;
begin
  if new.sku is not null then
    return new;
  end if;
  
  select sku into base_sku from products where id = new.product_id;
  
  new.sku := base_sku || '-' || 
    coalesce(upper(substring(new.size from 1 for 1)), 'X') || 
    coalesce(upper(substring(new.color from 1 for 3)), 'XXX');
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_variant_sku on product_variants;
create trigger trg_generate_variant_sku
  before insert on product_variants
  for each row
  when (new.sku is null)
  execute function generate_variant_sku();

-- 5. Log order status changes
create or replace function public.log_order_status_change()
returns trigger as $$
begin
  -- Status changed
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.order_logs (order_id, status, note, created_by)
    values (
      new.id, 
      new.status, 
      case 
        when tg_op = 'INSERT' then 'Order created'
        else 'Status changed from ' || old.status || ' to ' || new.status
      end,
      auth.uid()
    );
  end if;
  
  -- Update status timestamps
  if new.status = 'shipped' and old.status != 'shipped' then
    new.shipped_at := now();
  elsif new.status = 'delivered' and old.status != 'delivered' then
    new.delivered_at := now();
  elsif new.status = 'cancelled' and old.status != 'cancelled' then
    new.cancelled_at := now();
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_order_status_change on orders;
create trigger trg_log_order_status_change
  after insert or update of status on orders
  for each row execute function log_order_status_change();

-- 6. Update product stock on order
create or replace function public.update_product_stock_on_order()
returns trigger as $$
declare
  item record;
  v_track_inventory boolean;
begin
  if new.status = 'confirmed' and (old.status is null or old.status != 'confirmed') then
    -- Deduct stock
    for item in 
      select product_id, variant_id, quantity 
      from order_items 
      where order_id = new.id
    loop
      -- Check if the product tracks inventory
      select track_inventory into v_track_inventory 
      from products 
      where id = item.product_id;

      if coalesce(v_track_inventory, true) then
        if item.variant_id is not null then
          update product_variants
          set stock_quantity = greatest(0, stock_quantity - item.quantity)
          where id = item.variant_id;
        else
          update products
          set stock_quantity = greatest(0, stock_quantity - item.quantity),
              sales_count = sales_count + item.quantity
          where id = item.product_id;
        end if;
      else
        -- If it doesn't track inventory, we still increment sales_count on products table if variant is null
        if item.variant_id is null then
          update products
          set sales_count = sales_count + item.quantity
          where id = item.product_id;
        end if;
      end if;
    end loop;
  elsif new.status = 'cancelled' and old.status != 'cancelled' then
    -- Restore stock
    for item in 
      select product_id, variant_id, quantity 
      from order_items 
      where order_id = new.id
    loop
      -- Check if the product tracks inventory
      select track_inventory into v_track_inventory 
      from products 
      where id = item.product_id;

      if coalesce(v_track_inventory, true) then
        if item.variant_id is not null then
          update product_variants
          set stock_quantity = stock_quantity + item.quantity
          where id = item.variant_id;
        else
          update products
          set stock_quantity = stock_quantity + item.quantity,
              sales_count = greatest(0, sales_count - item.quantity)
          where id = item.product_id;
        end if;
      else
        -- If it doesn't track inventory, we still adjust sales_count on products table if variant is null
        if item.variant_id is null then
          update products
          set sales_count = greatest(0, sales_count - item.quantity)
          where id = item.product_id;
        end if;
      end if;
    end loop;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_product_stock on orders;
create trigger trg_update_product_stock
  after update of status on orders
  for each row execute function update_product_stock_on_order();

-- 7. Update profile stats on order
create or replace function public.update_profile_stats_on_order()
returns trigger as $$
begin
  if new.status = 'delivered' and (old.status is null or old.status != 'delivered') then
    update profiles
    set 
      total_orders = total_orders + 1,
      total_spent = total_spent + new.total_amount,
      last_order_at = new.delivered_at,
      loyalty_points = loyalty_points + (new.total_amount / 10000) -- 1 point per ₹100
    where id = new.user_id;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_profile_stats on orders;
create trigger trg_update_profile_stats
  after update of status on orders
  for each row execute function update_profile_stats_on_order();

-- 8. Auto-update timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles 
  for each row execute function handle_updated_at();

drop trigger if exists trg_addresses_updated_at on addresses;
create trigger trg_addresses_updated_at before update on addresses 
  for each row execute function handle_updated_at();

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products 
  for each row execute function handle_updated_at();

drop trigger if exists trg_product_variants_updated_at on product_variants;
create trigger trg_product_variants_updated_at before update on product_variants 
  for each row execute function handle_updated_at();

drop trigger if exists trg_categories_updated_at on categories;
create trigger trg_categories_updated_at before update on categories 
  for each row execute function handle_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders 
  for each row execute function handle_updated_at();

drop trigger if exists trg_cart_updated_at on cart;
create trigger trg_cart_updated_at before update on cart 
  for each row execute function handle_updated_at();

drop trigger if exists trg_coupons_updated_at on coupons;
create trigger trg_coupons_updated_at before update on coupons 
  for each row execute function handle_updated_at();

drop trigger if exists trg_reviews_updated_at on reviews;
create trigger trg_reviews_updated_at before update on reviews 
  for each row execute function handle_updated_at();

-- 9. Update product rating on review
create or replace function public.update_product_rating()
returns trigger as $$
begin
  update products
  set 
    rating_avg = (
      select round(avg(rating)::numeric, 2)
      from reviews
      where product_id = new.product_id and is_approved = true
    ),
    rating_count = (
      select count(*)
      from reviews
      where product_id = new.product_id and is_approved = true
    )
  where id = new.product_id;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_product_rating on reviews;
create trigger trg_update_product_rating
  after insert or update of rating, is_approved on reviews
  for each row execute function update_product_rating();

-- 10. Increment coupon usage
create or replace function public.increment_coupon_usage()
returns trigger as $$
begin
  if new.coupon_id is not null then
    update coupons
    set current_uses = current_uses + 1
    where id = new.coupon_id;
    
    -- Log usage
    insert into coupon_usage (coupon_id, user_id, order_id, discount_applied)
    values (new.coupon_id, new.user_id, new.id, new.discount_amount);
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_increment_coupon_usage on orders;
create trigger trg_increment_coupon_usage
  after insert on orders
  for each row 
  when (new.coupon_id is not null)
  execute function increment_coupon_usage();

-- 11. Track cart abandonment
create or replace function public.track_abandoned_cart()
returns void as $$
begin
  insert into abandoned_carts (user_id, cart_items, total_amount)
  select 
    c.user_id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', c.product_id,
        'variant_id', c.variant_id,
        'quantity', c.quantity,
        'product_name', p.name,
        'price', coalesce(pv.price_adjustment + p.price, p.price)
      )
    ) as cart_items,
    sum(c.quantity * coalesce(pv.price_adjustment + p.price, p.price)) as total_amount
  from cart c
  join products p on p.id = c.product_id
  left join product_variants pv on pv.id = c.variant_id
  where c.updated_at < now() - interval '24 hours'
  group by c.user_id
  on conflict (user_id) do update
  set 
    cart_items = excluded.cart_items,
    total_amount = excluded.total_amount,
    created_at = now(),
    expires_at = now() + interval '30 days';
end;
$$ language plpgsql;

-- 12. Ensure only one default address
create or replace function public.ensure_single_default_address()
returns trigger as $$
begin
  if new.is_default = true then
    update addresses
    set is_default = false
    where user_id = new.user_id and id != new.id;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ensure_single_default_address on addresses;
create trigger trg_ensure_single_default_address
  before insert or update of is_default on addresses
  for each row
  when (new.is_default = true)
  execute function ensure_single_default_address();

-- 13. Create notification on order status change
create or replace function public.create_order_notification()
returns trigger as $$
declare
  notification_title text;
  notification_message text;
begin
  -- Define notification content based on status
  case new.status
    when 'confirmed' then
      notification_title := 'Order Confirmed! 🎉';
      notification_message := 'Your order #' || new.order_number || ' has been confirmed.';
    when 'shipped' then
      notification_title := 'Order Shipped! 📦';
      notification_message := 'Your order #' || new.order_number || ' is on its way!';
    when 'delivered' then
      notification_title := 'Order Delivered! ✅';
      notification_message := 'Your order #' || new.order_number || ' has been delivered.';
    when 'cancelled' then
      notification_title := 'Order Cancelled ❌';
      notification_message := 'Your order #' || new.order_number || ' has been cancelled.';
    else
      return new;
  end case;
  
  insert into notifications (
    user_id, 
    type, 
    title, 
    message, 
    link_type, 
    link_id
  )
  values (
    new.user_id,
    'order_' || new.status,
    notification_title,
    notification_message,
    'order',
    new.id
  );
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_create_order_notification on orders;
create trigger trg_create_order_notification
  after update of status on orders
  for each row
  when (new.status is distinct from old.status)
  execute function create_order_notification();

-- 14. Calculate shipping charges
create or replace function public.calculate_shipping_charges(
  p_pincode text,
  p_subtotal integer,
  p_weight_grams integer default 500
)
returns table (
  shipping_charge integer,
  cod_charge integer,
  estimated_days_min integer,
  estimated_days_max integer,
  cod_available boolean
) as $$
declare
  zone record;
begin
  -- Find matching shipping zone
  select * into zone
  from shipping_zones
  where p_pincode = any(
    select unnest(states) -- This is simplified, you'd map PIN to state
  )
  and is_active = true
  limit 1;
  
  if not found then
    -- Default zone
    return query select 
      10000::integer, -- ₹100
      5000::integer,  -- ₹50
      5::integer, 
      10::integer,
      true::boolean;
    return;
  end if;
  
  -- Calculate shipping
  return query select
    case 
      when zone.free_shipping_threshold is not null 
        and p_subtotal >= zone.free_shipping_threshold 
      then 0
      else zone.base_charge + (p_weight_grams / 1000 * zone.per_kg_charge)
    end::integer,
    case when zone.cod_available then zone.cod_charge else 0 end::integer,
    zone.estimated_days_min,
    zone.estimated_days_max,
    zone.cod_available;
end;
$$ language plpgsql;

-- 15. Validate coupon
create or replace function public.validate_coupon(
  p_code text,
  p_user_id uuid,
  p_subtotal integer,
  p_product_ids uuid[] default null
)
returns table (
  is_valid boolean,
  discount_amount integer,
  message text,
  coupon_id uuid
) as $$
declare
  v_coupon record;
  v_usage_count integer;
  v_discount integer;
begin
  -- Get coupon
  select * into v_coupon
  from coupons
  where code = upper(p_code)
    and is_active = true
    and valid_from <= now()
    and (valid_until is null or valid_until >= now());
  
  if not found then
    return query select false, 0, 'Invalid or expired coupon', null::uuid;
    return;
  end if;
  
  -- Check min order value
  if p_subtotal < v_coupon.min_order_value then
    return query select 
      false, 
      0, 
      'Minimum order value of ₹' || (v_coupon.min_order_value / 100) || ' required',
      null::uuid;
    return;
  end if;
  
  -- Check max uses
  if v_coupon.max_uses is not null and v_coupon.current_uses >= v_coupon.max_uses then
    return query select false, 0, 'Coupon usage limit reached', null::uuid;
    return;
  end if;
  
  -- Check per-user limit
  select count(*) into v_usage_count
  from coupon_usage
  where coupon_id = v_coupon.id and user_id = p_user_id;
  
  if v_usage_count >= v_coupon.max_uses_per_user then
    return query select false, 0, 'You have already used this coupon', null::uuid;
    return;
  end if;
  
  -- Calculate discount
  if v_coupon.discount_type = 'percentage' then
    v_discount := (p_subtotal * v_coupon.discount_value / 100);
    if v_coupon.max_discount_amount is not null then
      v_discount := least(v_discount, v_coupon.max_discount_amount);
    end if;
  else
    v_discount := v_coupon.discount_value;
  end if;
  
  return query select 
    true, 
    v_discount, 
    'Coupon applied successfully! You saved ₹' || (v_discount / 100),
    v_coupon.id;
end;
$$ language plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table categories enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_logs enable row level security;
alter table wishlist enable row level security;
alter table cart enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;
alter table coupons enable row level security;
alter table coupon_usage enable row level security;
alter table shipping_zones enable row level security;
alter table abandoned_carts enable row level security;
alter table settings enable row level security;

-- Helper function to check admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles 
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- PROFILES
drop policy if exists "Users view own profile" on profiles;
drop policy if exists "Users update own profile" on profiles;
drop policy if exists "Admin full access to profiles" on profiles;

create policy "Users view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Admin full access to profiles" on profiles
  for all using (is_admin());

-- ADDRESSES
drop policy if exists "Users manage own addresses" on addresses;
drop policy if exists "Admin full access to addresses" on addresses;

create policy "Users manage own addresses" on addresses
  for all using (auth.uid() = user_id);

create policy "Admin full access to addresses" on addresses
  for all using (is_admin());

-- PRODUCTS (Public read, admin write)
drop policy if exists "Public read active products" on products;
drop policy if exists "Admin full access to products" on products;

create policy "Public read active products" on products
  for select using (is_active = true);

create policy "Admin full access to products" on products
  for all using (is_admin());

-- PRODUCT VARIANTS
drop policy if exists "Public read active variants" on product_variants;
drop policy if exists "Admin full access to variants" on product_variants;

create policy "Public read active variants" on product_variants
  for select using (
    is_active = true and 
    exists (select 1 from products where id = product_id and is_active = true)
  );

create policy "Admin full access to variants" on product_variants
  for all using (is_admin());

-- CATEGORIES
drop policy if exists "Public read active categories" on categories;
drop policy if exists "Admin full access to categories" on categories;

create policy "Public read active categories" on categories
  for select using (is_active = true);

create policy "Admin full access to categories" on categories
  for all using (is_admin());

-- ORDERS
drop policy if exists "Users view own orders" on orders;
drop policy if exists "Users create own orders" on orders;
drop policy if exists "Admin full access to orders" on orders;

create policy "Users view own orders" on orders
  for select using (auth.uid() = user_id);

create policy "Users create own orders" on orders
  for insert with check (auth.uid() = user_id);

create policy "Admin full access to orders" on orders
  for all using (is_admin());

-- ORDER ITEMS
drop policy if exists "Users view own order items" on order_items;
drop policy if exists "Admin full access to order items" on order_items;

create policy "Users view own order items" on order_items
  for select using (
    exists (select 1 from orders where id = order_id and user_id = auth.uid())
  );

create policy "Admin full access to order items" on order_items
  for all using (is_admin());

-- ORDER LOGS
drop policy if exists "Users view own order logs" on order_logs;
drop policy if exists "Admin full access to order logs" on order_logs;

create policy "Users view own order logs" on order_logs
  for select using (
    exists (select 1 from orders where id = order_id and user_id = auth.uid())
  );

create policy "Admin full access to order logs" on order_logs
  for all using (is_admin());

-- WISHLIST
drop policy if exists "Users manage own wishlist" on wishlist;

create policy "Users manage own wishlist" on wishlist
  for all using (auth.uid() = user_id);

-- CART
drop policy if exists "Users manage own cart" on cart;

create policy "Users manage own cart" on cart
  for all using (auth.uid() = user_id);

-- REVIEWS
drop policy if exists "Public read approved reviews" on reviews;
drop policy if exists "Users manage own reviews" on reviews;
drop policy if exists "Admin full access to reviews" on reviews;

create policy "Public read approved reviews" on reviews
  for select using (is_approved = true);

create policy "Users manage own reviews" on reviews
  for all using (auth.uid() = user_id);

create policy "Admin full access to reviews" on reviews
  for all using (is_admin());

-- NOTIFICATIONS
drop policy if exists "Users manage own notifications" on notifications;
drop policy if exists "Admin full access to notifications" on notifications;

create policy "Users manage own notifications" on notifications
  for all using (auth.uid() = user_id);

create policy "Admin full access to notifications" on notifications
  for all using (is_admin());

-- COUPONS (Public read active, admin write)
drop policy if exists "Public read active coupons" on coupons;
drop policy if exists "Admin full access to coupons" on coupons;

create policy "Public read active coupons" on coupons
  for select using (
    is_active = true and 
    valid_from <= now() and 
    (valid_until is null or valid_until >= now())
  );

create policy "Admin full access to coupons" on coupons
  for all using (is_admin());

-- COUPON USAGE
drop policy if exists "Users view own coupon usage" on coupon_usage;
drop policy if exists "Admin full access to coupon usage" on coupon_usage;

create policy "Users view own coupon usage" on coupon_usage
  for select using (auth.uid() = user_id);

create policy "Admin full access to coupon usage" on coupon_usage
  for all using (is_admin());

-- SHIPPING ZONES (Public read)
drop policy if exists "Public read shipping zones" on shipping_zones;
drop policy if exists "Admin full access to shipping zones" on shipping_zones;

create policy "Public read shipping zones" on shipping_zones
  for select using (is_active = true);

create policy "Admin full access to shipping zones" on shipping_zones
  for all using (is_admin());

-- ABANDONED CARTS
drop policy if exists "Users view own abandoned carts" on abandoned_carts;
drop policy if exists "Admin full access to abandoned carts" on abandoned_carts;

create policy "Users view own abandoned carts" on abandoned_carts
  for select using (auth.uid() = user_id);

create policy "Admin full access to abandoned carts" on abandoned_carts
  for all using (is_admin());

-- SETTINGS (Public read, admin write)
drop policy if exists "Public read settings" on settings;
drop policy if exists "Admin full access to settings" on settings;

create policy "Public read settings" on settings
  for select using (true);

create policy "Admin full access to settings" on settings
  for all using (is_admin());

-- =============================================
-- SEED DATA
-- =============================================

-- Default Settings
insert into settings (key, value, description) values
  ('site_name', '"French Toes"', 'Store name'),
  ('site_description', '"Premium slippers for comfort & style"', 'Store description'),
  ('currency', '"INR"', 'Default currency'),
  ('currency_symbol', '"₹"', 'Currency symbol'),
  ('timezone', '"Asia/Kolkata"', 'Store timezone'),
  ('default_language', '"en"', 'Default language'),
  ('cod_enabled', 'true', 'Cash on Delivery enabled'),
  ('min_order_value', '0', 'Minimum order value in paise'),
  ('free_shipping_threshold', '50000', 'Free shipping above ₹500'),
  ('gst_enabled', 'true', 'GST enabled'),
  ('default_gst_rate', '5', 'Default GST rate'),
  ('order_cancellation_window', '24', 'Hours within which order can be cancelled'),
  ('return_window', '7', 'Days for return'),
  ('low_stock_threshold', '5', 'Low stock alert threshold'),
  ('razorpay_enabled', 'true', 'Razorpay payment gateway'),
  ('shiprocket_enabled', 'true', 'Shiprocket shipping'),
  ('whatsapp_notifications', 'true', 'WhatsApp order updates'),
  ('email_notifications', 'true', 'Email order updates'),
  ('sms_notifications', 'true', 'SMS order updates')
on conflict (key) do nothing;

-- Default Shipping Zones
insert into shipping_zones (name, states, base_charge, free_shipping_threshold, estimated_days_min, estimated_days_max) values
  ('North India', array['Delhi', 'Haryana', 'Punjab', 'Uttar Pradesh', 'Himachal Pradesh', 'Uttarakhand', 'Jammu and Kashmir'], 5000, 50000, 2, 4),
  ('South India', array['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana'], 7000, 50000, 3, 5),
  ('West India', array['Maharashtra', 'Gujarat', 'Rajasthan', 'Goa'], 6000, 50000, 2, 4),
  ('East India', array['West Bengal', 'Odisha', 'Bihar', 'Jharkhand'], 7000, 50000, 3, 5),
  ('Northeast India', array['Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Arunachal Pradesh', 'Sikkim'], 10000, 50000, 5, 7)
on conflict do nothing;

-- Sample Categories
insert into categories (slug, name, description, display_order) values
  ('slippers', 'Slippers', 'Comfortable everyday slippers', 1),
  ('flip-flops', 'Flip Flops', 'Casual flip flops', 2),
  ('slides', 'Slides', 'Easy slip-on slides', 3),
  ('limited-edition', 'Limited Edition', 'Exclusive limited releases', 4),
  ('best-sellers', 'Best Sellers', 'Our most popular products', 5)
on conflict (slug) do nothing;

-- =============================================
-- VIEWS FOR EASY QUERYING
-- =============================================

-- Complete user profile with stats
create or replace view user_profiles_complete as
select 
  p.id,
  p.role,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.preferred_language,
  p.currency,
  p.timezone,
  p.email_verified,
  p.phone_verified,
  p.marketing_consent,
  p.whatsapp_updates,
  p.last_login_at,
  p.last_order_at,
  p.total_orders,
  p.total_spent,
  p.loyalty_points,
  p.created_at,
  p.updated_at,
  (
    select count(*) 
    from orders o 
    where o.user_id = p.id and o.status = 'delivered'
  ) as completed_orders,
  (
    select count(*) 
    from reviews r 
    where r.user_id = p.id
  ) as reviews_count,
  (
    select count(*) 
    from wishlist w 
    where w.user_id = p.id
  ) as wishlist_count,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'label', a.label,
        'full_name', a.full_name,
        'phone', a.phone,
        'address', a.address_line1 || ', ' || a.city || ', ' || a.state || ' - ' || a.pincode,
        'is_default', a.is_default
      )
    )
    from addresses a
    where a.user_id = p.id
  ) as addresses
from profiles p;

-- Products with full details
create or replace view products_complete as
select 
  p.id,
  p.sku,
  p.slug,
  p.name,
  p.description,
  p.short_description,
  p.price,
  p.original_price,
  p.cost_price,
  p.gst_percentage,
  p.hsn_code,
  p.category_id,
  p.colors,
  p.sizes,
  p.material,
  p.highlights,
  p.care_instructions,
  p.images,
  p.thumbnail_url,
  p.stock_quantity,
  p.low_stock_threshold,
  p.track_inventory,
  p.is_active,
  p.is_featured,
  p.is_new_arrival,
  p.is_limited_edition,
  p.is_best_seller,
  p.allow_backorder,
  p.weight_grams,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.meta_title,
  p.meta_description,
  p.meta_keywords,
  p.views_count,
  p.sales_count,
  p.rating_avg,
  p.rating_count,
  p.created_at,
  p.updated_at,
  c.name as category_name,
  c.slug as category_slug,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'sku', pv.sku,
        'size', pv.size,
        'color', pv.color,
        'stock', pv.stock_quantity,
        'price', p.price + pv.price_adjustment
      )
    )
    from product_variants pv
    where pv.product_id = p.id and pv.is_active = true
  ) as variants,
  case 
    when p.stock_quantity <= 0 then 'out'
    when p.stock_quantity <= p.low_stock_threshold then 'low'
    else 'in_stock'
  end as stock_status
from products p
left join categories c on c.id = p.category_id;

-- Orders with complete details
create or replace view orders_complete as
select 
  o.id,
  o.order_number,
  o.user_id,
  o.status,
  o.payment_status,
  o.payment_method,
  o.subtotal,
  o.discount_amount,
  o.shipping_charges,
  o.cod_charges,
  o.gst_amount,
  o.total_amount,
  o.coupon_id,
  o.coupon_code,
  o.razorpay_order_id,
  o.razorpay_payment_id,
  o.razorpay_signature,
  o.payment_gateway_response,
  o.payment_attempted_at,
  o.payment_completed_at,
  o.shipping_address_id,
  o.billing_address_id,
  o.shiprocket_order_id,
  o.shiprocket_shipment_id,
  o.courier_name,
  o.tracking_id,
  o.tracking_url,
  o.awb_code,
  o.estimated_delivery_date,
  o.shipped_at,
  o.delivered_at,
  o.customer_notes,
  o.admin_notes,
  o.cancelled_at,
  o.cancellation_reason,
  o.refund_initiated_at,
  o.refund_completed_at,
  o.refund_amount,
  o.invoice_number,
  o.invoice_url,
  o.invoice_generated_at,
  o.created_at,
  o.updated_at,
  p.full_name as customer_name,
  p.email as customer_email,
  p.phone as customer_phone,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'sku', oi.product_sku,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total', oi.total_price,
        'image', oi.product_image_url
      )
    )
    from order_items oi
    where oi.order_id = o.id
  ) as items,
  (
    select jsonb_agg(
      jsonb_build_object(
        'status', ol.status,
        'note', ol.note,
        'created_at', ol.created_at
      ) order by ol.created_at desc
    )
    from order_logs ol
    where ol.order_id = o.id
  ) as logs
from orders o
left join profiles p on p.id = o.user_id;

-- =============================================
-- USEFUL QUERIES FOR ADMIN DASHBOARD
-- =============================================

-- Sales analytics
create or replace view sales_analytics as
select 
  date_trunc('day', created_at) as date,
  count(*) as order_count,
  sum(total_amount) as total_revenue,
  avg(total_amount) as avg_order_value,
  count(distinct user_id) as unique_customers
from orders
where status not in ('cancelled', 'refunded')
group by date_trunc('day', created_at)
order by date desc;

-- Top selling products
create or replace view top_products as
select 
  p.id,
  p.name,
  p.sku,
  p.sales_count,
  p.rating_avg,
  p.price,
  p.stock_quantity
from products p
where p.is_active = true
order by p.sales_count desc
limit 20;

-- Low stock alerts
create or replace view low_stock_products as
select 
  p.id,
  p.name,
  p.sku,
  p.stock_quantity,
  p.low_stock_threshold
from products p
where 
  p.is_active = true and 
  p.track_inventory = true and
  p.stock_quantity <= p.low_stock_threshold
order by p.stock_quantity asc;
-- =============================================
-- USEFUL QUERIES FOR ADMIN DASHBOARD
-- =============================================

-- Sales analytics
create or replace view sales_analytics as
select 
  date_trunc('day', created_at) as date,
  count(*) as order_count,
  sum(total_amount) as total_revenue,
  avg(total_amount) as avg_order_value,
  count(distinct user_id) as unique_customers
from orders
where status not in ('cancelled', 'refunded')
group by date_trunc('day', created_at)
order by date desc;

-- Top selling products
create or replace view top_products as
select 
  p.id,
  p.name,
  p.sku,
  p.sales_count,
  p.rating_avg,
  p.price,
  p.stock_quantity
from products p
where p.is_active = true
order by p.sales_count desc
limit 20;

-- Low stock alerts
create or replace view low_stock_products as
select 
  p.id,
  p.name,
  p.sku,
  p.stock_quantity,
  p.low_stock_threshold
from products p
where 
  p.is_active = true and 
  p.track_inventory = true and
  p.stock_quantity <= p.low_stock_threshold
order by p.stock_quantity asc;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all functions in schema public to authenticated;

grant select on all tables in schema public to anon;
grant select on settings, products, product_variants, categories, shipping_zones, coupons to anon;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

comment on table profiles is 'User profiles with extended information and stats';
comment on table addresses is 'User shipping and billing addresses';
comment on table products is 'Product catalog with full details';
comment on table product_variants is 'Product size/color variations';
comment on table orders is 'Customer orders with payment and shipping';
comment on table order_items is 'Line items in orders';
comment on table order_logs is 'Order status change audit trail';
comment on table reviews is 'Product reviews and ratings';
comment on table cart is 'Shopping cart items';
comment on table wishlist is 'User wishlists';
comment on table coupons is 'Promotional discount coupons';
comment on table notifications is 'User notifications across channels';
comment on table shipping_zones is 'Shipping rates by region';
comment on table abandoned_carts is 'Cart abandonment tracking for remarketing';

-- =============================================
-- END OF SCHEMA
-- =============================================
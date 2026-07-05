// ─── French Toes — Shared Type Definitions ─────────────────────────────────

// ─── Supabase DB Row Types ────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'customer' | 'admin';
  preferred_language: string | null;
  marketing_consent: boolean;
  whatsapp_updates: boolean;
  total_orders: number;
  total_spent: number;    // paise
  loyalty_points: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: 'Home' | 'Work' | 'Other' | string | null;
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
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
}

export interface SupabaseProductImage {
  url: string;
  alt: string;
  order: number;
}

export interface SupabaseProductColor {
  name: string;
  hex: string;
  image?: string;
}

export interface SupabaseProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  highlights: string[] | null;
  details: string | null;
  materials: string | null;
  care: string | null;
  shipping: string | null;
  price: number;              // paise
  original_price: number | null; // paise
  cost_price: number | null;
  gst_percent: number | null;
  hsn_code: string | null;
  sku: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  images: SupabaseProductImage[] | null;
  colors: SupabaseProductColor[] | null;
  sizes: string[] | null;
  stock_quantity: number;
  track_inventory: boolean;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  low_stock_threshold: number;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_limited_edition: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
}

export interface SupabaseVariant {
  id: string;
  product_id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  price_adjustment: number; // paise delta from base
  stock_quantity: number;
  is_active: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'
  | 'returned';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cod' | 'refunded' | 'partial_refund';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_method: 'cod' | 'razorpay' | 'phonepe' | 'paytm' | 'upi' | null;
  payment_status: PaymentStatus;
  subtotal: number;             // paise
  discount_amount: number;      // paise
  shipping_charges: number;     // paise
  cod_charges: number;          // paise
  gst_amount: number;           // paise
  total_amount: number;         // paise
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
  cancellation_status?: 'none' | 'pending' | 'approved' | 'rejected';
  // Razorpay fields
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_gateway_response: Record<string, unknown> | null;
  payment_completed_at: string | null;
  created_at: string;
  updated_at: string;
  // joined / computed fields:
  shipping_address?: Address;
  billing_address?: Address;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: OrderItem[];
  logs?: OrderLog[];
  profile?: { full_name: string | null; email: string | null; phone: string | null };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_info: Record<string, string> | null; // {size, color}
  unit_price: number;   // paise
  quantity: number;
  total_price: number;  // paise
  gst_amount: number;   // paise
  product_image_url: string | null;
}

export interface OrderLog {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface CartRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  // joined fields from products_complete:
  product?: SupabaseProduct;
  variant?: SupabaseVariant;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  // joined:
  product?: SupabaseProduct;
}

export interface DBReview {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
  // joined:
  reviewer_name?: string;
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
  base_charge: number;              // paise
  per_kg_charge: number;            // paise
  free_shipping_threshold: number | null; // paise
  estimated_days_min: number;
  estimated_days_max: number;
  cod_available: boolean;
  cod_charge: number;               // paise
}

export interface SalesAnalytics {
  today_revenue: number;
  today_orders: number;
  week_revenue: number;
  week_orders: number;
  month_revenue: number;
  month_orders: number;
  avg_order_value: number;
  unique_customers: number;
}

// ─── Frontend types (UI) ──────────────────────────────────────────────────────

export interface ColorVariant {
  name: string;      // e.g. "Blush", "Peach"
  hex: string;       // CSS hex for swatch display
  image?: string;    // optional per-color product image
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price: number;           // current price in INR
  originalPrice?: number;  // if on sale
  images: string[];        // image URLs (first = primary)
  colors: ColorVariant[];
  sizes: number[];         // Indian sizes 36–42
  availableSizes?: number[]; // subset that is in stock
  badges: Badge[];
  rating: number;          // 4.0–5.0
  reviewCount: number;
  description: string;
  highlights: string[];
  details: string;
  materials: string;
  care: string;
  shipping: string;
  isNew?: boolean;
}

export type Badge = 'Limited Edition' | 'Best Seller' | 'New Arrival' | 'Sale';

export interface CartItem {
  id: string;          // unique cart entry id (productId + color + size)
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  color: ColorVariant;
  size: number;
  quantity: number;
}

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
}

export interface Review {
  id: string;
  author: string;
  city: string;
  rating: number;
  text: string;
  date: string;
  avatar?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
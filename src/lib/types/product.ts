// ─── Product, Variant, and Image Types ──────────────────────────────────────

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface DBProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  base_price: number; // numeric (e.g. 999.00) discounted / selling price
  compare_at_price: number | null; // numeric (e.g. 1499.00) regular / original MRP
  sizes?: string[]; // e.g. ['36', '37', '38', '39', '40', '41']
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface VariantAttributes {
  size_stock?: Record<string, number>; // e.g. { '36': 10, '37': 15, '38': 20, '39': 0 }
  [key: string]: any;
}

export interface DBProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color_name: string;
  color_slug: string;
  color_hex: string | null;
  attributes: VariantAttributes;
  price_override: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  is_default: boolean;
  position: number;
  created_at: string;
}

export interface DBProductImage {
  id: string;
  variant_id: string;
  imagekit_file_id: string;
  image_url: string;
  file_name: string;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
}

/** Product variant populated with its image list */
export interface ProductVariantWithImages extends DBProductVariant {
  images: DBProductImage[];
}

/** Complete product aggregate model with variants and images */
export interface CompleteProduct extends DBProduct {
  variants: ProductVariantWithImages[];
}

/** Helper to generate ImageKit transformed URLs */
export function getImageKitUrl(url: string, transform: string): string {
  if (!url) return '';
  if (!url.includes('ik.imagekit.io')) return url;
  
  // If already has transformation query or path
  if (url.includes('?tr=')) {
    return `${url.split('?tr=')[0]}?tr=${transform}`;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=${transform}`;
}

/** Helper to format price in INR */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

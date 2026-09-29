// ─── Products API — Dynamic Supabase Queries ─────────────────────────────────
import { supabase } from '$lib/supabaseClient';
import type { SupabaseProduct, Category, ColorVariant } from '$lib/types';

export interface ProductFilters {
  category_slug?: string;
  colors?: string[];
  sizes?: string[];
  min_price?: number;   // rupees or paise
  max_price?: number;   // rupees or paise
  is_best_seller?: boolean;
  is_new_arrival?: boolean;
  is_limited_edition?: boolean;
  is_on_sale?: boolean;
  search?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'featured';
}

/** Convert paise to ₹ string */
export function paiseToRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Convert ₹ number to paise */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Map DB product row with variants and images to SupabaseProduct model */
export function mapDBProductToFrontend(row: any): SupabaseProduct {
  const variants = (row.variants || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  const defaultVar = variants.find((v: any) => v.is_default) || variants[0];

  const allImages: string[] = [];
  const imageDetails: any[] = [];

  for (const v of variants) {
    const vImages = (v.images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    for (const img of vImages) {
      if (img.image_url) {
        allImages.push(img.image_url);
        imageDetails.push({
          url: img.image_url,
          alt: img.alt_text || row.name,
          order: img.position ?? 0,
          color: v.color_name,
          is_primary: img.is_primary
        });
      }
    }
  }

  const colors: ColorVariant[] = variants.map((v: any) => {
    const primaryImg = (v.images || []).find((img: any) => img.is_primary) || (v.images || [])[0];
    return {
      name: v.color_name,
      hex: v.color_hex || '#f4a7c3',
      image: primaryImg?.image_url || undefined
    };
  });

  const basePriceRupees = Math.round(Number(row.base_price || (row.price ? row.price / 100 : 0)));
  const compareAtPriceRupees = row.compare_at_price != null && !isNaN(Number(row.compare_at_price))
    ? Math.round(Number(row.compare_at_price))
    : (row.original_price != null ? Math.round(Number(row.original_price) / (Number(row.original_price) > 10000 ? 100 : 1)) : null);
  const totalStock = variants.reduce((acc: number, v: any) => acc + (Number(v.stock_quantity) || 0), 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || row.brand || 'French Toes',
    brand: row.brand || 'French Toes',
    category_id: row.category ? row.category.toLowerCase().replace(/\s+/g, '-') : null,
    category_name: row.category || 'Footwear',
    category_slug: row.category ? row.category.toLowerCase().replace(/\s+/g, '-') : 'footwear',
    description: row.description || '',
    highlights: row.highlights || [
      'Handcrafted with premium materials',
      'Ultra-comfortable cushioned footbed',
      'Designed for effortless all-day elegance'
    ],
    details: row.details || row.description || '',
    materials: row.materials || 'Premium vegan leather, ergonomic sole',
    care: row.care || 'Wipe clean with a damp cloth',
    shipping: row.shipping || 'Free express shipping across India',
    price: basePriceRupees * 100, // in paise for legacy format
    original_price: compareAtPriceRupees && compareAtPriceRupees > basePriceRupees ? compareAtPriceRupees * 100 : null,
    cost_price: row.cost_price || null,
    gst_percent: 5,
    hsn_code: '6404',
    sku: defaultVar?.sku || row.slug,
    images: imageDetails,
    thumbnail_url: defaultVar?.images?.[0]?.image_url || allImages[0] || '',
    colors: colors,
    sizes: Array.isArray(row.sizes) && row.sizes.length > 0 ? row.sizes : ['36', '37', '38', '39', '40', '41'],
    stock_quantity: totalStock,
    track_inventory: true,
    stock_status: totalStock > 0 ? 'in_stock' : 'out_of_stock',
    low_stock_threshold: 10,
    rating_avg: row.rating_avg || 4.8,
    rating_count: row.rating_count || 12,
    is_active: row.status === 'published' || row.is_active === true,
    is_featured: row.is_featured || false,
    is_best_seller: row.is_best_seller || false,
    is_new_arrival: row.is_new_arrival || false,
    is_limited_edition: row.is_limited_edition || false,
    seo_title: row.name,
    seo_description: row.description,
    variants: variants,
    created_at: row.created_at
  };
}

/** Dynamically fetch all distinct categories present in published products */
export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data: prodData } = await supabase
      .from('products')
      .select('category')
      .eq('status', 'published');

    const catSet = new Set<string>();
    for (const p of prodData || []) {
      if (p.category && p.category.trim()) {
        catSet.add(p.category.trim());
      }
    }

    // Also check categories table
    const { data: catRows } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true);

    for (const c of catRows || []) {
      if (c.name && c.name.trim()) {
        catSet.add(c.name.trim());
      }
    }

    if (catSet.size === 0) {
      ['Slippers', 'Flats', 'Heels', 'Sandals', 'Loafers', 'Mules'].forEach(c => catSet.add(c));
    }

    return Array.from(catSet).map(name => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description: null,
      image_url: null,
      is_active: true
    }));
  } catch (err) {
    console.error('[API] fetchCategories error:', err);
    return [];
  }
}

/** Dynamically fetch all distinct color variants present in database */
export async function fetchDynamicColors(): Promise<ColorVariant[]> {
  try {
    const { data } = await supabase
      .from('product_variants')
      .select('color_name, color_hex, color_slug');

    const colorMap = new Map<string, ColorVariant>();
    for (const item of data || []) {
      const name = item.color_name?.trim();
      if (name && !colorMap.has(name.toLowerCase())) {
        colorMap.set(name.toLowerCase(), {
          name,
          hex: item.color_hex || '#f4a7c3'
        });
      }
    }
    return Array.from(colorMap.values());
  } catch (err) {
    console.error('[API] fetchDynamicColors error:', err);
    return [];
  }
}

/** Fetch published products dynamically from database */
export async function fetchProducts(filters: ProductFilters = {}): Promise<SupabaseProduct[]> {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(
          *,
          images:product_images(*)
        )
      `)
      .eq('status', 'published');

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    // Sort
    switch (filters.sort) {
      case 'price_asc':  query = query.order('base_price', { ascending: true }); break;
      case 'price_desc': query = query.order('base_price', { ascending: false }); break;
      case 'newest':     query = query.order('created_at', { ascending: false }); break;
      default:           query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] fetchProducts query error:', error);
      return [];
    }

    let mapped = (data || []).map(mapDBProductToFrontend);

    // Apply in-memory filters for categories, colors, price
    if (filters.category_slug) {
      const catSlug = filters.category_slug.toLowerCase();
      mapped = mapped.filter(p => p.category_slug === catSlug || p.category_name?.toLowerCase() === catSlug);
    }

    if (filters.colors && filters.colors.length > 0) {
      const filterColorsLower = filters.colors.map(c => c.toLowerCase());
      mapped = mapped.filter(p => 
        p.colors?.some(c => filterColorsLower.includes(c.name.toLowerCase()))
      );
    }

    if (filters.min_price !== undefined) {
      const min = filters.min_price > 10000 ? filters.min_price : filters.min_price * 100;
      mapped = mapped.filter(p => p.price >= min);
    }

    if (filters.max_price !== undefined) {
      const max = filters.max_price > 10000 ? filters.max_price : filters.max_price * 100;
      mapped = mapped.filter(p => p.price <= max);
    }

    return mapped;
  } catch (error) {
    console.error('[API] fetchProducts exception:', error);
    return [];
  }
}

/** Fetch single product by slug */
export async function fetchProductBySlug(slug: string): Promise<SupabaseProduct | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(
          *,
          images:product_images(*)
        )
      `)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapDBProductToFrontend(data);
  } catch (error) {
    console.error('[API] fetchProductBySlug exception:', error);
    return null;
  }
}

export async function fetchProductVariants(productId: string) {
  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, images:product_images(*)')
      .eq('product_id', productId)
      .order('position', { ascending: true });

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchRelatedProducts(currentId: string, _categoryId: string | null, limit = 4): Promise<SupabaseProduct[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(
          *,
          images:product_images(*)
        )
      `)
      .eq('status', 'published')
      .neq('id', currentId)
      .limit(limit);

    if (error || !data) return [];
    return data.map(mapDBProductToFrontend);
  } catch {
    return [];
  }
}

export async function fetchApprovedReviews(productId: string) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function submitReview(review: {
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  order_id?: string;
  is_verified_purchase?: boolean;
}) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      product_id: review.product_id,
      user_id: review.user_id,
      rating: review.rating,
      title: review.title,
      comment: review.body,
      is_verified_purchase: review.is_verified_purchase ?? false,
      is_approved: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkVerifiedPurchase(productId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('id, orders!inner(user_id, status)')
      .eq('product_id', productId)
      .eq('orders.user_id', userId)
      .eq('orders.status', 'delivered')
      .limit(1);

    if (error || !data?.length) return false;
    return true;
  } catch {
    return false;
  }
}

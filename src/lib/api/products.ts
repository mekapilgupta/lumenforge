// ─── Products API — Supabase queries ─────────────────────────────────────────
import { supabase } from '$lib/supabaseClient';
import type { SupabaseProduct, Category } from '$lib/types';

export interface ProductFilters {
  category_slug?: string;
  colors?: string[];
  sizes?: string[];
  min_price?: number;   // paise
  max_price?: number;   // paise
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

export async function fetchCategories(): Promise<Category[]> {
  console.log('[FUNCTION] Entering fetchCategories');
  try {
    const params = {};
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'categories', filters: { is_active: true } });
    
    const { data, error, status } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) {
      console.log('[DB] Query error:', error);
      console.error('[API] fetchCategories error:', error); 
      return []; 
    }
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchCategories');
    return data ?? [];
  } catch (error) {
    console.log('[ERROR] in fetchCategories:', error);
    return [];
  }
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<SupabaseProduct[]> {
  console.log('[FUNCTION] Entering fetchProducts');
  console.log('[TYPE CHECK] typeof filters:', typeof filters);
  try {
    const params = { filters };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'products_complete', filters });
    
    let query = supabase.from('products_complete').select('*').eq('is_active', true);

    if (filters.is_best_seller) query = query.eq('is_best_seller', true);
    if (filters.is_new_arrival) query = query.eq('is_new_arrival', true);
    if (filters.is_limited_edition) query = query.eq('is_limited_edition', true);
    if (filters.is_on_sale) query = query.not('original_price', 'is', null);
    if (filters.category_slug) query = query.eq('category_slug', filters.category_slug);
    if (filters.min_price !== undefined) query = query.gte('price', filters.min_price);
    if (filters.max_price !== undefined) query = query.lte('price', filters.max_price);
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    // Color filter via product_variants table
    if (filters.colors?.length) {
      console.log('[API] fetchProducts: filtering by colors:', filters.colors);
      console.log('[DB] Query started:', { params: { colors: filters.colors } });
      console.log('[SUPABASE] Query:', { table: 'product_variants', filters: { colors: filters.colors } });
      
      const { data: variantMatches, error: varError, status: varStatus } = await supabase
        .from('product_variants')
        .select('product_id')
        .in('color', filters.colors)
        .eq('is_active', true);

      console.log('[SUPABASE] Response:', { data: variantMatches, error: varError, status: varStatus });
      if (varError) {
        console.log('[DB] Query error:', varError);
        console.error('[API] fetchProducts color filter query error:', varError);
      } else {
        console.log('[DB] Query result:', variantMatches);
      }

      const ids = [...new Set(variantMatches?.map(v => v.product_id) ?? [])];
      console.log('[API] fetchProducts color filter matched product IDs:', ids);
      if (ids.length) {
        query = query.in('id', ids);
      } else {
        console.warn('[API] fetchProducts: no product IDs matched the color filters. Returning empty.');
        console.log('[FUNCTION] Exiting fetchProducts (empty color match)');
        return []; // No products match the color filter
      }
    }

    // Sort
    switch (filters.sort) {
      case 'price_asc':  query = query.order('price', { ascending: true }); break;
      case 'price_desc': query = query.order('price', { ascending: false }); break;
      case 'newest':     query = query.order('created_at', { ascending: false }); break;
      case 'rating':     query = query.order('rating_avg', { ascending: false }); break;
      default:           query = query.order('is_best_seller', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error, status } = await query;
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) { 
      console.log('[DB] Query error:', error);
      console.error('[API] fetchProducts error:', error); 
      return []; 
    }
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchProducts');
    return data ?? [];
  } catch (error) {
    console.log('[ERROR] in fetchProducts:', error);
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<SupabaseProduct | null> {
  console.log('[FUNCTION] Entering fetchProductBySlug');
  console.log('[TYPE CHECK] typeof slug:', typeof slug);
  try {
    const params = { slug };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'products_complete', filters: { slug, is_active: true } });
    
    const { data, error, status } = await supabase
      .from('products_complete')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
      
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) { 
      console.log('[DB] Query error:', error);
      console.error(`[API] fetchProductBySlug error for slug "${slug}":`, error);
      return null; 
    }
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchProductBySlug');
    return data;
  } catch (error) {
    console.log('[ERROR] in fetchProductBySlug:', error);
    return null;
  }
}

export async function fetchProductVariants(productId: string) {
  console.log('[FUNCTION] Entering fetchProductVariants');
  console.log('[TYPE CHECK] typeof productId:', typeof productId);
  try {
    const params = { productId };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'product_variants', filters: { product_id: productId, is_active: true } });
    
    const { data, error, status } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true);
      
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) { 
      console.log('[DB] Query error:', error);
      console.error(`[API] fetchProductVariants error for productId "${productId}":`, error); 
      return []; 
    }
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchProductVariants');
    return data ?? [];
  } catch (error) {
    console.log('[ERROR] in fetchProductVariants:', error);
    return [];
  }
}

export async function fetchRelatedProducts(currentId: string, categoryId: string | null, limit = 4): Promise<SupabaseProduct[]> {
  console.log('[FUNCTION] Entering fetchRelatedProducts');
  console.log('[TYPE CHECK] typeof currentId:', typeof currentId, 'typeof categoryId:', typeof categoryId);
  try {
    const params = { currentId, categoryId, limit };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'products_complete', filters: { currentId, categoryId, limit } });
    
    let query = supabase
      .from('products_complete')
      .select('*')
      .eq('is_active', true)
      .neq('id', currentId)
      .limit(limit);
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    const { data, error, status } = await query;
    console.log('[SUPABASE] Response:', { data, error, status });
    
    if (error || !data?.length) {
      console.log('[DB] Query error or empty data:', error);
      console.warn(`[API] fetchRelatedProducts fallback: query error or empty data. Error:`, error);
      
      // fallback: any other products
      console.log('[DB] Query started (fallback):', { params: { currentId, limit } });
      console.log('[SUPABASE] Query (fallback):', { table: 'products_complete', filters: { currentId, limit } });
      const { data: fallback, error: fallbackError, status: fallbackStatus } = await supabase
        .from('products_complete')
        .select('*')
        .eq('is_active', true)
        .neq('id', currentId)
        .limit(limit);
        
      console.log('[SUPABASE] Response (fallback):', { data: fallback, error: fallbackError, status: fallbackStatus });
      if (fallbackError) {
        console.log('[DB] Query error (fallback):', fallbackError);
        console.error('[API] fetchRelatedProducts fallback query error:', fallbackError);
      } else {
        console.log('[DB] Query result (fallback):', fallback);
      }
      console.log('[FUNCTION] Exiting fetchRelatedProducts (fallback)');
      return fallback ?? [];
    }
    
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchRelatedProducts');
    return data;
  } catch (error) {
    console.log('[ERROR] in fetchRelatedProducts:', error);
    return [];
  }
}

export async function fetchApprovedReviews(productId: string) {
  console.log('[FUNCTION] Entering fetchApprovedReviews');
  console.log('[TYPE CHECK] typeof productId:', typeof productId);
  try {
    const params = { productId };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'reviews', filters: { product_id: productId, is_approved: true } });
    
    const { data, error, status } = await supabase
      .from('reviews')
      .select('*, profiles(full_name)')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
      
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) { 
      console.log('[DB] Query error:', error);
      console.error(`[API] fetchApprovedReviews error for productId "${productId}":`, error);
      return []; 
    }
    console.log('[DB] Query result:', data);
    console.log('[FUNCTION] Exiting fetchApprovedReviews');
    return data ?? [];
  } catch (error) {
    console.log('[ERROR] in fetchApprovedReviews:', error);
    return [];
  }
}

export async function submitReview(params: {
  productId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
}) {
  console.log('[FUNCTION] Entering submitReview');
  console.log('[TYPE CHECK] typeof params:', typeof params);
  try {
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'reviews', action: 'insert', params });
    
    const { error, status } = await supabase.from('reviews').insert({
      product_id: params.productId,
      user_id: params.userId,
      order_id: params.orderId,
      rating: params.rating,
      title: params.title,
      body: params.body,
      is_verified_purchase: params.isVerifiedPurchase,
      is_approved: false,
    });
    
    console.log('[SUPABASE] Response:', { data: null, error, status });
    if (error) {
      console.log('[DB] Query error:', error);
      console.error('[API] submitReview error:', error);
    } else {
      console.log('[DB] Query result: success');
    }
    console.log('[FUNCTION] Exiting submitReview');
    return { error: error?.message ?? null };
  } catch (error) {
    console.log('[ERROR] in submitReview:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkVerifiedPurchase(userId: string, productId: string): Promise<boolean> {
  console.log('[FUNCTION] Entering checkVerifiedPurchase');
  console.log('[TYPE CHECK] typeof userId:', typeof userId, 'typeof productId:', typeof productId);
  try {
    const params = { userId, productId };
    console.log('[DB] Query started:', { params });
    console.log('[SUPABASE] Query:', { table: 'order_items', filters: { product_id: productId, user_id: userId, status: 'delivered' } });
    
    const { data, error, status } = await supabase
      .from('order_items')
      .select('id, orders!inner(user_id, status)')
      .eq('product_id', productId)
      .eq('orders.user_id', userId)
      .eq('orders.status', 'delivered')
      .limit(1);
      
    console.log('[SUPABASE] Response:', { data, error, status });
    if (error) {
      console.log('[DB] Query error:', error);
      console.error('[API] checkVerifiedPurchase query error:', error);
      return false;
    }
    const isVerified = (data?.length ?? 0) > 0;
    console.log('[DB] Query result:', isVerified);
    console.log('[FUNCTION] Exiting checkVerifiedPurchase');
    return isVerified;
  } catch (error) {
    console.log('[ERROR] in checkVerifiedPurchase:', error);
    return false;
  }
}

export async function fetchAllVariantCards(): Promise<VariantCard[]> {
  console.log('[FUNCTION] Entering fetchAllVariantCards');
  try {
    const products = await fetchProducts({});
    console.log('[TYPE CHECK] typeof products:', typeof products, 'isArray:', Array.isArray(products));
    const seen = new Map<string, VariantCard>();

    for (const product of products) {
      const variants = await fetchProductVariants(product.id);
      console.log('[TYPE CHECK] typeof variants:', typeof variants, 'isArray:', Array.isArray(variants));
      
      for (const variant of variants) {
        if (seen.has(variant.id)) continue; // deduplicate by variant id
        const images = (variant.images ?? []).map((img: { url: string }) => img.url);
        seen.set(variant.id, {
          id: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          colorName: variant.color,
          image: images[0] ?? (product.images?.[0] as any)?.url ?? '',
          hoverImage: images[1] ?? (product.images?.[1] as any)?.url ?? null,
          price: product.price + (variant.price_adjustment ?? 0),
          originalPrice: product.original_price ?? null,
          rating: product.rating_avg ?? 0,
          reviewCount: product.rating_count ?? 0,
          badges: [
            ...(product.is_best_seller ? ['Best Seller'] : []),
            ...(product.is_limited_edition ? ['Limited Edition'] : []),
            ...(product.is_new_arrival ? ['New Arrival'] : []),
            ...(product.original_price ? ['Sale'] : []),
          ],
          stockQuantity: variant.stock_quantity ?? 0,
        });
      }
    }

    const result = [...seen.values()];
    console.log('[FUNCTION] Exiting fetchAllVariantCards with count:', result.length);
    return result;
  } catch (error) {
    console.log('[ERROR] in fetchAllVariantCards:', error);
    return [];
  }
}

export async function fetchBestSellerVariantCards(): Promise<VariantCard[]> {
  console.log('[FUNCTION] Entering fetchBestSellerVariantCards');
  try {
    const products = await fetchProducts({ is_best_seller: true });
    console.log('[TYPE CHECK] typeof products:', typeof products, 'isArray:', Array.isArray(products));
    const seen = new Map<string, VariantCard>();

    for (const product of products) {
      const variants = await fetchProductVariants(product.id);
      console.log('[TYPE CHECK] typeof variants:', typeof variants, 'isArray:', Array.isArray(variants));
      
      for (const variant of variants) {
        if (seen.has(variant.id)) continue; // deduplicate by variant id
        const images = (variant.images ?? []).map((img: { url: string }) => img.url);
        seen.set(variant.id, {
          id: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          colorName: variant.color,
          image: images[0] ?? (product.images?.[0] as any)?.url ?? '',
          hoverImage: images[1] ?? (product.images?.[1] as any)?.url ?? null,
          price: product.price + (variant.price_adjustment ?? 0),
          originalPrice: product.original_price ?? null,
          rating: product.rating_avg ?? 0,
          reviewCount: product.rating_count ?? 0,
          badges: ['Best Seller'],
          stockQuantity: variant.stock_quantity ?? 0,
        });
      }
    }

    const result = [...seen.values()];
    console.log('[FUNCTION] Exiting fetchBestSellerVariantCards with count:', result.length);
    return result;
  } catch (error) {
    console.log('[ERROR] in fetchBestSellerVariantCards:', error);
    return [];
  }
}

export async function fetchSaleVariantCards(): Promise<VariantCard[]> {
  console.log('[FUNCTION] Entering fetchSaleVariantCards');
  try {
    const products = await fetchProducts({ is_on_sale: true });
    console.log('[TYPE CHECK] typeof products:', typeof products, 'isArray:', Array.isArray(products));
    const seen = new Map<string, VariantCard>();

    for (const product of products) {
      const variants = await fetchProductVariants(product.id);
      console.log('[TYPE CHECK] typeof variants:', typeof variants, 'isArray:', Array.isArray(variants));
      
      for (const variant of variants) {
        if (seen.has(variant.id)) continue; // deduplicate by variant id
        const images = (variant.images ?? []).map((img: { url: string }) => img.url);
        seen.set(variant.id, {
          id: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          colorName: variant.color,
          image: images[0] ?? (product.images?.[0] as any)?.url ?? '',
          hoverImage: images[1] ?? (product.images?.[1] as any)?.url ?? null,
          price: product.price + (variant.price_adjustment ?? 0),
          originalPrice: product.original_price ?? null,
          rating: product.rating_avg ?? 0,
          reviewCount: product.rating_count ?? 0,
          badges: ['Sale'],
          stockQuantity: variant.stock_quantity ?? 0,
        });
      }
    }

    const result = [...seen.values()];
    console.log('[FUNCTION] fetchSaleVariantCards dynamic loaded count:', result.length);
    console.log('[FUNCTION] Exiting fetchSaleVariantCards (dynamic)');
    return result;
  } catch (error) {
    console.log('[ERROR] in fetchSaleVariantCards:', error);
    return [];
  }
}

export async function fetchNewArrivalVariantCards(): Promise<VariantCard[]> {
  console.log('[FUNCTION] Entering fetchNewArrivalVariantCards');
  try {
    const products = await fetchProducts({ is_new_arrival: true });
    console.log('[TYPE CHECK] typeof products:', typeof products, 'isArray:', Array.isArray(products));
    const seen = new Map<string, VariantCard>();

    for (const product of products) {
      const variants = await fetchProductVariants(product.id);
      console.log('[TYPE CHECK] typeof variants:', typeof variants, 'isArray:', Array.isArray(variants));
      
      for (const variant of variants) {
        if (seen.has(variant.id)) continue; // deduplicate by variant id
        const images = (variant.images ?? []).map((img: { url: string }) => img.url);
        seen.set(variant.id, {
          id: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          colorName: variant.color,
          image: images[0] ?? (product.images?.[0] as any)?.url ?? '',
          hoverImage: images[1] ?? (product.images?.[1] as any)?.url ?? null,
          price: product.price + (variant.price_adjustment ?? 0),
          originalPrice: product.original_price ?? null,
          rating: product.rating_avg ?? 0,
          reviewCount: product.rating_count ?? 0,
          badges: ['New Arrival'],
          stockQuantity: variant.stock_quantity ?? 0,
        });
      }
    }

    const result = [...seen.values()];
    console.log('[FUNCTION] Exiting fetchNewArrivalVariantCards with count:', result.length);
    return result;
  } catch (error) {
    console.log('[ERROR] in fetchNewArrivalVariantCards:', error);
    return [];
  }
}

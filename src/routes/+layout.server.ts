import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const isUnlocked = true; // Lock feature disabled for now
  const sessionCookie = cookies.get('sb-session');
  if (!sessionCookie) {
    return { cart: [], isUnlocked };
  }

  try {
    const decoded = decodeURIComponent(sessionCookie);
    const session = JSON.parse(decoded);
    const userId = session.user_id;
    if (!userId) return { cart: [], isUnlocked };

    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    // Try relational join with products and product_variants
    const { data, error } = await supabase
      .from('cart')
      .select(`
        *,
        product:products(
          id, slug, name, base_price, description, brand, category
        ),
        variant:product_variants(
          id, sku, color_name, color_slug, color_hex, price_override, stock_quantity,
          images:product_images(image_url, is_primary)
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.warn('[Layout Load] Relational cart query note, attempting plain cart query:', error.message);
      const { data: plainCart } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', userId);

      return { cart: plainCart || [], isUnlocked };
    }

    return {
      cart: data || [],
      isUnlocked
    };
  } catch (e) {
    console.error('Error parsing session cookie in layout load:', e);
    return { cart: [], isUnlocked };
  }
};

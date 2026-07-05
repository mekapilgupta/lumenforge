import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const sessionCookie = cookies.get('sb-session');
  if (!sessionCookie) {
    return { cart: [] };
  }

  try {
    const decoded = decodeURIComponent(sessionCookie);
    const session = JSON.parse(decoded);
    const userId = session.user_id;
    if (!userId) return { cart: [] };

    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    const { data, error } = await supabase
      .from('cart')
      .select('*, product:product_id(id, slug, name, price, images, colors, sizes), variant:variant_id(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching cart in layout load:', error);
      return { cart: [] };
    }

    return {
      cart: data || []
    };
  } catch (e) {
    console.error('Error parsing session cookie in layout load:', e);
    return { cart: [] };
  }
};

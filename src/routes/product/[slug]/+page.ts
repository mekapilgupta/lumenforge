// Tell SvelteKit to prerender this dynamic route at build time.
// `entries()` enumerates every slug so the static adapter can generate
// one HTML file per product (e.g. /product/chicago/index.html).
import { supabase } from '$lib/supabaseClient';

export const prerender = true;

export async function entries() {
  console.log('[entries] Fetching product slugs from Supabase for prerendering...');
  const { data, error } = await supabase
    .from('products_complete')
    .select('slug')
    .eq('is_active', true);

  if (error) {
    console.error('[entries] Error fetching slugs from Supabase:', error);
    return [];
  }
  
  console.log(`[entries] Found ${data?.length ?? 0} active product slugs for prerendering.`);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

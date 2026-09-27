export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

export async function POST({ request }) {
  try {
    const { variantId, imageOrders, primaryImageId } = await request.json();

    if (!variantId || !Array.isArray(imageOrders)) {
      return json({ success: false, error: 'variantId and imageOrders array are required' }, { status: 400 });
    }

    // Update positions and primary flags
    for (const item of imageOrders) {
      const isPrimary = primaryImageId ? item.id === primaryImageId : item.is_primary ?? false;
      await supabaseAdmin
        .from('product_images')
        .update({
          position: item.position,
          is_primary: isPrimary
        })
        .eq('id', item.id);
    }

    // If primaryImageId explicitly specified, ensure all other images for this variant are not primary
    if (primaryImageId) {
      await supabaseAdmin
        .from('product_images')
        .update({ is_primary: false })
        .eq('variant_id', variantId)
        .neq('id', primaryImageId);

      await supabaseAdmin
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', primaryImageId);
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('[Reorder Images Exception]', err);
    return json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

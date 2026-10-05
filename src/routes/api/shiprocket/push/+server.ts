export const prerender = false;
import { json } from '@sveltejs/kit';
import { pushOrderToShiprocket, syncOrderWithShiprocket } from '$lib/server/shiprocket';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id;
    if (!orderId) {
      return json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    console.log(`[Shiprocket Push API] Pushing order ${orderId} to Shiprocket...`);

    // 1. Try cloud Edge Function first (full cloud permissions + service secrets)
    try {
      const edgeRes = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/push-to-shiprocket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ orderId }),
      });
      const edgeData = await edgeRes.json().catch(() => ({}));
      if (edgeRes.ok && (edgeData.success || edgeData.shiprocket_order_id)) {
        return json({
          success: true,
          shiprocket_order_id: edgeData.shiprocket_order_id,
          order: edgeData.order,
        });
      }
    } catch (edgeErr) {
      console.warn('[Shiprocket Push API] Edge function attempt note:', edgeErr);
    }

    // 2. Local fallback handler
    const pushResult = await pushOrderToShiprocket(String(orderId));
    if (!pushResult.success) {
      return json({ error: pushResult.error || 'Push failed' }, { status: 400 });
    }

    const syncResult = await syncOrderWithShiprocket(String(orderId));

    return json({
      success: true,
      shiprocket_order_id: pushResult.shiprocket_order_id,
      order: syncResult.order,
    });
  } catch (err: any) {
    console.error('[Shiprocket Push API] Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

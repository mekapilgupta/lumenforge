export const prerender = false;
import { json } from '@sveltejs/kit';
import { pushOrderToShiprocket, syncOrderWithShiprocket } from '$lib/server/shiprocket';

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id;
    if (!orderId) {
      return json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    console.log(`[Shiprocket Push API] Pushing order ${orderId} to Shiprocket via authoritative server route...`);
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

export const prerender = false;
import { json } from '@sveltejs/kit';
import { pushOrderToShiprocket, syncOrderWithShiprocket } from '$lib/server/shiprocket';

export async function POST({ request }) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    console.log(`[Shiprocket Push API] Pushing order ${orderId} to Shiprocket...`);
    const pushResult = await pushOrderToShiprocket(orderId);
    if (!pushResult.success) {
      return json({ error: pushResult.error || 'Push failed' }, { status: 400 });
    }

    // Follow-up sync to refresh all tracking properties
    const syncResult = await syncOrderWithShiprocket(orderId);

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

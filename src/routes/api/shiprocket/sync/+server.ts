export const prerender = false;
import { json } from '@sveltejs/kit';
import { syncOrderWithShiprocket, syncAllActiveShiprocketOrders } from '$lib/server/shiprocket';

export async function POST({ request, url }) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id || body.awb || url.searchParams.get('orderId') || url.searchParams.get('id');
    const syncAll = body.syncAll === true || url.searchParams.get('syncAll') === 'true';

    if (syncAll) {
      console.log('[Shiprocket Sync API] Syncing all active in-flight orders...');
      const result = await syncAllActiveShiprocketOrders();
      return json({ success: true, ...result });
    }

    if (!orderId) {
      return json({ error: 'Missing orderId, awb, or syncAll parameter' }, { status: 400 });
    }

    console.log(`[Shiprocket Sync API] Syncing single order: ${orderId}`);
    const result = await syncOrderWithShiprocket(String(orderId));
    if (!result.success) {
      return json({ error: result.error || 'Failed to sync order' }, { status: 400 });
    }

    return json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Shiprocket Sync API] Uncaught Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

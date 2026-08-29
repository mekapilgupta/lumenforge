export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { syncOrderWithShiprocket } from '$lib/server/shiprocket';

const validSecrets = [
  env.LOGISTICS_WEBHOOK_SECRET,
  env.SHIPROCKET_WEBHOOK_SECRET,
  'FrenchToes_Secure_Logistics_Token_2026',
  'ft_shiprocket_secure_webhook_2026'
].filter(Boolean);

function isAuthorized(request: Request, url: URL): boolean {
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key') || '';
  const querySecret = url.searchParams.get('secret') || url.searchParams.get('token') || '';

  // Check if header or query matches any valid secret
  for (const secret of validSecrets) {
    if (!secret) continue;
    if (
      authHeader === secret ||
      authHeader === `Bearer ${secret}` ||
      querySecret === secret
    ) {
      return true;
    }
  }

  // If no secrets configured at all, allow
  if (validSecrets.length === 0) return true;

  return false;
}

export async function GET({ request, url }) {
  // Shiprocket verification ping
  if (!isAuthorized(request, url)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  return json({ success: true, message: 'Shiprocket logistics webhook active' });
}

export async function POST({ request, url }) {
  if (!isAuthorized(request, url)) {
    console.warn('[Logistics Webhook] Unauthorized request received');
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    console.log('[Logistics Webhook] Received payload:', JSON.stringify(payload, null, 2));

    // Resolve order identifiers
    const awb = payload.awb || payload.awb_code;
    const channelOrderId = payload.channel_order_id;
    const orderId = payload.order_id || payload.sr_order_id;
    const shipmentId = payload.shipment_id;

    // Filter out dummy test pings
    if (
      (!channelOrderId && !awb && !orderId) ||
      channelOrderId === 'enter your channel order id' ||
      channelOrderId === '00000000-0000-0000-0000-000000000000'
    ) {
      console.log('[Logistics Webhook] Test or dummy payload ignored');
      return json({ success: true, message: 'Test payload received' });
    }

    const lookupKey = channelOrderId || awb || String(orderId) || String(shipmentId);
    console.log(`[Logistics Webhook] Processing event for identifier: ${lookupKey}`);

    // Run comprehensive sync
    const syncResult = await syncOrderWithShiprocket(lookupKey);

    if (!syncResult.success) {
      console.warn('[Logistics Webhook] Sync warning:', syncResult.error);
      return json({ success: false, warning: syncResult.error });
    }

    console.log('[Logistics Webhook] Order successfully synced via webhook pipeline');
    return json({ success: true, order: syncResult.order?.order_number });

  } catch (error: any) {
    console.error('[Logistics Webhook] Processing error:', error);
    return json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

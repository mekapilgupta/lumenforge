import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabase';
import { syncOrderWithShiprocket, syncAllActiveShiprocketOrders } from '$lib/server/shiprocket';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request, url }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id || body.awb || url.searchParams.get('orderId') || url.searchParams.get('id');
    const syncAll = body.syncAll === true || url.searchParams.get('syncAll') === 'true';

    const db = authHeader.startsWith('Bearer ')
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : supabaseAdmin;

    if (syncAll) {
      console.log('[Shiprocket Sync API] Syncing all active in-flight orders...');
      const result = await syncAllActiveShiprocketOrders();
      return json({ success: true, ...result });
    }

    if (!orderId || orderId === 'undefined' || orderId === 'null') {
      return json({ error: 'Missing valid orderId or awb parameter' }, { status: 400 });
    }

    console.log(`[Shiprocket Sync API] Syncing single order: ${orderId}`);
    const result = await syncOrderWithShiprocket(String(orderId), db);
    if (!result.success) {
      return json({ error: result.error || 'Failed to sync order' }, { status: 400 });
    }

    return json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Shiprocket Sync API] Uncaught Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabase';
import { pushOrderToShiprocket, syncOrderWithShiprocket } from '$lib/server/shiprocket';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id;
    if (!orderId) {
      return json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    const db = authHeader.startsWith('Bearer ')
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : supabaseAdmin;

    console.log(`[Shiprocket Push API] Pushing order ${orderId} to Shiprocket via authoritative server route...`);
    const pushResult = await pushOrderToShiprocket(String(orderId), db);
    if (!pushResult.success) {
      return json({ error: pushResult.error || 'Push failed' }, { status: 400 });
    }

    const syncResult = await syncOrderWithShiprocket(String(orderId), db);

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

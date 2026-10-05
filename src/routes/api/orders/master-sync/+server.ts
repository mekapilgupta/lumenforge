export const prerender = false;
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabase';
import { pushOrderToShiprocket, syncOrderWithShiprocket, getShiprocketToken } from '$lib/server/shiprocket';
import { isCodOrder, getAdvAmount, getCodDue } from '$lib/utils/orderPayments';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Master Sync API:
 * 1. Scans all active/recent orders.
 * 2. Reconciles COD amounts, payment_method, and payment_status in DB.
 * 3. Auto-pushes un-pushed orders to Shiprocket.
 * 4. Corrects misclassified prepaid orders in Shiprocket to COD with proper collectible balance (x - advance).
 * 5. Syncs live tracking data back to DB.
 */
export async function POST({ request, url }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const db = authHeader.startsWith('Bearer ')
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : supabaseAdmin;

    console.log('[Master Sync] Starting comprehensive order reconciliation & logistics sync...');

    const { data: orders, error: fetchErr } = await db
      .from('orders')
      .select(`
        *,
        address:addresses!shipping_address_id(*),
        items:order_items(*),
        profile:user_id(id, full_name, email, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchErr || !orders) {
      return json({ success: false, error: fetchErr?.message || 'Failed to fetch orders' }, { status: 500 });
    }

    let healedCount = 0;
    let pushedCount = 0;
    let syncedCount = 0;
    const errors: string[] = [];

    const token = await getShiprocketToken().catch(() => null);

    for (let order of orders) {
      try {
        const isCod = isCodOrder(order);
        const total = Number(order.total_amount || 0);
        const adv = getAdvAmount(order);
        const due = getCodDue(order);
        const actuallyFullyPaid = isCod ? (due <= 0 || adv >= total) : (order.payment_status === 'paid');

        // 1. Reconcile DB row if fields are misaligned
        let dbChanged = false;
        const updatePayload: Record<string, any> = {};

        if (isCod) {
          if (order.payment_method !== 'cod') {
            updatePayload.payment_method = 'cod';
            dbChanged = true;
          }
          const correctStatus = actuallyFullyPaid ? 'paid' : 'partial_paid';
          if (order.payment_status !== correctStatus) {
            updatePayload.payment_status = correctStatus;
            dbChanged = true;
          }
          if (Number(order.advance_amount || 0) !== adv) {
            updatePayload.advance_amount = adv;
            dbChanged = true;
          }
          if (Number(order.cod_balance_due || 0) !== due) {
            updatePayload.cod_balance_due = due;
            dbChanged = true;
          }
        }

        if (dbChanged) {
          updatePayload.updated_at = new Date().toISOString();
          const { error: updateErr } = await db.from('orders').update(updatePayload).eq('id', order.id);
          if (!updateErr) {
            healedCount++;
            order = { ...order, ...updatePayload };
          }
        }

        // 2. Push to Shiprocket if unpushed
        if (!order.shiprocket_order_id && order.status !== 'cancelled') {
          console.log(`[Master Sync] Pushing Order #${order.order_number} to Shiprocket...`);
          const pushRes = await pushOrderToShiprocket(order.id, db);
          if (pushRes.success) {
            pushedCount++;
            order.shiprocket_order_id = pushRes.shiprocket_order_id;
          } else if (pushRes.error) {
            errors.push(`Order #${order.order_number} push: ${pushRes.error}`);
          }
        } else if (order.shiprocket_order_id && token && isCod && !actuallyFullyPaid) {
          // Check if Shiprocket has this marked as prepaid by mistake
          try {
            const srRes = await fetch(`https://apiv2.shiprocket.in/v1/external/orders/show/${order.shiprocket_order_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (srRes.ok) {
              const srData = await srRes.json();
              if (srData.data?.payment_method?.toLowerCase() === 'prepaid') {
                console.log(`[Master Sync] Order #${order.order_number} is COD in DB but Prepaid in Shiprocket! Fixing...`);
                // Force push will cancel the old order on Shiprocket and create the corrected COD order
                const fixPush = await pushOrderToShiprocket(order.id, db);
                if (fixPush.success) {
                  pushedCount++;
                  order.shiprocket_order_id = fixPush.shiprocket_order_id;
                }
              }
            }
          } catch (srCheckErr) {
            console.warn('[Master Sync] SR Check notice:', srCheckErr);
          }
        }

        // 3. Sync live tracking
        if (order.shiprocket_order_id || order.awb_code) {
          const syncRes = await syncOrderWithShiprocket(order.id, db);
          if (syncRes.success) {
            syncedCount++;
          }
        }
      } catch (itemErr: any) {
        errors.push(`Order #${order.order_number}: ${itemErr.message}`);
      }
    }

    console.log(`[Master Sync] Finished. Healed DB: ${healedCount}, Pushed: ${pushedCount}, Synced: ${syncedCount}`);

    return json({
      success: true,
      total_orders_scanned: orders.length,
      healed: healedCount,
      pushed: pushedCount,
      synced: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[Master Sync API] Uncaught handler error:', err);
    return json({ success: false, error: err?.message || 'Master sync failed' }, { status: 500 });
  }
}

export async function GET(event) {
  return POST(event);
}

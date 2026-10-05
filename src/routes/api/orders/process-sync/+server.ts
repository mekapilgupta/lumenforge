export const prerender = false;
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabase';
import { pushOrderToShiprocket, syncOrderWithShiprocket } from '$lib/server/shiprocket';
import { isCodOrder, getAdvAmount, getCodDue } from '$lib/utils/orderPayments';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Unified, Resilient Order Processing & Shiprocket Sync API
 */
export async function POST({ request, url }) {
  const warnings: string[] = [];
  let reconciled = false;
  let pushed = false;
  let synced = false;

  try {
    const authHeader = request.headers.get('authorization') || '';
    const body = await request.json().catch(() => ({}));
    const rawId = body.orderId || body.id || body.orderNumber || body.awb || url.searchParams.get('orderId') || url.searchParams.get('id');
    const forcePush = body.forcePush === true || url.searchParams.get('forcePush') === 'true';
    const forceSync = body.forceSync === true || url.searchParams.get('forceSync') === 'true';

    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      return json({ success: false, error: 'Valid order ID or order number is required' }, { status: 400 });
    }

    const orderIdentifier = String(rawId).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdentifier);
    const isDigits = /^\d+$/.test(orderIdentifier);

    // Create DB client with caller's authorization if provided (bypasses RLS for logged in admins/users)
    const db = authHeader.startsWith('Bearer ')
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : supabaseAdmin;

    // 1. Locate Order in Supabase Database
    let orderQuery = db
      .from('orders')
      .select(`
        *,
        address:addresses!shipping_address_id(*),
        items:order_items(*),
        profile:user_id(id, full_name, email, phone)
      `);

    if (isUuid) {
      orderQuery = orderQuery.eq('id', orderIdentifier);
    } else if (orderIdentifier.startsWith('FT') || orderIdentifier.startsWith('ft_')) {
      orderQuery = orderQuery.eq('order_number', orderIdentifier);
    } else if (isDigits) {
      orderQuery = orderQuery.or(`shiprocket_order_id.eq.${orderIdentifier},awb_code.eq.${orderIdentifier},order_number.eq.${orderIdentifier}`);
    } else {
      orderQuery = orderQuery.or(`awb_code.eq.${orderIdentifier},order_number.eq.${orderIdentifier},razorpay_order_id.eq.${orderIdentifier}`);
    }

    let { data: order, error: orderErr } = await orderQuery.maybeSingle();

    // Fallback: If not found through primary client, try elevated edge function or supabaseAdmin
    if (!order && db !== supabaseAdmin) {
      const { data: adminOrder } = await supabaseAdmin.from('orders').select('*, address:addresses!shipping_address_id(*), items:order_items(*), profile:user_id(id, full_name, email, phone)').eq(isUuid ? 'id' : 'order_number', orderIdentifier).maybeSingle();
      if (adminOrder) {
        order = adminOrder;
      }
    }

    // Edge function cloud check fallback
    if (!order) {
      try {
        const edgeRes = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/push-to-shiprocket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ orderId: orderIdentifier }),
        });
        const edgeData = await edgeRes.json().catch(() => ({}));
        if (edgeRes.ok && (edgeData.success || edgeData.shiprocket_order_id)) {
          return json({
            success: true,
            pushed: true,
            synced: true,
            shiprocket_order_id: edgeData.shiprocket_order_id,
            order: edgeData.order,
          });
        }
      } catch (e) {}
    }

    if (!order) {
      return json({
        success: false,
        error: `Order "${orderIdentifier}" not found in database.`,
        details: orderErr?.message
      }, { status: 404 });
    }

    // 2. Auto-Reconcile COD vs Prepaid Status & Balance
    // Amounts (advance_amount / cod_balance_due) are the source of truth. A COD order
    // with balance still due is 'partial_paid' even if payment_status says 'paid' —
    // heal rows corrupted by older writers.
    try {
      const isCod = isCodOrder(order);
      if (isCod) {
        const total = Number(order.total_amount || 0);
        const storedAdv = Number(order.advance_amount || 0);
        const storedDue = Number(order.cod_balance_due || 0);
        const adv = getAdvAmount(order);
        const due = getCodDue(order);
        const actuallyFullyPaid = due <= 0 || adv >= total;
        const statusLie = order.payment_status === 'paid' && !actuallyFullyPaid;
        const needsUpdate = order.payment_method !== 'cod' ||
          statusLie ||
          (order.payment_status !== 'partial_paid' && order.payment_status !== 'paid') ||
          storedAdv !== adv ||
          storedDue !== due;

        if (needsUpdate) {
          const { data: updatedOrder, error: recError } = await db
            .from('orders')
            .update({
              payment_method: 'cod',
              payment_status: actuallyFullyPaid ? 'paid' : 'partial_paid',
              advance_amount: adv,
              cod_balance_due: due,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
            .select('*')
            .single();

          if (!recError && updatedOrder) {
            order = { ...order, ...updatedOrder };
            reconciled = true;
            if (statusLie) warnings.push('Payment status healed: COD balance still due, marked as partial_paid.');
          } else if (recError) {
            warnings.push(`Payment reconciliation notice: ${recError.message}`);
          }
        }
      }
    } catch (e: any) {
      warnings.push(`Reconciliation skipped: ${e?.message}`);
    }

    // 3. Auto-Push to Shiprocket (if not pushed yet or if forcePush)
    if (!order.shiprocket_order_id || forcePush) {
      console.log(`[Process Sync] Order #${order.order_number} has no Shiprocket ID. Attempting auto-push...`);
      try {
        let pushSuccess = false;
        let srId = null;

        // A. Try Cloud Edge Function
        try {
          const edgeRes = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/push-to-shiprocket`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ orderId: order.id }),
          });
          const edgeData = await edgeRes.json().catch(() => ({}));
          if (edgeRes.ok && (edgeData.success || edgeData.shiprocket_order_id)) {
            pushSuccess = true;
            srId = edgeData.shiprocket_order_id;
          }
        } catch (edgeErr: any) {
          console.warn('[Process Sync] Cloud Edge push skipped:', edgeErr.message);
        }

        // B. Fallback to Local Server Push
        if (!pushSuccess) {
          const localPushResult = await pushOrderToShiprocket(order.id);
          if (localPushResult.success) {
            pushSuccess = true;
            srId = localPushResult.shiprocket_order_id;
          } else if (localPushResult.error) {
            warnings.push(`Shiprocket push: ${localPushResult.error}`);
          }
        }

        if (pushSuccess) {
          pushed = true;
          order.shiprocket_order_id = srId || order.shiprocket_order_id;
        }
      } catch (pushErr: any) {
        warnings.push(`Shiprocket push failed: ${pushErr.message}`);
      }
    }

    // 4. Auto-Sync Shiprocket Status & Tracking (if Shiprocket ID or AWB exists)
    if (order.shiprocket_order_id || order.awb_code || forceSync) {
      console.log(`[Process Sync] Syncing Shiprocket tracking for Order #${order.order_number}...`);
      try {
        const syncResult = await syncOrderWithShiprocket(order.id);
        if (syncResult.success) {
          synced = true;
          if (syncResult.order) {
            order = { ...order, ...syncResult.order };
          }
        } else if (syncResult.error) {
          warnings.push(`Shiprocket sync: ${syncResult.error}`);
        }
      } catch (syncErr: any) {
        warnings.push(`Shiprocket sync note: ${syncErr.message}`);
      }
    }

    // Return Complete, Rich Status
    return json({
      success: true,
      order,
      reconciled,
      pushed,
      synced,
      shiprocket_order_id: order.shiprocket_order_id ?? null,
      shiprocket_status: order.shiprocket_status ?? null,
      awb_code: order.awb_code ?? null,
      courier_name: order.courier_name ?? null,
      tracking_url: order.tracking_url ?? (order.awb_code ? `https://shiprocket.co/tracking/${order.awb_code}` : null),
      warnings: warnings.length > 0 ? warnings : undefined,
    });

  } catch (err: any) {
    console.error('[Process Sync API] Uncaught handler error:', err);
    return json({
      success: false,
      error: err?.message || 'Internal Server Error during order sync',
      warnings: warnings.length > 0 ? warnings : undefined,
    }, { status: 500 });
  }
}

export async function GET(event) {
  return POST(event);
}

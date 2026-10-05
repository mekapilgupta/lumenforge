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

    // Fallback 1: If not found through primary client, try elevated supabaseAdmin
    if (!order && db !== supabaseAdmin) {
      const { data: adminOrder } = await supabaseAdmin.from('orders').select('*, address:addresses!shipping_address_id(*), items:order_items(*), profile:user_id(id, full_name, email, phone)').eq(isUuid ? 'id' : 'order_number', orderIdentifier).maybeSingle();
      if (adminOrder) {
        order = adminOrder;
      }
    }

    // Fallback 2: If still not found due to RLS, query public orders_complete view
    if (!order) {
      let ocQuery = db.from('orders_complete').select('*');
      if (isUuid) {
        ocQuery = ocQuery.eq('id', orderIdentifier);
      } else if (orderIdentifier.startsWith('FT') || orderIdentifier.startsWith('ft_')) {
        ocQuery = ocQuery.eq('order_number', orderIdentifier);
      } else if (isDigits) {
        ocQuery = ocQuery.or(`shiprocket_order_id.eq.${orderIdentifier},awb_code.eq.${orderIdentifier},order_number.eq.${orderIdentifier}`);
      } else {
        ocQuery = ocQuery.or(`awb_code.eq.${orderIdentifier},order_number.eq.${orderIdentifier},razorpay_order_id.eq.${orderIdentifier}`);
      }
      const { data: ocOrder } = await ocQuery.maybeSingle();
      if (ocOrder) {
        order = ocOrder;
        if (order.shipping_address_id && !order.address) {
          const { data: addr } = await db.from('addresses').select('*').eq('id', order.shipping_address_id).maybeSingle();
          if (addr) order.address = addr;
        }
      }
    }



    if (!order) {
      return json({
        success: false,
        error: `Order "${orderIdentifier}" not found in database.`,
        details: orderErr?.message
      }, { status: 404 });
    }

    // Administrative correction / override (if provided in payload)
    const overrideSrId = body.shiprocketOrderId || body.shiprocket_order_id;
    if (overrideSrId || (body.status && body.status !== order.status)) {
      const patchData: Record<string, any> = {};
      if (overrideSrId) patchData.shiprocket_order_id = String(overrideSrId);
      if (body.status) patchData.status = body.status;
      if (body.status === 'confirmed') patchData.cancellation_reason = null;
      await supabaseAdmin.from('orders').update(patchData).eq('id', order.id);
      order = { ...order, ...patchData };
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
            .maybeSingle();

          if (!recError) {
            order = {
              ...order,
              ...(updatedOrder || {
                payment_method: 'cod',
                payment_status: actuallyFullyPaid ? 'paid' : 'partial_paid',
                advance_amount: adv,
                cod_balance_due: due
              })
            };
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
      console.log(`[Process Sync] Order #${order.order_number} has no Shiprocket ID. Pushing via authoritative server route...`);
      try {
        const pushResult = await pushOrderToShiprocket(order.id, db);
        if (pushResult.success) {
          pushed = true;
          order.shiprocket_order_id = pushResult.shiprocket_order_id || order.shiprocket_order_id;
        } else if (pushResult.error) {
          warnings.push(`Shiprocket push: ${pushResult.error}`);
        }
      } catch (pushErr: any) {
        warnings.push(`Shiprocket push failed: ${pushErr.message}`);
      }
    }

    // 4. Auto-Sync Shiprocket Status & Tracking (if Shiprocket ID or AWB exists)
    if (order.shiprocket_order_id || order.awb_code || forceSync) {
      console.log(`[Process Sync] Syncing Shiprocket tracking for Order #${order.order_number}...`);
      try {
        const syncResult = await syncOrderWithShiprocket(order.id, db);
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

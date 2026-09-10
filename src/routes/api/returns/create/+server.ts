export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/shiprocket';
import { createAdminNotification } from '$lib/server/notifications';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const {
      orderId,
      userId,
      type = 'exchange', // 'exchange' | 'return'
      reason,
      comments,
      images = [],
      exchangeSize,
      exchangeColor,
      exchangeVariantId,
      bankDetails, // { upiId, accountNo, ifsc, holderName }
    } = body;

    if (!orderId || !reason) {
      return json({ success: false, error: 'Order ID and reason are required' }, { status: 400 });
    }

    // Set up user-authenticated client in case service-role key is missing in environment
    const sessionCookie = cookies.get('sb-session');
    const authHeader = request.headers.get('authorization');
    let userToken = '';
    if (authHeader?.startsWith('Bearer ')) {
      userToken = authHeader.replace('Bearer ', '').trim();
    } else if (body.sessionToken) {
      userToken = String(body.sessionToken).trim();
    } else if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie));
        userToken = parsed.access_token || '';
      } catch {}
    }

    let userClient = supabaseAdmin;
    if (userToken) {
      userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      });
    }

    // 1. Fetch Order and verify eligibility
    // Prefer userClient so RLS policies evaluating auth.uid() = user_id succeed even without service-role key
    let order: any = null;
    let orderErr: any = null;

    if (userClient !== supabaseAdmin) {
      const userRes = await userClient
        .from('orders')
        .select('id, order_number, user_id, status, delivered_at, created_at, updated_at, total_amount, payment_method, advance_amount, cod_balance_due')
        .eq('id', orderId)
        .maybeSingle();
      if (userRes.data) {
        order = userRes.data;
      } else if (userRes.error) {
        orderErr = userRes.error;
      }
    }

    if (!order) {
      const adminRes = await supabaseAdmin
        .from('orders')
        .select('id, order_number, user_id, status, delivered_at, created_at, updated_at, total_amount, payment_method, advance_amount, cod_balance_due')
        .eq('id', orderId)
        .maybeSingle();
      if (adminRes.data) {
        order = adminRes.data;
        orderErr = null;
      } else if (!orderErr) {
        orderErr = adminRes.error;
      }
    }

    if (!order) {
      console.warn('[Return Create] Order lookup failed:', { orderId, orderErr, hasUserToken: !!userToken });
      return json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 2. Strict Delivery and Window Check
    if (order.status !== 'delivered') {
      return json({
        success: false,
        error: 'Returns & Exchanges are only available after your order has been successfully delivered.',
      }, { status: 400 });
    }

    // Resolve delivery timestamp: check order.delivered_at, then order_logs, then updated_at
    let deliveryTimestamp = order.delivered_at ? new Date(order.delivered_at).getTime() : 0;
    if (!deliveryTimestamp) {
      const activeClient = userClient !== supabaseAdmin ? userClient : supabaseAdmin;
      const { data: delivLog } = await activeClient
        .from('order_logs')
        .select('created_at')
        .eq('order_id', orderId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      deliveryTimestamp = delivLog?.created_at
        ? new Date(delivLog.created_at).getTime()
        : (order.updated_at ? new Date(order.updated_at).getTime() : new Date(order.created_at).getTime());

      // If order is delivered but delivered_at was not yet recorded, persist it
      if (deliveryTimestamp > 0) {
        try {
          await supabaseAdmin
            .from('orders')
            .update({ delivered_at: new Date(deliveryTimestamp).toISOString() })
            .eq('id', order.id);
        } catch (e) {
          console.warn('[Return Create] Could not update delivered_at:', e);
        }
      }
    }

    const now = Date.now();
    const RETURN_WINDOW_DAYS = 20; // Expanded to 20 days for testing
    const windowMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    if (deliveryTimestamp > 0 && (now - deliveryTimestamp) > windowMs) {
      return json({
        success: false,
        error: `The ${RETURN_WINDOW_DAYS}-day Return & Exchange window for this delivered order has expired.`,
      }, { status: 400 });
    }

    // 3. Check for existing open return request
    const checkClient = userClient !== supabaseAdmin ? userClient : supabaseAdmin;
    let { data: existingReturn } = await checkClient
      .from('order_returns')
      .select('id, status')
      .eq('order_id', orderId)
      .in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up'])
      .maybeSingle();

    if (!existingReturn && checkClient !== supabaseAdmin) {
      const { data: adminExisting } = await supabaseAdmin
        .from('order_returns')
        .select('id, status')
        .eq('order_id', orderId)
        .in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up'])
        .maybeSingle();
      if (adminExisting) existingReturn = adminExisting;
    }

    if (existingReturn) {
      return json({
        success: false,
        error: 'A return or exchange request is already active for this order.',
      }, { status: 400 });
    }

    // 4. Fetch order items for return record
    const itemsClient = userClient !== supabaseAdmin ? userClient : supabaseAdmin;
    let { data: orderItems } = await itemsClient
      .from('order_items')
      .select('id, product_id, product_name, quantity, unit_price, variant_info, variant_id')
      .eq('order_id', order.id);

    if ((!orderItems || orderItems.length === 0) && itemsClient !== supabaseAdmin) {
      const { data: adminItems } = await supabaseAdmin
        .from('order_items')
        .select('id, product_id, product_name, quantity, unit_price, variant_info, variant_id')
        .eq('order_id', order.id);
      if (adminItems && adminItems.length > 0) {
        orderItems = adminItems;
      }
    }

    const itemsPayload = (orderItems || []).map((item) => ({
      order_item_id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      variant_id: item.variant_id,
    }));

    // Resolve replacement variant if exchange
    let requestedVariantId = exchangeVariantId || null;
    if (!requestedVariantId && exchangeSize && orderItems && orderItems.length > 0) {
      const firstProduct = orderItems[0].product_id;
      if (firstProduct) {
        const { data: matchVar } = await supabaseAdmin
          .from('product_variants')
          .select('id, size, stock_quantity')
          .eq('product_id', firstProduct)
          .eq('size', String(exchangeSize))
          .maybeSingle();
        if (matchVar) {
          requestedVariantId = matchVar.id;
        }
      }
    }

    // Format customer note including photo links if provided
    let customerNote = comments?.trim() || '';
    if (Array.isArray(images) && images.length > 0) {
      customerNote = customerNote
        ? `${customerNote}\n\nAttached Photos:\n${images.join('\n')}`
        : `Attached Photos:\n${images.join('\n')}`;
    }

    const customerId = userId || order.user_id;

    // 5. Insert into order_returns
    const payload: any = {
      order_id: order.id,
      customer_id: customerId,
      type: type === 'return' ? 'refund' : 'exchange',
      status: 'requested',
      reason_code: reason,
      customer_note: customerNote || null,
      items: itemsPayload,
      exchange_size: exchangeSize || null,
      exchange_color: exchangeColor || null,
      exchange_variant_id: requestedVariantId || null,
      requested_variant_id: requestedVariantId || null,
      bank_upi_id: bankDetails?.upiId || null,
      bank_account_no: bankDetails?.accountNo || null,
      bank_ifsc: bankDetails?.ifsc || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let newReturn: any = null;
    let insertErr: any = null;

    // Prefer userClient so RLS policy "Customers insert their own returns" succeeds
    const primaryClient = userClient !== supabaseAdmin ? userClient : supabaseAdmin;
    const primaryRes = await primaryClient
      .from('order_returns')
      .insert(payload)
      .select()
      .maybeSingle();

    if (!primaryRes.error && primaryRes.data) {
      newReturn = primaryRes.data;
    } else {
      const secondaryClient = primaryClient === userClient ? supabaseAdmin : userClient;
      if (secondaryClient !== primaryClient) {
        const secondaryRes = await secondaryClient
          .from('order_returns')
          .insert(payload)
          .select()
          .maybeSingle();
        if (!secondaryRes.error && secondaryRes.data) {
          newReturn = secondaryRes.data;
        } else {
          insertErr = primaryRes.error || secondaryRes.error;
        }
      } else {
        insertErr = primaryRes.error;
      }
    }

    if (insertErr || !newReturn) {
      console.error('[Return Create Error]', insertErr);
      return json({ success: false, error: insertErr?.message || 'Failed to record exchange request' }, { status: 500 });
    }

    // 6. Update Order status
    try {
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'refund_requested',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    } catch (e) {
      console.warn('[Return Create] Could not update order status:', e);
    }

    // 7. Log in order_logs
    try {
      await supabaseAdmin
        .from('order_logs')
        .insert({
          order_id: order.id,
          status: 'refund_requested',
          note: `Customer submitted a ${type.toUpperCase()} request. Reason: ${reason}. ${exchangeSize ? `Requested Size: ${exchangeSize}` : ''}`,
          created_at: new Date().toISOString(),
        });
    } catch (e) {
      console.warn('[Return Create] Could not log to order_logs:', e);
    }

    // 8. Trigger Admin Notification
    try {
      await createAdminNotification({
        type: type === 'exchange' ? 'exchange_requested' : 'return_requested',
        title: `${type === 'exchange' ? 'Exchange' : 'Return'} Requested: #${order.order_number}`,
        message: `Customer requested a ${type} for order #${order.order_number}. Reason: ${reason}.${exchangeSize ? ` Replacement Size: ${exchangeSize}` : ''}`,
        link_url: `/admin/returns`,
        reference_id: newReturn.id,
      });
    } catch (notifErr) {
      console.warn('[Admin Notification Skipped]', notifErr);
    }

    return json({
      success: true,
      message: `${type === 'exchange' ? 'Exchange' : 'Return'} request submitted successfully! Our team will process pickup within 24-48 hours.`,
      returnId: newReturn.id,
    });
  } catch (err: any) {
    console.error('[Return Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/shiprocket';

export async function POST({ request }) {
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

    // 1. Fetch Order and verify eligibility
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, user_id, status, delivered_at, created_at, total_amount, payment_method, advance_amount, cod_balance_due')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 2. Strict Delivery and 5-Day Window Check
    if (order.status !== 'delivered') {
      return json({
        success: false,
        error: 'Returns & Exchanges are only available after your order has been successfully delivered.',
      }, { status: 400 });
    }

    const deliveryTimestamp = order.delivered_at ? new Date(order.delivered_at).getTime() : 0;
    const now = Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

    if (deliveryTimestamp > 0 && (now - deliveryTimestamp) > fiveDaysMs) {
      return json({
        success: false,
        error: 'The 5-day Return & Exchange window for this delivered order has expired.',
      }, { status: 400 });
    }

    // 3. Check for existing open return request
    const { data: existingReturn } = await supabaseAdmin
      .from('order_returns')
      .select('id, status')
      .eq('order_id', orderId)
      .in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up'])
      .maybeSingle();

    if (existingReturn) {
      return json({
        success: false,
        error: 'A return or exchange request is already active for this order.',
      }, { status: 400 });
    }

    // 4. Insert into order_returns
    const payload: any = {
      order_id: order.id,
      user_id: userId || order.user_id,
      type: type === 'return' ? 'return' : 'exchange',
      status: 'requested',
      reason,
      comments: comments || null,
      images: Array.isArray(images) ? images : [],
      exchange_size: exchangeSize || null,
      exchange_color: exchangeColor || null,
      exchange_variant_id: exchangeVariantId || null,
      bank_upi_id: bankDetails?.upiId || null,
      bank_account_no: bankDetails?.accountNo || null,
      bank_ifsc: bankDetails?.ifsc || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newReturn, error: insertErr } = await supabaseAdmin
      .from('order_returns')
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      console.error('[Return Create Error]', insertErr);
      return json({ success: false, error: insertErr.message }, { status: 500 });
    }

    // 5. Update Order status
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'refund_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // 6. Log in order_logs
    await supabaseAdmin
      .from('order_logs')
      .insert({
        order_id: order.id,
        status: 'refund_requested',
        note: `Customer submitted a ${type.toUpperCase()} request. Reason: ${reason}. ${exchangeSize ? `Requested Size: ${exchangeSize}` : ''}`,
        created_at: new Date().toISOString(),
      });

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

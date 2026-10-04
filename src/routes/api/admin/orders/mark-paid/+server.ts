export const prerender = false;
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/shiprocket';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { orderId, note } = body;

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const remainingBalancePaise = order.cod_balance_due != null
      ? order.cod_balance_due
      : Math.max(0, order.total_amount - (order.advance_amount || 0));

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        advance_amount: order.total_amount,
        cod_balance_due: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateErr) {
      return json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // Append log entry
    await supabaseAdmin
      .from('order_logs')
      .insert({
        order_id: order.id,
        status: order.status,
        message: `Admin marked COD balance (₹${(remainingBalancePaise / 100).toFixed(0)}) as collected & paid.${note ? ` Note: ${note}` : ''}`,
        created_by: 'admin',
        created_at: new Date().toISOString()
      });

    return json({
      success: true,
      message: `COD balance of ₹${(remainingBalancePaise / 100).toFixed(0)} marked as collected & paid.`
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
};

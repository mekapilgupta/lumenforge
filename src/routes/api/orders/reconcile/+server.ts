export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import { isCodOrder, getAdvAmount, getCodDue } from '$lib/utils/orderPayments';

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, isCod, advanceAmount, codBalanceDue } = body;

    if (!orderId) {
      return json({ error: 'Missing orderId' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orderId).trim());
    let query = supabaseAdmin.from('orders').select('*');
    if (isUuid) {
      query = query.eq('id', orderId);
    } else {
      query = query.eq('order_number', orderId);
    }

    const { data: order, error: findError } = await query.maybeSingle();

    if (findError || !order) {
      return json({ error: 'Order not found' }, { status: 404 });
    }

    const codDetected = isCod !== undefined ? Boolean(isCod) : isCodOrder(order);
    if (codDetected) {
      const adv = advanceAmount != null ? Number(advanceAmount) : getAdvAmount(order);
      const due = codBalanceDue != null ? Number(codBalanceDue) : getCodDue(order);

      const updatePayload: any = {
        payment_method: 'cod',
        payment_status: order.payment_status === 'paid' ? 'paid' : 'partial_paid',
        advance_amount: adv,
        cod_balance_due: due,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (updateError) throw updateError;

      return json({ success: true, isCod: true, advance_amount: adv, cod_balance_due: due });
    }

    return json({ success: true, isCod: false });
  } catch (err: any) {
    console.warn('[Order Reconcile API] Error:', err?.message || err);
    return json({ error: err?.message || 'Reconciliation failed' }, { status: 500 });
  }
}

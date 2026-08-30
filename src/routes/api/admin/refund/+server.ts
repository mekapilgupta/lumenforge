export const prerender = false;
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as env from '$env/static/private';
import { supabaseAdmin } from '$lib/server/shiprocket';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { payment_id, orderId, returnId, amountPaise, amount_paise, note } = body;

    const finalAmountPaise = amountPaise || amount_paise;
    if (!finalAmountPaise || finalAmountPaise <= 0) {
      return json({ success: false, error: 'Valid amount in paise is required.' }, { status: 400 });
    }

    let targetPaymentId = payment_id;
    let targetOrderId = orderId;

    if (!targetPaymentId && targetOrderId) {
      const { data: ord } = await supabaseAdmin
        .from('orders')
        .select('id, razorpay_payment_id, total_amount, advance_amount, payment_method')
        .eq('id', targetOrderId)
        .single();

      if (ord) {
        targetPaymentId = ord.razorpay_payment_id;
      }
    }

    if (!targetPaymentId) {
      return json({
        success: false,
        error: 'No Razorpay payment ID on file for this order (may be uncollected COD or manual payment).'
      }, { status: 400 });
    }

    // Razorpay credentials
    const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return json({ success: false, error: 'Razorpay API credentials not configured on the server.' }, { status: 500 });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    console.log(`Initiating Razorpay refund for payment ${targetPaymentId} of amount ${finalAmountPaise} paise...`);

    const res = await fetch(`https://api.razorpay.com/v1/payments/${targetPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: finalAmountPaise,
        notes: {
          order_id: targetOrderId || '',
          return_id: returnId || '',
          reason: note || 'Customer refund'
        }
      })
    });

    const resJson = await res.json();

    if (!res.ok) {
      console.error('Razorpay refund API error:', resJson);
      return json({
        success: false,
        error: resJson.error?.description || resJson.error?.metadata?.reason || `Razorpay error (HTTP ${res.status})`
      }, { status: 400 });
    }

    console.log('Razorpay refund successful:', resJson.id);

    // Update database records
    if (returnId) {
      await supabaseAdmin
        .from('order_returns')
        .update({
          status: 'refunded',
          admin_refund_amount: finalAmountPaise,
          admin_notes: `Razorpay Refund ID: ${resJson.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnId);
    }

    if (targetOrderId) {
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'refunded',
          payment_status: 'refunded',
          refund_amount: finalAmountPaise,
          refund_completed_at: new Date().toISOString(),
        })
        .eq('id', targetOrderId);

      await supabaseAdmin
        .from('order_logs')
        .insert({
          order_id: targetOrderId,
          status: 'refunded',
          note: `Refund of ₹${(finalAmountPaise / 100).toFixed(0)} processed via Razorpay. Refund ID: ${resJson.id}`,
          created_at: new Date().toISOString(),
        });
    }

    return json({
      success: true,
      refund_id: resJson.id,
      payment_id: resJson.payment_id,
      amount: resJson.amount,
      status: resJson.status
    });
  } catch (err: any) {
    console.error('Internal server error during refund processing:', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
};

export const prerender = false;
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as envPrivate from '$env/static/private';
import { env as dynamicPrivate } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_RAZORPAY_KEY_ID } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/shiprocket';
import crypto from 'node:crypto';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionToken } = body;

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const keyId = dynamicPrivate.RAZORPAY_KEY_ID || envPrivate.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = dynamicPrivate.RAZORPAY_KEY_SECRET || envPrivate.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const publicKeyId = PUBLIC_RAZORPAY_KEY_ID || keyId;

    if (!keyId || !keySecret) {
      return json({ success: false, error: 'Razorpay credentials not configured on server' }, { status: 500 });
    }

    // Determine supabase client (prefer authenticated user token to satisfy RLS)
    const authHeader = request.headers.get('authorization');
    let userToken = '';
    if (authHeader?.startsWith('Bearer ')) {
      userToken = authHeader.replace('Bearer ', '').trim();
    } else if (sessionToken) {
      userToken = String(sessionToken).trim();
    }

    const sbClient = userToken
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${userToken}` } }
        })
      : supabaseAdmin;

    // 1. Fetch the order
    let { data: order, error: orderErr } = await sbClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (!order && sbClient !== supabaseAdmin) {
      const adminRes = await supabaseAdmin.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (adminRes.data) order = adminRes.data;
    }

    if (!order) {
      return json({ success: false, error: 'Order not found or access denied' }, { status: 404 });
    }

    // ─── ACTION: CREATE BALANCE PAYMENT ORDER ────────────────────────────────
    if (action === 'create') {
      const remainingBalancePaise = order.cod_balance_due != null && order.cod_balance_due > 0
        ? order.cod_balance_due
        : Math.max(0, (order.total_amount || 0) - (order.advance_amount || 500));

      if (remainingBalancePaise <= 0 || (order.payment_status === 'paid' && order.payment_method !== 'cod')) {
        return json({ success: false, error: 'This order has already been paid in full.' }, { status: 400 });
      }

      const authHeaderRzp = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const receipt = `ft_bal_${order.order_number || order.id.slice(0, 8)}_${Date.now()}`.slice(0, 40);

      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeaderRzp,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: remainingBalancePaise,
          currency: 'INR',
          receipt,
          notes: {
            order_id: order.id,
            order_number: order.order_number,
            type: 'cod_balance_payment'
          }
        })
      });

      const rzpOrder = await rzpRes.json();
      if (!rzpRes.ok) {
        console.error('[Pay Balance] Razorpay order creation failed:', rzpOrder);
        return json({ success: false, error: rzpOrder.error?.description || 'Failed to create payment order' }, { status: 500 });
      }

      return json({
        success: true,
        razorpayOrderId: rzpOrder.id,
        amount: remainingBalancePaise,
        currency: 'INR',
        keyId: publicKeyId,
        orderNumber: order.order_number
      });
    }

    // ─── ACTION: VERIFY BALANCE PAYMENT ──────────────────────────────────────
    if (action === 'verify') {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return json({ success: false, error: 'Missing payment verification credentials' }, { status: 400 });
      }

      // Verify HMAC signature
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
      }

      const balancePaidPaise = order.cod_balance_due != null && order.cod_balance_due > 0
        ? order.cod_balance_due
        : Math.max(0, (order.total_amount || 0) - (order.advance_amount || 500));

      // Update Order in Supabase to Fully Paid (Prepaid)
      const updatePayload = {
        payment_status: 'paid',
        payment_method: 'razorpay',
        advance_amount: order.total_amount,
        cod_balance_due: 0,
        razorpay_payment_id: razorpay_payment_id,
        payment_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { error: updateErr } = await sbClient
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (updateErr && sbClient !== supabaseAdmin) {
        const adminUpd = await supabaseAdmin.from('orders').update(updatePayload).eq('id', order.id);
        updateErr = adminUpd.error;
      }

      if (updateErr) {
        console.error('[Pay Balance] DB update error:', updateErr);
        return json({ success: false, error: 'Payment verified but order update failed: ' + updateErr.message }, { status: 500 });
      }

      // Append to Order Logs
      const logPayload = {
        order_id: order.id,
        status: order.status,
        message: `Remaining COD balance of ₹${(balancePaidPaise / 100).toFixed(0)} paid online via Razorpay (${razorpay_payment_id}). Order is now 100% Prepaid.`,
        created_by: 'customer',
        created_at: new Date().toISOString()
      };

      await sbClient.from('order_logs').insert(logPayload);

      return json({
        success: true,
        message: `Payment of ₹${(balancePaidPaise / 100).toFixed(0)} received! Your order is now 100% prepaid with cashless delivery.`
      });
    }

    return json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[Pay Balance] Server error:', err);
    return json({ success: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
};

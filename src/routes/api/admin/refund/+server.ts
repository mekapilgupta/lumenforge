import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Razorpay keys are fetched from private environment variables
import * as env from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { payment_id, amount_paise } = await request.json();

    if (!payment_id) {
      return json({ success: false, error: 'Payment ID is required.' }, { status: 400 });
    }

    if (!amount_paise || amount_paise <= 0) {
      return json({ success: false, error: 'Valid amount in paise is required.' }, { status: 400 });
    }

    // Try finding RAZORPAY credentials from private environment
    const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return json({ success: false, error: 'Razorpay API credentials not configured on the server.' }, { status: 500 });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    console.log(`Initiating Razorpay refund for payment ${payment_id} of amount ${amount_paise} paise...`);

    const res = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: amount_paise })
    });

    const resText = await res.text();
    let resJson: any = {};
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = { raw: resText };
    }

    if (!res.ok) {
      console.error('Razorpay refund API error:', resJson);
      return json({
        success: false,
        error: resJson.error?.description || resJson.error?.metadata?.reason || `Razorpay error (HTTP ${res.status})`
      }, { status: 400 });
    }

    console.log('Razorpay refund successful:', resJson);
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

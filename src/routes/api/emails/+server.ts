export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  buildOrderEmail,
  buildAdminOrderEmail,
  sendBrevoEmail,
  type OrderEmailData,
  type OrderEmailEvent,
} from '$lib/server/orderEmails';

const FROM_EMAIL = 'alerts@frenchtoes.in';
const REPLY_TO = 'hello@frenchtoes.in';

const VALID_EVENTS: OrderEmailEvent[] = [
  'order_placed', 'order_confirmed', 'order_processing', 'order_shipped',
  'order_out_for_delivery', 'order_delivered', 'order_cancelled',
  'cancellation_requested', 'cancellation_approved', 'cancellation_rejected',
  'cod_balance_collected', 'order_fully_paid', 'return_requested',
  'return_approved', 'exchange_created',
];

function adminRecipients(): string[] {
  return (env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || 'hello@frenchtoes.in')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function POST({ request }) {
  const brevoApiKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY || '';
  if (!brevoApiKey) {
    console.warn('[Email API] BREVO_API_KEY missing — email skipped');
    return json({ success: false, error: 'Email service not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      type,                    // legacy types mapped below, or an OrderEmailEvent
      event,                   // preferred name
      recipientEmail,
      recipientName,
      payloadData = {},
      notifyAdmin = true,      // set false to skip the admin copy
      adminExtra,
    } = body;

    // Map legacy type names to new events
    const legacyMap: Record<string, OrderEmailEvent> = {
      transactional: 'order_placed',
      status_update: 'order_processing',
      order_shipped: 'order_shipped',
      order_out_for_delivery: 'order_out_for_delivery',
      order_delivered: 'order_delivered',
      cancellation_response: (payloadData?.approved === false ? 'cancellation_rejected' : 'cancellation_approved'),
      new_message: 'order_confirmed', // message emails keep a simple subject; handled below
    };

    const emailEvent: OrderEmailEvent = VALID_EVENTS.includes(event)
      ? event
      : legacyMap[type as string] || 'order_confirmed';

    const d: OrderEmailData = {
      orderNumber: payloadData?.orderNumber || payloadData?.orderId || '',
      customerName: payloadData?.customerName || recipientName || null,
      items: Array.isArray(payloadData?.items) ? payloadData.items : [],
      subtotal: payloadData?.subtotal,
      discount: payloadData?.discount,
      shipping: payloadData?.shipping,
      codCharges: payloadData?.codCharges,
      gst: payloadData?.gst,
      total: Number(payloadData?.total || payloadData?.amount || 0),
      isCod: Boolean(payloadData?.isCod),
      advancePaid: payloadData?.advancePaid ?? payloadData?.advancePaid,
      balanceDue: payloadData?.balanceDue ?? payloadData?.codBalance,
      paymentStatusLabel: payloadData?.paymentStatusLabel,
      razorpayPaymentId: payloadData?.razorpayPaymentId,
      addressLines: Array.isArray(payloadData?.addressLines) ? payloadData.addressLines : [],
      phone: payloadData?.phone,
      eventId: payloadData?.awb || payloadData?.trackingId || null,
    };

    if (!recipientEmail && !notifyAdmin) {
      return json({ error: 'recipientEmail or notifyAdmin is required' }, { status: 400 });
    }

    // Special-case: customer↔admin chat message keeps its simple dedicated template
    if (type === 'new_message') {
      const subject = `New message on Order ${d.orderNumber}`;
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#fff7f3;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #f0e0d6;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:12px;color:#b0533f;letter-spacing:2px;font-family:Georgia,serif;">FRENCH TOES</div>
            <h2 style="margin:8px 0 0;font-size:18px;color:#3d2c22;">New message on Order ${d.orderNumber}</h2>
            <p style="margin:10px 0 0;font-size:14px;color:#3d2c22;">From <strong>${payloadData?.senderName || 'Customer'}</strong>:</p>
            <div style="margin:12px 0;padding:14px;background:#faf6f1;border:1px solid #e8ddd2;border-radius:8px;font-size:14px;color:#3d2c22;">${payloadData?.messageText || ''}</div>
            <p style="font-size:12.5px;color:#a08a77;margin:12px 0 0;">Reply from the order page in the admin panel. Please do not reply to this email directly.</p>
          </td></tr>
        </table></td></tr></table>
      </body></html>`;
      const targets = recipientEmail ? [{ email: recipientEmail, name: recipientName || '' }] : [];
      for (const admin of adminRecipients()) targets.push({ email: admin, name: 'Admin' });
      const messageId = await sendBrevoEmail(brevoApiKey, FROM_EMAIL, targets, subject, html, REPLY_TO);
      return json({ success: true, messageId });
    }

    const { subject, html } = buildOrderEmail(emailEvent, d);

    // 1. Customer email
    let customerMessageId: string | null = null;
    if (recipientEmail) {
      customerMessageId = await sendBrevoEmail(
        brevoApiKey, FROM_EMAIL,
        [{ email: recipientEmail, name: recipientName || '' }],
        subject, html, REPLY_TO
      );
    }

    // 2. Admin copy (bcc-style separate send, same detail)
    let adminMessageId: string | null = null;
    if (notifyAdmin) {
      const adminEmail = buildAdminOrderEmail(emailEvent, d, adminExtra);
      adminMessageId = await sendBrevoEmail(
        brevoApiKey, FROM_EMAIL,
        adminRecipients().map((e) => ({ email: e, name: 'Admin' })),
        adminEmail.subject, adminEmail.html, REPLY_TO
      );
    }

    return json({ success: true, customerMessageId, adminMessageId });
  } catch (error: any) {
    console.error('[Email API] Unexpected error:', error);
    return json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

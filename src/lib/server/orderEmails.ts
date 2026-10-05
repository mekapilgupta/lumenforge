/**
 * French Toes — Order Email Templates (single source of truth)
 *
 * Principles (anti-spam + completeness):
 *  - Transactional-style plain HTML: one wrapper table, inline CSS, no big images,
 *    no tracking pixels, no URL-shorteners, minimal links (1-2 max).
 *  - Every email carries the full order context: order number, items with SKU /
 *    color / size / qty / price, payment breakdown (paid, due on delivery, total),
 *    shipping address, and the specific event update.
 *  - Text is human, short sentences, no ALL-CAPS urgency, no emoji spam.
 */

export interface OrderEmailItem {
  name: string;
  sku?: string | null;
  color?: string | null;
  size?: string | number | null;
  quantity: number;
  unitPrice?: number | null; // rupees
  lineTotal?: number | null; // rupees
}

export interface OrderEmailData {
  orderNumber: string;
  customerName?: string | null;
  recipientLabel?: string; // "Hi Kapil" line; fallback generic
  items: OrderEmailItem[];
  subtotal?: number | null; // rupees
  discount?: number | null;
  shipping?: number | null;
  codCharges?: number | null;
  gst?: number | null;
  total: number; // rupees
  isCod: boolean;
  advancePaid?: number | null; // rupees
  balanceDue?: number | null; // rupees
  paymentStatusLabel?: string; // e.g. "Advance Paid (Balance Due)"
  paymentMethodLabel?: string; // e.g. "COD (₹5 advance paid online)"
  razorpayPaymentId?: string | null;
  addressLines?: string[];
  phone?: string | null;
  eventId?: string | null;
}

export type OrderEmailEvent =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_processing'
  | 'order_shipped'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'cancellation_rejected'
  | 'cod_balance_collected'
  | 'order_fully_paid'
  | 'return_requested'
  | 'return_approved'
  | 'exchange_created';

interface EventCopy {
  subject: (d: OrderEmailData) => string;
  heading: string;
  intro: (d: OrderEmailData) => string;
  note?: (d: OrderEmailData) => string;
  accent: string; // border/heading color
}

const PAYMENT_TABLE = (d: OrderEmailData): string => {
  const fmt = (n: number | null | undefined) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const due = d.balanceDue ?? (d.isCod ? Math.max(0, d.total - (d.advancePaid || 0)) : 0);
  const fullyPaid = !d.isCod || due <= 0;
  const codRows = d.isCod ? `
        <tr><td style="padding:3px 0;color:#b0533f;">Paid Online (advance)</td><td style="padding:3px 0;text-align:right;color:#b0533f;">${fmt(d.advancePaid || 0)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:600;color:#2e7d32;">${fullyPaid ? 'Balance' : 'To Pay on Delivery'}</td><td style="padding:3px 0;text-align:right;font-weight:600;color:#2e7d32;">${fullyPaid ? '₹0 (fully paid)' : fmt(due)}</td></tr>`
      : `
        <tr><td style="padding:3px 0;color:#2e7d32;font-weight:600;">Paid Online</td><td style="padding:3px 0;text-align:right;color:#2e7d32;font-weight:600;">${fmt(d.total)} (100% prepaid)</td></tr>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;border:1px solid #e8ddd2;border-radius:8px;margin:16px 0;font-size:14px;color:#3d2c22;">
    <tr><td style="padding:12px 16px 4px;font-weight:600;color:#8a6d57;font-size:12px;letter-spacing:.4px;text-transform:uppercase;">Payment Summary</td></tr>
    <tr><td style="padding:0 16px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        ${d.subtotal != null ? `<tr><td style="padding:3px 0;color:#6b5747;">Subtotal</td><td style="padding:3px 0;text-align:right;">${fmt(d.subtotal)}</td></tr>` : ''}
        ${d.discount ? `<tr><td style="padding:3px 0;color:#6b5747;">Discount</td><td style="padding:3px 0;text-align:right;">− ${fmt(d.discount)}</td></tr>` : ''}
        ${d.shipping != null ? `<tr><td style="padding:3px 0;color:#6b5747;">Shipping</td><td style="padding:3px 0;text-align:right;">${d.shipping === 0 ? 'Free' : fmt(d.shipping)}</td></tr>` : ''}
        ${d.codCharges ? `<tr><td style="padding:3px 0;color:#6b5747;">COD handling</td><td style="padding:3px 0;text-align:right;">${fmt(d.codCharges)}</td></tr>` : ''}
        ${d.gst ? `<tr><td style="padding:3px 0;color:#6b5747;">GST</td><td style="padding:3px 0;text-align:right;">${fmt(d.gst)}</td></tr>` : ''}
        <tr><td style="padding:8px 0 2px;border-top:1px solid #e8ddd2;font-weight:600;">Total Order Value</td><td style="padding:8px 0 2px;border-top:1px solid #e8ddd2;text-align:right;font-weight:600;">${fmt(d.total)}</td></tr>
        ${codRows}
      </table>
    </td></tr>
  </table>`;
};

const ITEMS_TABLE = (d: OrderEmailData): string => {
  const fmt = (n: number | null | undefined) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const rows = d.items.map(it => {
    const variant = [it.color, it.size ? `Size ${it.size}` : ''].filter(Boolean).join(' · ');
    return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e7dc;">
        <div style="font-weight:600;color:#3d2c22;">${it.name}</div>
        ${variant ? `<div style="font-size:12.5px;color:#8a6d57;">${variant}</div>` : ''}
        ${it.sku ? `<div style="font-size:12px;color:#a08a77;">SKU: ${it.sku}</div>` : ''}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e7dc;text-align:center;vertical-align:top;color:#6b5747;">× ${it.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e7dc;text-align:right;vertical-align:top;color:#3d2c22;">${fmt(it.lineTotal ?? (it.unitPrice || 0) * it.quantity)}</td>
    </tr>`;
  }).join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr><td colspan="3" style="padding:0 0 4px;font-weight:600;color:#8a6d57;font-size:12px;letter-spacing:.4px;text-transform:uppercase;">Items in this order (${d.items.reduce((s, i) => s + i.quantity, 0)})</td></tr>
    ${rows}
  </table>`;
};

const ADDRESS_BLOCK = (d: OrderEmailData): string => {
  if (!d.addressLines || d.addressLines.length === 0) return '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;border:1px solid #e8ddd2;border-radius:8px;margin:16px 0;">
    <tr><td style="padding:12px 16px;font-size:13.5px;color:#3d2c22;">
      <div style="font-weight:600;color:#8a6d57;font-size:12px;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px;">Delivery Address</div>
      ${d.addressLines.map(l => `<div>${l}</div>`).join('')}
      ${d.phone ? `<div style="margin-top:4px;">Phone: ${d.phone}</div>` : ''}
    </td></tr>
  </table>`;
};

const FOOTER = (d: OrderEmailData): string => `
  <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f0e7dc;font-size:12px;color:#a08a77;line-height:1.6;">
    Order reference: <strong style="color:#6b5747;">${d.orderNumber}</strong>${d.razorpayPaymentId ? ` · Payment ID: ${d.razorpayPaymentId}` : ''}<br/>
    Questions? Reply to this email or write to <a href="mailto:hello@frenchtoes.in" style="color:#b0533f;">hello@frenchtoes.in</a> — we reply within a day.<br/>
    French Toes · Handcrafted footwear, made to order in India.
  </div>`;

const EVENTS: Record<OrderEmailEvent, EventCopy> = {
  order_placed: {
    subject: (d) => `Order ${d.orderNumber} received — thank you!`,
    heading: 'Thank you for your order',
    intro: (d) => `We've received your order <strong>${d.orderNumber}</strong> and it is queued for confirmation.${d.isCod ? ' Please keep the exact change ready for the courier if you chose cash on delivery.' : ''}`,
    accent: '#b0533f',
  },
  order_confirmed: {
    subject: (d) => `Order ${d.orderNumber} confirmed — we're getting it ready`,
    heading: 'Your order is confirmed',
    intro: (d) => `Good news — order <strong>${d.orderNumber}</strong> is confirmed. Our team is preparing your pairs for dispatch.`,
    accent: '#2e7d32',
  },
  order_processing: {
    subject: (d) => `Order ${d.orderNumber} is being crafted`,
    heading: 'Your order is in production',
    intro: (d) => `Order <strong>${d.orderNumber}</strong> has moved into processing. Each French Toes pair is handmade, so this step takes a little time.`,
    accent: '#8a6d57',
  },
  order_shipped: {
    subject: (d) => `Order ${d.orderNumber} has shipped`,
    heading: 'Your order is on its way',
    intro: (d) => `Order <strong>${d.orderNumber}</strong> has been handed to the courier.`,
    accent: '#4a6fa5',
  },
  order_out_for_delivery: {
    subject: (d) => `Order ${d.orderNumber} is out for delivery today`,
    heading: 'Out for delivery today',
    intro: (d) => `Order <strong>${d.orderNumber}</strong> is on the delivery vehicle and should reach you today. Please keep ${d.isCod ? `₹${(d.balanceDue ?? 0).toLocaleString('en-IN')} ready (cash or UPI on delivery)` : 'your phone nearby'}.`,
    accent: '#4a6fa5',
  },
  order_delivered: {
    subject: (d) => `Order ${d.orderNumber} delivered — enjoy your new pairs`,
    heading: 'Delivered',
    intro: (d) => `Order <strong>${d.orderNumber}</strong> has been delivered. We hope the fit feels right from the first wear. If anything is off, exchanges are easy within 5 days from your account.`,
    accent: '#2e7d32',
  },
  order_cancelled: {
    subject: (d) => `Order ${d.orderNumber} has been cancelled`,
    heading: 'Your order was cancelled',
    intro: (d) => `Order <strong>${d.orderNumber}</strong> has been cancelled.`,
    note: (d) => d.isCod
      ? `Since this was a COD order, no online amount needs refunding beyond the ₹${(d.advancePaid || 0).toLocaleString('en-IN')} advance already paid — it will be refunded to your original payment method within 5–7 working days.`
      : `A refund of the full amount (${`₹${d.total.toLocaleString('en-IN')}`}) will be credited to your original payment method within 5–7 working days.`,
    accent: '#b0533f',
  },
  cancellation_requested: {
    subject: (d) => `Cancellation request received — Order ${d.orderNumber}`,
    heading: 'We received your cancellation request',
    intro: (d) => `We've received your request to cancel order <strong>${d.orderNumber}</strong>. Our team will review it and confirm shortly — nothing has been cancelled yet.`,
    accent: '#8a6d57',
  },
  cancellation_approved: {
    subject: (d) => `Order ${d.orderNumber} cancellation approved`,
    heading: 'Cancellation approved',
    intro: (d) => `Your cancellation request for order <strong>${d.orderNumber}</strong> has been approved and the order is now cancelled.`,
    note: (d) => d.isCod
      ? `The ₹${(d.advancePaid || 0).toLocaleString('en-IN')} advance you paid online will be refunded to your original payment method within 5–7 working days.`
      : `A full refund of ₹${d.total.toLocaleString('en-IN')} will be credited to your original payment method within 5–7 working days.`,
    accent: '#b0533f',
  },
  cancellation_rejected: {
    subject: (d) => `Update on your cancellation request — Order ${d.orderNumber}`,
    heading: 'Your order is still on track',
    intro: (d) => `We weren't able to cancel order <strong>${d.orderNumber}</strong> as it has already entered dispatch preparation. If this is urgent, reply to this email and we'll do our best.`,
    accent: '#8a6d57',
  },
  cod_balance_collected: {
    subject: (d) => `Payment received in full — Order ${d.orderNumber}`,
    heading: 'Your order is fully paid',
    intro: (d) => `We've received the pending balance for order <strong>${d.orderNumber}</strong>. There is nothing more to pay.`,
    accent: '#2e7d32',
  },
  order_fully_paid: {
    subject: (d) => `Payment confirmed — Order ${d.orderNumber}`,
    heading: 'Payment confirmed',
    intro: (d) => `We've received your full payment for order <strong>${d.orderNumber}</strong>. Thank you!`,
    accent: '#2e7d32',
  },
  return_requested: {
    subject: (d) => `Return request received — Order ${d.orderNumber}`,
    heading: 'Return request received',
    intro: (d) => `We've received your return request for order <strong>${d.orderNumber}</strong>. Our team will review and arrange the pickup.`,
    accent: '#8a6d57',
  },
  return_approved: {
    subject: (d) => `Return approved — Order ${d.orderNumber}`,
    heading: 'Return approved',
    intro: (d) => `Your return for order <strong>${d.orderNumber}</strong> has been approved. Pickup details will follow.`,
    accent: '#2e7d32',
  },
  exchange_created: {
    subject: (d) => `Exchange shipment created — Order ${d.orderNumber}`,
    heading: 'Exchange on the way',
    intro: (d) => `A replacement for your exchange on order <strong>${d.orderNumber}</strong> has been dispatched.`,
    accent: '#4a6fa5',
  },
};

/** Compose the full email for an event. */
export function buildOrderEmail(event: OrderEmailEvent, d: OrderEmailData) {
  const copy = EVENTS[event] ?? EVENTS.order_confirmed;
  const fmt = (n: number | null | undefined) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const due = d.balanceDue ?? (d.isCod ? Math.max(0, d.total - (d.advancePaid || 0)) : 0);
  const paymentLine = d.isCod
    ? `COD — ${fmt(d.advancePaid || 0)} paid online, ${due > 0 ? `${fmt(due)} due on delivery` : 'fully paid'}`
    : `Prepaid — ${fmt(d.total)} paid online`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fff7f3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #f0e0d6;border-radius:12px;font-family:Georgia,'Times New Roman',serif;">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:18px;letter-spacing:2px;color:#b0533f;font-family:Georgia,serif;">FRENCH TOES</div>
        </td></tr>
        <tr><td style="padding:16px 28px 0;">
          <h1 style="margin:0;font-size:21px;color:${copy.accent};font-weight:normal;">${copy.heading}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#3d2c22;font-family:Arial,Helvetica,sans-serif;">${d.customerName ? `Hi ${d.customerName},` : 'Hello,'}</p>
          <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#3d2c22;font-family:Arial,Helvetica,sans-serif;">${copy.intro(d)}</p>
          ${copy.note ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#6b5747;font-family:Arial,Helvetica,sans-serif;">${copy.note(d)}</p>` : ''}
          ${event === 'order_shipped' && d.eventId ? `<p style="margin:8px 0 0;font-size:14px;color:#4a6fa5;font-family:Arial,Helvetica,sans-serif;">Tracking: <a href="https://shiprocket.co/tracking/${d.eventId}" style="color:#4a6fa5;">${d.eventId}</a></p>` : ''}
        </td></tr>
        <tr><td style="padding:8px 28px 20px;font-family:Arial,Helvetica,sans-serif;">
          ${ITEMS_TABLE(d)}
          ${PAYMENT_TABLE(d)}
          <div style="font-size:13.5px;color:#6b5747;margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;"><strong>Payment:</strong> ${paymentLine}${d.paymentStatusLabel ? ` · ${d.paymentStatusLabel}` : ''}</div>
          ${ADDRESS_BLOCK(d)}
          <div style="margin:18px 0 0;">
            <a href="https://frenchtoes.in/account/orders" style="display:inline-block;background:#b0533f;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:14px;font-family:Arial,Helvetica,sans-serif;">View order status</a>
          </div>
          ${FOOTER(d)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject(d), html };
}

/** Shorter admin alert email with the same order detail block. */
export function buildAdminOrderEmail(event: OrderEmailEvent, d: OrderEmailData, extra?: string) {
  const { subject: customerSubject } = buildOrderEmail(event, d);
  const fmt = (n: number | null | undefined) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const due = d.balanceDue ?? (d.isCod ? Math.max(0, d.total - (d.advancePaid || 0)) : 0);

  const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#fff7f3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e8ddd2;border-radius:10px;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="padding:20px 24px 0;">
          <div style="font-size:12px;color:#8a6d57;letter-spacing:1px;">FRENCH TOES · ADMIN</div>
          <h2 style="margin:8px 0 0;font-size:18px;color:#3d2c22;">${extra || customerSubject}</h2>
          <p style="margin:10px 0 0;font-size:14px;color:#3d2c22;">Order <strong>${d.orderNumber}</strong> · ${d.customerName || 'Customer'} · ${d.phone || ''}</p>
          ${d.addressLines?.length ? `<p style="margin:4px 0 0;font-size:13px;color:#6b5747;">${d.addressLines.join(', ')}</p>` : ''}
        </td></tr>
        <tr><td style="padding:8px 24px 20px;">
          ${ITEMS_TABLE(d)}
          ${PAYMENT_TABLE(d)}
          <p style="font-size:13px;color:#6b5747;margin:8px 0 0;">${d.isCod ? `COD · advance ${fmt(d.advancePaid || 0)} · due ${fmt(due)}` : `Prepaid · ${fmt(d.total)}`}${d.razorpayPaymentId ? ` · RZP ${d.razorpayPaymentId}` : ''}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: `[Admin] ${customerSubject}`, html };
}

/** Sends via Brevo. Never throws; returns messageId or null. */
export async function sendBrevoEmail(
  apiKey: string,
  fromEmail: string,
  to: { email: string; name?: string }[],
  subject: string,
  html: string,
  replyTo?: string
): Promise<string | null> {
  if (!apiKey || to.length === 0) return null;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: 'French Toes', email: fromEmail },
        to,
        subject,
        htmlContent: html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
    });
    if (!res.ok) {
      console.warn('[OrderEmails] Brevo send failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.messageId ?? null;
  } catch (e: any) {
    console.warn('[OrderEmails] Brevo send error:', e?.message);
    return null;
  }
}

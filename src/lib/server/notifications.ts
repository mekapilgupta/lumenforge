import { supabaseAdmin } from '$lib/server/shiprocket';
import { env } from '$env/dynamic/private';

const brevoApiKey = env.BREVO_API_KEY || (typeof process !== 'undefined' ? process.env.BREVO_API_KEY : '');
const adminEmails = (env.ADMIN_NOTIFICATION_EMAILS || (typeof process !== 'undefined' ? process.env.ADMIN_NOTIFICATION_EMAILS : '') || 'kapilgupta@duck.com')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

export interface NotificationPayload {
  type: 'new_order' | 'order_delivered' | 'return_requested' | 'exchange_requested' | 'cancellation_requested' | 'customer_message' | 'low_stock' | 'system_alert';
  title: string;
  message: string;
  link_url?: string;
  reference_id?: string;
}

/**
 * Creates an admin notification in the database and broadcasts to realtime channels
 */
export async function createAdminNotification(payload: NotificationPayload) {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link_url: payload.link_url || null,
        reference_id: payload.reference_id || null,
        is_read: false,
        is_reviewed: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn('[Admin Notifications] Insert error (table may need creation):', error.message);
    }

    // Optional email alert to admin for high-priority items
    if (['new_order', 'return_requested', 'cancellation_requested'].includes(payload.type)) {
      sendAdminNotificationEmail(payload.title, payload.message, payload.link_url);
    }

    return { success: true, notification: data };
  } catch (err: any) {
    console.error('[Admin Notifications Exception]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to send email to admin via Brevo
 */
async function sendAdminNotificationEmail(title: string, message: string, linkUrl?: string) {
  if (!brevoApiKey || adminEmails.length === 0) return;

  const fullUrl = linkUrl ? `https://frenchtoes.in${linkUrl}` : 'https://frenchtoes.in/admin';

  for (const email of adminEmails) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: 'French Toes Alerts', email: 'alerts@frenchtoes.in' },
          to: [{ email, name: 'Admin' }],
          subject: `🔔 ${title} — French Toes Admin`,
          htmlContent: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
              <h2 style="color: #d81b60; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">
                ${title}
              </h2>
              <p style="font-size: 15px; color: #5c3d2e; line-height: 1.6;">
                ${message}
              </p>
              <div style="margin: 20px 0;">
                <a href="${fullUrl}" style="background-color: #d81b60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                  Open in Admin Panel →
                </a>
              </div>
              <p style="font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                French Toes Ecommerce System Alert · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          `,
        }),
      });
    } catch (e: any) {
      console.warn(`[Admin Notification Email Failed for ${email}]:`, e.message);
    }
  }
}

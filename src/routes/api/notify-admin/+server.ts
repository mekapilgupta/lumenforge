export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const ADMIN_EMAILS = ["kapilgupta@duck.com", "hello@frenchtoes.in", "FRENCHTOESAPPARELS@GMAIL.COM"];

export async function POST({ request }) {
    console.log('[Admin Notify API] Request received');
    try {
        const body = await request.json();
        const { eventType, details } = body;

        if (!eventType) {
            return json({ error: 'eventType is required' }, { status: 400 });
        }

        let subject = '';
        let htmlContent = '';

        if (eventType === 'Signup') {
            subject = `[Admin Notification] New User Signup: ${details?.email || 'N/A'}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f4a7c3; border-radius: 16px; background: #fff;">
                    <h2 style="color: #6b4c6e; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">New User Signup 👟</h2>
                    <p style="font-size: 14px;">A new customer has just signed up on <strong>frenchtoes.in</strong>.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px; font-size: 13px;">Email:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${details?.email || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">User ID:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px;">${details?.userId || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">Signed Up At:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (eventType === 'Checkout') {
            subject = `[Admin Notification] New Order Placed: #${details?.orderNumber || 'N/A'}`;

            // Format order items
            let itemsHtml = '';
            if (Array.isArray(details?.items)) {
                itemsHtml = details.items.map((item: any) => `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${item.name} (${item.color || 'N/A'}, Size ${item.size || 'N/A'})</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-size: 13px;">${item.quantity}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-size: 13px;">₹${item.price?.toLocaleString('en-IN')}</td>
                    </tr>
                `).join('');
            }

            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f4a7c3; border-radius: 16px; background: #fff;">
                    <h2 style="color: #6b4c6e; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">New Order Placed 🌸</h2>
                    <p style="font-size: 14px;">An order has been successfully placed by <strong>${details?.customerName || 'Customer'}</strong>.</p>
                    
                    <h3 style="color: #6b4c6e; margin-top: 20px; margin-bottom: 10px; font-size: 15px;">Order Info</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px; font-size: 13px;">Order Number:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold; color: #d4a574; font-size: 13px;">#${details?.orderNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">Customer Email:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${details?.customerEmail || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">Total Amount:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #7ecba1; font-size: 13px;">₹${details?.amount?.toLocaleString('en-IN') || '0'}</td>
                        </tr>
                    </table>

                    <h3 style="color: #6b4c6e; margin-top: 20px; margin-bottom: 10px; font-size: 15px;">Items Ordered</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f5f0eb;">
                                <th style="padding: 8px; text-align: left; font-size: 12px; text-transform: uppercase;">Product</th>
                                <th style="padding: 8px; text-align: center; font-size: 12px; text-transform: uppercase; width: 50px;">Qty</th>
                                <th style="padding: 8px; text-align: right; font-size: 12px; text-transform: uppercase; width: 80px;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml || '<tr><td colspan="3" style="padding: 8px; text-align: center; font-size: 13px;">No items info</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (eventType === 'Cancellation') {
            subject = `[Admin Notification] Order Cancelled: #${details?.orderNumber || 'N/A'}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ff7f6e; border-radius: 16px; background: #fff;">
                    <h2 style="color: #ff7f6e; border-bottom: 2px solid #ff7f6e; padding-bottom: 10px; margin-top: 0;">Order Cancelled 💔</h2>
                    <p style="font-size: 14px;">An order has been cancelled.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px; font-size: 13px;">Order Number:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold; font-size: 13px;">#${details?.orderNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">Cancelled By:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 13px;">${details?.cancelledBy || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">Cancellation Reason:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-style: italic; color: #ef4444; font-size: 13px;">${details?.reason || 'No reason provided'}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else {
            return json({ error: 'Invalid eventType' }, { status: 400 });
        }

        // Send emails to each admin in the list
        const results = [];
        for (const email of ADMIN_EMAILS) {
            console.log(`[Admin Notify API] Sending ${eventType} email to ${email}`);
            const brevoPayload = {
                sender: {
                    name: 'FrenchToes Alerts',
                    email: 'alerts@frenchtoes.in'
                },
                to: [
                    {
                        email: email,
                        name: 'Admin'
                    }
                ],
                subject: subject,
                htmlContent: htmlContent
            };

            const brevoApiKey = env.BREVO_API_KEY || (typeof process !== 'undefined' ? process.env.BREVO_API_KEY : undefined) || '';
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey
                },
                body: JSON.stringify(brevoPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Admin Notify API] Brevo Error for ${email}:`, JSON.stringify(errorData, null, 2));
                results.push({ email, success: false, details: errorData });
            } else {
                const data = await response.json();
                results.push({ email, success: true, messageId: data.messageId });
            }
        }

        const successCount = results.filter(r => r.success).length;
        if (successCount === 0) {
            return json({ error: 'Failed to send notification to any admin', results }, { status: 500 });
        }

        return json({ success: true, results }, { status: 200 });

    } catch (error: any) {
        console.error('[Admin Notify API] Unexpected error:', error);
        return json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

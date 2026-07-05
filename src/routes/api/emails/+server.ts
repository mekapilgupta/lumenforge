export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
    const brevoApiKey = env.BREVO_API_KEY || (typeof process !== 'undefined' ? process.env.BREVO_API_KEY : undefined) || '';
    console.log('[Email API] === Request received ===');
    console.log('[Email API] BREVO_API_KEY present:', !!brevoApiKey);
    console.log('[Email API] BREVO_API_KEY starts with:', brevoApiKey ? brevoApiKey.substring(0, 15) + '...' : 'MISSING');

    try {
        const body = await request.json();
        console.log('[Email API] Request body:', JSON.stringify(body, null, 2));

        const { type, recipientEmail, recipientName, payloadData } = body;

        if (!recipientEmail || !type) {
            console.log('[Email API] Validation failed - missing email or type');
            return json({ error: 'Email and type are required' }, { status: 400 });
        }

        let subject = '';
        let htmlContent = '';

        // 1. Define Templates based on the type
        if (type === 'signup') {
            console.log('[Email API] Processing signup email for:', recipientEmail);
            subject = 'Welcome to FrenchToes!';
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">Welcome to the FrenchToes Family, ${recipientName || 'there'}! 👟</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">We are thrilled to have you here. Get ready for the best pastel footwear experience designed for ultimate comfort.</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Use coupon code <strong style="color: #ff7f6e; background-color: #faf5f0; padding: 4px 8px; border-radius: 6px; font-family: monospace;">WELCOME10</strong> for 10% off your first pair!</p>
                </div>
            `;
        } else if (type === 'transactional') {
            console.log('[Email API] Processing transactional email for:', recipientEmail, 'orderId:', payloadData?.orderId);
            subject = `Order Confirmation: ${payloadData?.orderId || 'Your FrenchToes Order'}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">Thank you for your order, ${recipientName || 'Customer'}!</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">We have successfully received your order (<strong>#${payloadData?.orderId || 'N/A'}</strong>).</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your order total is <strong>₹${(payloadData?.amount ? (payloadData.amount / 100).toLocaleString('en-IN') : 'the total amount')}</strong>. Your order is now being processed and will be shipped soon.</p>
                </div>
            `;
        } else if (type === 'status_update') {
            console.log('[Email API] Processing status_update email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            subject = `Update on your Order #${payloadData?.orderNumber}: ${payloadData?.newStatusLabel}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">Your order status has been updated! 📦</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Dear Customer,</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your order (<strong>#${payloadData?.orderNumber}</strong>) status was updated to <strong>${payloadData?.newStatusLabel}</strong>.</p>
                    ${payloadData?.comment ? `
                        <div style="margin: 15px 0; padding: 15px; background-color: #faf5f0; border-left: 4px solid #f4a7c3; border-radius: 8px;">
                            <strong style="color: #5c3d2e; font-size: 14px;">Updates/Comments:</strong>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #8b6f5e; font-style: italic;">"${payloadData.comment}"</p>
                        </div>
                    ` : ''}
                    <p style="font-size: 13px; color: #8b6f5e; margin-top: 20px;">You can view your complete order history and timeline by logging in to your account.</p>
                </div>
            `;
        } else if (type === 'new_message') {
            console.log('[Email API] Processing new_message email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            subject = `New message on Order #${payloadData?.orderNumber}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">New Comment/Message Posted 💬</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">There is a new update regarding your order (<strong>#${payloadData?.orderNumber}</strong>) from <strong>${payloadData?.senderName}</strong>:</p>
                    <div style="margin: 15px 0; padding: 15px; background-color: #faf5f0; border: 1px dashed #f4a7c3; border-radius: 12px;">
                        <p style="margin: 0; font-size: 14px; color: #5c3d2e; line-height: 1.5;">${payloadData?.messageText}</p>
                    </div>
                    <p style="font-size: 13px; color: #8b6f5e; margin-top: 20px;">Please do not reply directly to this automated email. Log in to your French Toes dashboard to reply.</p>
                </div>
            `;
        } else if (type === 'cancellation_response') {
            console.log('[Email API] Processing cancellation_response email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            const isApproved = payloadData?.approved;
            subject = `Cancellation Request ${isApproved ? 'Approved' : 'Rejected'}: Order #${payloadData?.orderNumber}`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid ${isApproved ? '#ef4444' : '#7ecba1'}; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: ${isApproved ? '#ef4444' : '#7ecba1'}; font-family: Georgia, serif; border-bottom: 2px solid ${isApproved ? '#ef4444' : '#7ecba1'}; padding-bottom: 10px; margin-top: 0;">
                        Cancellation Request ${isApproved ? 'Approved 💔' : 'Update'}
                    </h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Dear Customer,</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">
                        Your cancellation request for Order <strong>#${payloadData?.orderNumber}</strong> has been 
                        <strong>${isApproved ? 'APPROVED and processed' : 'REJECTED by our support team'}</strong>.
                    </p>
                    ${isApproved ? `
                        <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">If you paid online, the refund will be credited back to your account within 5-7 business days.</p>
                    ` : `
                        <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your order has been resumed and is continuing through its processing steps.</p>
                    `}
                    ${payloadData?.comment ? `
                        <div style="margin: 15px 0; padding: 15px; background-color: #faf5f0; border-left: 4px solid ${isApproved ? '#ef4444' : '#7ecba1'}; border-radius: 8px;">
                            <strong style="color: #5c3d2e; font-size: 14px;">Store Response/Comment:</strong>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #8b6f5e; font-style: italic;">"${payloadData.comment}"</p>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            console.log('[Email API] Invalid email type:', type);
            return json({ error: 'Invalid email type' }, { status: 400 });
        }

        // 2. Prepare the Brevo API Request
        const brevoPayload = {
            sender: {
                name: 'FrenchToes',
                email: 'alerts@frenchtoes.in'
            },
            to: [
                {
                    email: recipientEmail,
                    name: recipientName || ''
                }
            ],
            subject: subject,
            htmlContent: htmlContent
        };
        console.log('[Email API] Brevo payload:', JSON.stringify(brevoPayload, null, 2));

        // 3. Send via Brevo HTTP API
        console.log('[Email API] Calling Brevo API...');
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
            },
            body: JSON.stringify(brevoPayload)
        });

        console.log('[Email API] Brevo response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Email API] Brevo Error:', JSON.stringify(errorData, null, 2));
            return json({ error: 'Failed to send email via Brevo', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        console.log('[Email API] Brevo success! messageId:', data.messageId);
        return json({ success: true, messageId: data.messageId }, { status: 200 });

    } catch (error) {
        console.error('[Email API] Unexpected error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

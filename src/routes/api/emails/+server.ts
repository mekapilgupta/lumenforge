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
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your order is confirmed and is now being processed. We'll notify you once it ships! 🌸</p>
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
        } else if (type === 'order_shipped') {
            console.log('[Email API] Processing order_shipped email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            const awb = payloadData?.awb || 'N/A';
            const courier = payloadData?.courier || 'our delivery partner';
            const trackingUrl = payloadData?.trackingUrl || (awb !== 'N/A' ? `https://shiprocket.co/tracking/${awb}` : 'https://frenchtoes.in/account/orders');
            subject = `Your French Toes Order #${payloadData?.orderNumber || ''} is on its way! 🚚`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">Good news! Your order has shipped! 🚚</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Dear ${recipientName || 'Customer'},</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your French Toes order (<strong>#${payloadData?.orderNumber || 'N/A'}</strong>) has been handed over to <strong>${courier}</strong>.</p>
                    
                    <div style="margin: 20px 0; padding: 18px; background-color: #faf5f0; border: 1px solid #f4a7c3; border-radius: 12px;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #5c3d2e;"><strong>Courier Partner:</strong> ${courier}</p>
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #5c3d2e;"><strong>Tracking Number (AWB):</strong> <span style="font-family: monospace; font-weight: bold; background: #fff; padding: 3px 8px; border-radius: 4px; border: 1px solid #e0d0c5;">${awb}</span></p>
                        ${payloadData?.etd ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #5c3d2e;"><strong>Estimated Delivery:</strong> ${payloadData.etd}</p>` : ''}
                        <div style="margin-top: 15px;">
                            <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #ff7f6e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">Track Your Shipment →</a>
                        </div>
                    </div>

                    <p style="font-size: 13px; color: #8b6f5e;">You can also track your live order checkpoints anytime by logging in to your <a href="https://frenchtoes.in/account/orders" style="color: #ff7f6e;">French Toes account</a>.</p>
                </div>
            `;
        } else if (type === 'order_out_for_delivery') {
            console.log('[Email API] Processing order_out_for_delivery email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            const awb = payloadData?.awb || 'N/A';
            const courier = payloadData?.courier || 'Our delivery partner';
            const trackingUrl = payloadData?.trackingUrl || (awb !== 'N/A' ? `https://shiprocket.co/tracking/${awb}` : 'https://frenchtoes.in/account/orders');
            subject = `Your French Toes Order #${payloadData?.orderNumber || ''} is Out for Delivery today! 🏃`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">Out for Delivery Today! 🏃💨</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Dear ${recipientName || 'Customer'},</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your package (Order <strong>#${payloadData?.orderNumber || 'N/A'}</strong>) is out for delivery with ${courier} and will arrive today!</p>
                    
                    <div style="margin: 20px 0; padding: 18px; background-color: #faf5f0; border: 1px solid #f4a7c3; border-radius: 12px;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #5c3d2e;"><strong>Tracking Number (AWB):</strong> ${awb}</p>
                        <p style="margin: 0; font-size: 13px; color: #8b6f5e;">Please keep your phone handy. The delivery associate may contact you upon arrival.</p>
                        <div style="margin-top: 15px;">
                            <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #ff7f6e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">View Live Status →</a>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'order_delivered') {
            console.log('[Email API] Processing order_delivered email for:', recipientEmail, 'orderNumber:', payloadData?.orderNumber);
            subject = `Delivered! Your French Toes Order #${payloadData?.orderNumber || ''} has arrived 🎉`;
            htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #7ecba1; border-radius: 16px; background-color: #fffdf9;">
                    <h2 style="color: #2e7d32; font-family: Georgia, serif; border-bottom: 2px solid #7ecba1; padding-bottom: 10px; margin-top: 0;">Your Order has been Delivered! 🎉</h2>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Dear ${recipientName || 'Customer'},</p>
                    <p style="font-size: 15px; color: #5c3d2e; line-height: 1.5;">Your French Toes order (<strong>#${payloadData?.orderNumber || 'N/A'}</strong>) was successfully delivered. We hope you fall in love with your new pairs! ✨</p>
                    
                    <div style="margin: 20px 0; padding: 18px; background-color: #f1f8e9; border: 1px solid #a5d6a7; border-radius: 12px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #2e7d32; font-weight: bold;">How did we do?</p>
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #5c3d2e;">We would love to hear your feedback on the comfort, fit, and style!</p>
                        <a href="https://frenchtoes.in/account/orders" style="display: inline-block; background-color: #2e7d32; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">Leave a Review / View Order →</a>
                    </div>

                    <p style="font-size: 13px; color: #8b6f5e;">Need an exchange or return? You can initiate it easily within 15 days directly from your account dashboard.</p>
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

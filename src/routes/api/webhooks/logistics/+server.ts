export const prerender = false;
import { json } from '@sveltejs/kit';
import { LOGISTICS_WEBHOOK_SECRET } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Initialize Supabase Admin client
const supabaseUrl = env.PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined);
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.MYSUPABASE_SERVICE_ROLE_KEY || (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MYSUPABASE_SERVICE_ROLE_KEY) : undefined) || PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

export async function POST({ request }) {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader !== LOGISTICS_WEBHOOK_SECRET) {
        console.warn('[Logistics Webhook] Unauthorized request received');
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await request.json();
        console.log('[Logistics Webhook] Received payload:', JSON.stringify(payload, null, 2));

        const orderId = payload.channel_order_id; 
        const shiprocketStatus = payload.current_status;
        const awbCode = payload.awb;

        if (!orderId || orderId === "enter your channel order id" || orderId === "00000000-0000-0000-0000-000000000000") {
             console.log('[Logistics Webhook] Test or dummy payload ignored');
             return json({ success: true, message: 'Test payload ignored' });
        }

        let dbStatus = 'processing';
        const statusMap: Record<string, string> = {
            'Delivered': 'delivered',
            'Out for Delivery': 'out_for_delivery',
            'Shipped': 'shipped',
            'In Transit': 'shipped',
            'Cancelled': 'cancelled',
            'RTO Delivered': 'returned'
        };

        if (statusMap[shiprocketStatus]) {
            dbStatus = statusMap[shiprocketStatus];
        }

        console.log(`[Logistics Webhook] Mapping status "${shiprocketStatus}" to database status "${dbStatus}"`);

        // Update Orders Table
        console.log(`[Logistics Webhook] Updating orders table for order: ${orderId}`);
        const { error: orderError } = await supabaseAdmin
            .from('orders')
            .update({ status: dbStatus, awb_code: awbCode })
            .eq('id', orderId);

        if (orderError) {
            console.error('[Logistics Webhook] Failed to update orders table:', orderError);
            return json({ error: 'Database update failed', details: orderError.message }, { status: 500 });
        }

        // Update Order Logs
        const latestScan = payload.scans && payload.scans.length > 0 ? payload.scans[0] : null;
        if (latestScan) {
            console.log('[Logistics Webhook] Inserting order activity log...');
            const { error: logError } = await supabaseAdmin
                .from('order_logs')
                .insert({
                    order_id: orderId,
                    status: dbStatus,
                    note: `${latestScan.activity} at ${latestScan.location}`,
                    metadata: latestScan
                });

            if (logError) {
                console.warn('[Logistics Webhook] Warning: Failed to insert activity log:', logError);
            }
        }

        console.log('[Logistics Webhook] Processing completed successfully.');
        return json({ success: true });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export const prerender = false;
import { json } from '@sveltejs/kit';
import { syncOrderWithShiprocket, fetchShiprocketTracking } from '$lib/server/shiprocket';
import { supabaseAdmin } from '$lib/server/shiprocket';

export async function GET({ params }) {
  const orderId = params.orderId;
  if (!orderId) {
    return json({ error: 'Missing orderId parameter' }, { status: 400 });
  }

  try {
    // 1. Fetch current order from DB
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, shiprocket_status, awb_code, courier_name, tracking_url, estimated_delivery_date, shipped_at, delivered_at')
      .or(`id.eq.${orderId},order_number.eq.${orderId},awb_code.eq.${orderId}`)
      .maybeSingle();

    if (error || !order) {
      return json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Fetch logs/scans from order_logs
    const { data: logs } = await supabaseAdmin
      .from('order_logs')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    // 3. Attempt live sync if AWB is present or status is open
    let liveTracking = null;
    if (order.awb_code) {
      try {
        liveTracking = await fetchShiprocketTracking(order.awb_code);
      } catch (e) {
        console.warn(`[Shiprocket Track API] Live tracking failed for ${order.awb_code}:`, (e as Error).message);
      }
    }

    const trackData = liveTracking?.tracking_data;
    const shipmentTrack = trackData?.shipment_track?.[0] || liveTracking?.shipment_track?.[0];
    const scans = trackData?.shipment_track_activities || shipmentTrack?.scans || [];

    return json({
      success: true,
      order,
      tracking: {
        awb: order.awb_code || shipmentTrack?.awb_code,
        courier: order.courier_name || shipmentTrack?.courier_name,
        currentStatus: order.shiprocket_status || shipmentTrack?.current_status,
        mappedStatus: order.status,
        trackingUrl: order.tracking_url || (order.awb_code ? `https://shiprocket.co/tracking/${order.awb_code}` : null),
        estimatedDelivery: order.estimated_delivery_date || shipmentTrack?.expected_date,
        scans: scans.length > 0 ? scans : (logs || []).map(l => ({
          activity: l.note,
          date: l.created_at,
          location: l.metadata?.location || '',
          status: l.status
        }))
      }
    });
  } catch (err: any) {
    console.error('[Shiprocket Track API] Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

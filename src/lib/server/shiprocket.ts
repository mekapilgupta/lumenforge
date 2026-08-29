import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = env.PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined);
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.MYSUPABASE_SERVICE_ROLE_KEY || (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MYSUPABASE_SERVICE_ROLE_KEY) : undefined) || PUBLIC_SUPABASE_ANON_KEY;

export const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

const shiprocketEmail = env.SHIPROCKET_API_EMAIL || (typeof process !== 'undefined' ? process.env.SHIPROCKET_API_EMAIL : undefined);
const shiprocketPassword = env.SHIPROCKET_API_PASSWORD || (typeof process !== 'undefined' ? process.env.SHIPROCKET_API_PASSWORD : undefined);
const brevoApiKey = env.BREVO_API_KEY || (typeof process !== 'undefined' ? process.env.BREVO_API_KEY : undefined);
const ADMIN_EMAILS = ['kapilgupta@duck.com', 'hello@frenchtoes.in', 'FRENCHTOESAPPARELS@GMAIL.COM'];

// Cache token in memory for sub-second responses, backed by database
let cachedToken: string | null = null;
let cachedTokenExpiry: number = 0;

/**
 * Retrieves valid Shiprocket authentication Bearer token.
 * Reuses active token from memory or `api_tokens` table; refreshes if expired.
 */
export async function getShiprocketToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedTokenExpiry > now + 60000) {
    return cachedToken;
  }

  // Check DB api_tokens table
  if (!forceRefresh) {
    const { data: dbToken } = await supabaseAdmin
      .from('api_tokens')
      .select('*')
      .eq('service_name', 'shiprocket')
      .maybeSingle();

    if (dbToken && new Date(dbToken.expires_at).getTime() > now + 60000) {
      cachedToken = dbToken.token;
      cachedTokenExpiry = new Date(dbToken.expires_at).getTime();
      return dbToken.token;
    }
  }

  console.log('[Shiprocket] Requesting new Bearer token from auth API...');
  const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: shiprocketEmail, password: shiprocketPassword }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Shiprocket] Auth failed:', res.status, errText);
    throw new Error(`Shiprocket auth failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const token = data.token;
  const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000); // 9 days

  cachedToken = token;
  cachedTokenExpiry = expiresAt.getTime();

  await supabaseAdmin.from('api_tokens').upsert({
    service_name: 'shiprocket',
    token: token,
    expires_at: expiresAt.toISOString(),
  });

  console.log('[Shiprocket] New auth token acquired and persisted.');
  return token;
}

/**
 * Status mapping from Shiprocket status string or status ID to French Toes DB OrderStatus
 */
export function mapShiprocketStatus(srStatus: string | number | undefined | null): string {
  if (!srStatus) return 'processing';
  const clean = String(srStatus).trim().toUpperCase();

  // Status ID or string mappings
  if (clean === 'DELIVERED' || clean === '7') return 'delivered';
  if (clean === 'OUT FOR DELIVERY' || clean === '17') return 'out_for_delivery';
  if (clean === 'SHIPPED' || clean === '6' || clean === 'IN TRANSIT' || clean === '18' || clean === 'PICKED UP' || clean === '19') return 'shipped';
  if (clean === 'PICKUP SCHEDULED' || clean === 'PICKUP GENERATED' || clean === 'PACKED' || clean === 'READY TO SHIP' || clean === '14' || clean === '15') return 'packed';
  if (clean === 'CANCELLED' || clean === 'CANCELED' || clean === '8') return 'cancelled';
  if (clean === 'RTO DELIVERED' || clean === '13') return 'returned';
  if (clean === 'RTO INITIATED' || clean === 'RTO IN TRANSIT' || clean === 'RTO OFD' || clean === '9' || clean === '10' || clean === '11') return 'shipped';
  if (clean === 'NEW' || clean === 'ORDER CREATED' || clean === '1') return 'confirmed';

  return 'processing';
}

/**
 * Fetch live tracking data directly from Shiprocket Courier Track API
 */
export async function fetchShiprocketTracking(awbOrOrderId: string): Promise<any> {
  const token = await getShiprocketToken();
  const clean = String(awbOrOrderId).trim();

  // 1. Try tracking by AWB code
  const awbUrl = `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${clean}`;
  let res = await fetch(awbUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401) {
    const refreshedToken = await getShiprocketToken(true);
    res = await fetch(awbUrl, { headers: { Authorization: `Bearer ${refreshedToken}` } });
  }

  if (res.ok) {
    const data = await res.json();
    if (data?.tracking_data?.track_status === 1 || data?.tracking_data?.shipment_track?.length) {
      return data;
    }
  }

  // 2. Try tracking by Shiprocket Order ID or channel order ID
  const orderTrackUrl = `https://apiv2.shiprocket.in/v1/external/courier/track?order_id=${clean}`;
  let res2 = await fetch(orderTrackUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res2.ok) {
    const data2 = await res2.json();
    return data2;
  }

  return null;
}

/**
 * Fetch full Shiprocket Order Details by Shiprocket Order ID
 */
export async function fetchShiprocketOrderDetails(srOrderId: string): Promise<any> {
  const token = await getShiprocketToken();
  const url = `https://apiv2.shiprocket.in/v1/external/orders/show/${srOrderId}`;
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401) {
    const refreshedToken = await getShiprocketToken(true);
    res = await fetch(url, { headers: { Authorization: `Bearer ${refreshedToken}` } });
  }

  if (res.ok) {
    return await res.json();
  }
  return null;
}

/**
 * Push an order from DB to Shiprocket
 */
export async function pushOrderToShiprocket(orderId: string): Promise<{ success: boolean; shiprocket_order_id?: string; error?: string }> {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      address:addresses!shipping_address_id(*),
      items:order_items(*),
      profile:user_id(full_name, email, phone)
    `)
    .or(`id.eq.${orderId},order_number.eq.${orderId}`)
    .maybeSingle();

  if (orderErr || !order) {
    return { success: false, error: orderErr?.message || 'Order not found' };
  }

  const token = await getShiprocketToken();
  const customerName = order.address?.full_name || order.profile?.full_name || 'Valued Customer';
  const add1 = order.address?.address_line1 || 'No Address Line 1';
  const add2 = order.address?.address_line2 || '';
  const city = order.address?.city || 'City Missing';
  const pincode = order.address?.pincode || '110001';
  const state = order.address?.state || 'State Missing';
  const email = order.profile?.email || order.payment_gateway_response?.email || 'customer@frenchtoes.in';
  const phone = order.address?.phone || order.profile?.phone || order.payment_gateway_response?.contact || '9999999999';
  const isCod = order.payment_method?.toLowerCase() === 'cod';

  const payload = {
    order_id: order.id,
    order_date: new Date(order.created_at || Date.now()).toISOString().split('T')[0],
    pickup_location: env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    channel_id: '11173693',
    billing_customer_name: customerName,
    billing_last_name: '',
    billing_address: add1,
    billing_address_2: add2,
    billing_city: city,
    billing_pincode: pincode,
    billing_state: state,
    billing_country: 'India',
    billing_email: email,
    billing_phone: phone,
    shipping_is_billing: true,
    order_items: (order.items || []).map((item: any) => {
      const size = item.variant_info?.size || item.size || '';
      const color = item.variant_info?.color || item.color || '';
      const variantSuffix = [color, size ? `Size ${size}` : ''].filter(Boolean).join(' - ');
      const itemName = variantSuffix ? `${item.product_name} (${variantSuffix})` : (item.product_name || 'French Toes Footwear');
      return {
        name: itemName,
        sku: item.product_sku || (item.product_id ? `FT-${item.product_id.substring(0, 8)}-${size || 'STD'}` : 'FT-DEFAULT-SKU'),
        units: item.quantity || 1,
        selling_price: (item.unit_price || 0) / 100,
        discount: (item.discount_amount || 0) / 100,
      };
    }),
    payment_method: isCod ? 'COD' : 'Prepaid',
    sub_total: (order.subtotal || order.total_amount || 0) / 100,
    shipping_charges: (order.shipping_charges || 0) / 100,
    discount: (order.discount_amount || 0) / 100,
    cod_amount: isCod ? (order.total_amount || 0) / 100 : 0,
    length: 30,
    breadth: 20,
    height: 10,
    weight: 1.0,
  };

  console.log('[Shiprocket Push] Sending adhoc payload:', JSON.stringify(payload, null, 2));

  const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const resData = await res.json();
  console.log('[Shiprocket Push] Response:', res.status, JSON.stringify(resData, null, 2));

  if (!res.ok || !resData.order_id) {
    return { success: false, error: resData.message || 'Failed to create order on Shiprocket' };
  }

  // Update order with Shiprocket details
  await supabaseAdmin
    .from('orders')
    .update({
      shiprocket_order_id: String(resData.order_id),
      shiprocket_shipment_id: String(resData.shipment_id || ''),
      shiprocket_status: 'NEW',
      status: order.status === 'pending' ? 'confirmed' : order.status,
      shiprocket_last_synced_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  return { success: true, shiprocket_order_id: String(resData.order_id) };
}

/**
 * Comprehensive Order Synchronization with Shiprocket
 * Syncs DB status, logs scans, triggers transactional emails & in-app alerts.
 */
export async function syncOrderWithShiprocket(orderIdOrAwb: string): Promise<{ success: boolean; order?: any; trackingData?: any; error?: string }> {
  console.log(`[Shiprocket Sync] Starting sync for identifier: ${orderIdOrAwb}`);

  // 1. Locate Order in Supabase
  let orderQuery = supabaseAdmin
    .from('orders')
    .select(`
      *,
      address:addresses!shipping_address_id(*),
      profile:user_id(id, full_name, email, phone)
    `);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrAwb);
  if (isUuid) {
    orderQuery = orderQuery.or(`id.eq.${orderIdOrAwb},razorpay_order_id.eq.${orderIdOrAwb},order_number.eq.${orderIdOrAwb},shiprocket_order_id.eq.${orderIdOrAwb},awb_code.eq.${orderIdOrAwb}`);
  } else {
    orderQuery = orderQuery.or(`order_number.eq.${orderIdOrAwb},shiprocket_order_id.eq.${orderIdOrAwb},awb_code.eq.${orderIdOrAwb},razorpay_order_id.eq.${orderIdOrAwb}`);
  }

  const { data: dbOrder, error: dbErr } = await orderQuery.maybeSingle();

  if (dbErr || !dbOrder) {
    console.error(`[Shiprocket Sync] Order not found for identifier: ${orderIdOrAwb}`, dbErr);
    return { success: false, error: dbErr?.message || 'Order not found in database' };
  }

  // 2. Query Tracking Info from Shiprocket
  const lookupKeys = [
    dbOrder.awb_code,
    orderIdOrAwb,
    dbOrder.shiprocket_order_id,
    dbOrder.id
  ].filter(Boolean);

  let trackingResult: any = null;
  for (const key of lookupKeys) {
    try {
      const data = await fetchShiprocketTracking(key);
      if (data && (data.tracking_data || data.shipment_track || Object.keys(data).length > 0)) {
        trackingResult = data;
        break;
      }
    } catch (e) {
      console.warn(`[Shiprocket Sync] Tracking lookup failed for key ${key}:`, (e as Error).message);
    }
  }

  // Also query order details if shiprocket_order_id exists to get courier details if tracking was sparse
  let srOrderDetails: any = null;
  if (dbOrder.shiprocket_order_id) {
    try {
      srOrderDetails = await fetchShiprocketOrderDetails(dbOrder.shiprocket_order_id);
    } catch (e) {
      console.warn('[Shiprocket Sync] Order details fetch error:', (e as Error).message);
    }
  }

  // Extract tracking information fields
  const trackData = trackingResult?.tracking_data;
  const shipmentTrack = trackData?.shipment_track?.[0] || trackingResult?.shipment_track?.[0] || srOrderDetails?.data?.shipments?.[0];

  const awbCode = shipmentTrack?.awb_code || trackData?.shipment_track?.[0]?.awb_code || dbOrder.awb_code || (orderIdOrAwb.length > 10 && !isUuid ? orderIdOrAwb : null);
  const courierName = shipmentTrack?.courier_name || shipmentTrack?.courier_company_id || srOrderDetails?.data?.courier_name || dbOrder.courier_name || null;
  const rawStatus = trackData?.shipment_track?.[0]?.current_status || shipmentTrack?.current_status || srOrderDetails?.data?.status || dbOrder.shiprocket_status || 'PROCESSING';
  const etd = shipmentTrack?.expected_date || shipmentTrack?.edd || trackData?.etd || dbOrder.estimated_delivery_date || null;
  const trackUrl = shipmentTrack?.track_url || (awbCode ? `https://shiprocket.co/tracking/${awbCode}` : dbOrder.tracking_url);

  const mappedDbStatus = mapShiprocketStatus(rawStatus);
  const oldStatus = dbOrder.status;
  const statusChanged = mappedDbStatus !== oldStatus;

  console.log(`[Shiprocket Sync] Order #${dbOrder.order_number}: SR Status="${rawStatus}" -> DB Status="${mappedDbStatus}" (Changed: ${statusChanged})`);

  // Prepare Update payload
  const updateData: Record<string, any> = {
    shiprocket_status: rawStatus,
    shiprocket_last_synced_at: new Date().toISOString(),
    status: mappedDbStatus,
  };

  if (awbCode && awbCode !== dbOrder.awb_code) updateData.awb_code = awbCode;
  if (courierName && courierName !== dbOrder.courier_name) updateData.courier_name = courierName;
  if (trackUrl && trackUrl !== dbOrder.tracking_url) updateData.tracking_url = trackUrl;
  if (etd && etd !== dbOrder.estimated_delivery_date) updateData.estimated_delivery_date = etd;

  if (mappedDbStatus === 'shipped' && !dbOrder.shipped_at) {
    updateData.shipped_at = new Date().toISOString();
  }
  if (mappedDbStatus === 'delivered' && !dbOrder.delivered_at) {
    updateData.delivered_at = new Date().toISOString();
    if (dbOrder.payment_method?.toLowerCase() === 'cod') {
      updateData.payment_status = 'paid';
    }
  }

  // Save updates to orders table
  const { data: updatedOrder, error: updateErr } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', dbOrder.id)
    .select('*')
    .single();

  if (updateErr) {
    console.error('[Shiprocket Sync] Failed to update orders table:', updateErr);
    return { success: false, error: updateErr.message };
  }

  // Record Activity Log / Scans
  const scans: any[] = trackData?.shipment_track_activities || shipmentTrack?.scans || [];
  if (scans && scans.length > 0) {
    for (const scan of scans.slice(0, 5)) {
      const scanDate = scan.date || scan.activity_date || new Date().toISOString();
      const activity = scan.activity || scan.sr_status_label || scan.status || rawStatus;
      const location = scan.location || scan.city || '';
      const note = `Shiprocket: ${activity}${location ? ` at ${location}` : ''}`;

      // Deduplicate log by note + order_id
      const { data: existingLog } = await supabaseAdmin
        .from('order_logs')
        .select('id')
        .eq('order_id', dbOrder.id)
        .eq('note', note)
        .maybeSingle();

      if (!existingLog) {
        await supabaseAdmin.from('order_logs').insert({
          order_id: dbOrder.id,
          status: mappedDbStatus,
          note: note,
          metadata: scan,
          created_at: scanDate,
        });
      }
    }
  } else if (statusChanged) {
    await supabaseAdmin.from('order_logs').insert({
      order_id: dbOrder.id,
      status: mappedDbStatus,
      note: `Shiprocket status updated to: ${rawStatus} (${courierName || 'Courier'} - AWB: ${awbCode || 'N/A'})`,
      metadata: { rawStatus, awbCode, courierName },
    });
  }

  // Customer In-App Notification
  const customerEmail = dbOrder.profile?.email || dbOrder.payment_gateway_response?.email || dbOrder.address?.email;
  const customerName = dbOrder.profile?.full_name || dbOrder.address?.full_name || 'Customer';
  const customerUserId = dbOrder.user_id || dbOrder.profile?.id;

  if (statusChanged && customerUserId) {
    let notifTitle = `Order Update: #${dbOrder.order_number}`;
    let notifMsg = `Your order status is now ${mappedDbStatus}.`;

    if (mappedDbStatus === 'shipped') {
      notifTitle = `Your order #${dbOrder.order_number} has shipped! 🚚`;
      notifMsg = `Package handed over to ${courierName || 'our courier partner'}. Tracking AWB: ${awbCode || 'Available'}`;
    } else if (mappedDbStatus === 'out_for_delivery') {
      notifTitle = `Out for delivery today! 🏃`;
      notifMsg = `Order #${dbOrder.order_number} is out for delivery with ${courierName || 'the courier'}.`;
    } else if (mappedDbStatus === 'delivered') {
      notifTitle = `Order Delivered! 🎉`;
      notifMsg = `Your French Toes order #${dbOrder.order_number} has been delivered. Enjoy your pair!`;
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: customerUserId,
      type: 'order_status_update',
      title: notifTitle,
      message: notifMsg,
      link_url: `/account/orders/${dbOrder.id}`,
      is_read: false,
    });
  }

  // Send Transactional Emails for Key Milestones
  if (statusChanged && customerEmail) {
    try {
      if (mappedDbStatus === 'shipped') {
        await sendTransactionalEmail('order_shipped', customerEmail, customerName, {
          orderNumber: dbOrder.order_number,
          awb: awbCode,
          courier: courierName,
          etd: etd,
          trackingUrl: trackUrl,
        });
      } else if (mappedDbStatus === 'out_for_delivery') {
        await sendTransactionalEmail('order_out_for_delivery', customerEmail, customerName, {
          orderNumber: dbOrder.order_number,
          awb: awbCode,
          courier: courierName,
          trackingUrl: trackUrl,
        });
      } else if (mappedDbStatus === 'delivered') {
        await sendTransactionalEmail('order_delivered', customerEmail, customerName, {
          orderNumber: dbOrder.order_number,
          awb: awbCode,
          courier: courierName,
        });
      }
    } catch (e) {
      console.warn('[Shiprocket Sync] Customer email notification threw error:', (e as Error).message);
    }
  }

  // Admin Notification Email for key events
  if (statusChanged && (mappedDbStatus === 'delivered' || mappedDbStatus === 'cancelled' || mappedDbStatus === 'returned')) {
    try {
      await sendAdminEmail(
        `Shipment ${rawStatus} — Order #${dbOrder.order_number}`,
        `<p>Shiprocket reports <b>${rawStatus}</b> for order <b>#${dbOrder.order_number}</b> (AWB: ${awbCode || 'N/A'}, Courier: ${courierName || 'N/A'}).</p>
         <p>Customer: ${customerName} (${customerEmail || '—'})</p>
         <p>Total: ₹${((dbOrder.total_amount || 0) / 100).toFixed(2)} (${dbOrder.payment_method?.toUpperCase() || 'PREPAID'} - ${dbOrder.payment_status?.toUpperCase() || 'PAID'})</p>`
      );
    } catch (e) {
      console.warn('[Shiprocket Sync] Admin email alert threw error:', (e as Error).message);
    }
  }

  console.log(`[Shiprocket Sync] Sync completed successfully for order #${dbOrder.order_number}`);
  return {
    success: true,
    order: updatedOrder || dbOrder,
    trackingData: {
      awb: awbCode,
      courier: courierName,
      status: rawStatus,
      mappedStatus: mappedDbStatus,
      etd: etd,
      trackUrl: trackUrl,
      scans: scans,
    }
  };
}

/**
 * Batch sync all in-flight orders with Shiprocket
 */
export async function syncAllActiveShiprocketOrders(): Promise<{ total: number; synced: number; errors: string[] }> {
  console.log('[Shiprocket Batch Sync] Starting batch sync for all active orders...');
  const { data: activeOrders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, awb_code, shiprocket_order_id, status')
    .not('status', 'in', '("delivered","cancelled","refunded","returned")')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !activeOrders) {
    console.error('[Shiprocket Batch Sync] Failed to fetch active orders:', error);
    return { total: 0, synced: 0, errors: [error?.message || 'Failed to fetch orders'] };
  }

  let syncedCount = 0;
  const errors: string[] = [];

  for (const order of activeOrders) {
    try {
      const res = await syncOrderWithShiprocket(order.id);
      if (res.success) syncedCount++;
      else if (res.error) errors.push(`Order #${order.order_number}: ${res.error}`);
    } catch (e) {
      errors.push(`Order #${order.order_number}: ${(e as Error).message}`);
    }
  }

  console.log(`[Shiprocket Batch Sync] Done. Synced ${syncedCount}/${activeOrders.length} orders.`);
  return { total: activeOrders.length, synced: syncedCount, errors };
}

/**
 * Send Transactional Email helper via Brevo
 */
async function sendTransactionalEmail(type: string, recipientEmail: string, recipientName: string, payloadData: any) {
  if (!brevoApiKey) return;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      sender: { name: 'French Toes', email: 'alerts@frenchtoes.in' },
      to: [{ email: recipientEmail, name: recipientName }],
      subject: type === 'order_shipped'
        ? `Your French Toes Order #${payloadData?.orderNumber} has shipped! 🚚`
        : type === 'order_out_for_delivery'
        ? `Your French Toes Order #${payloadData?.orderNumber} is Out for Delivery! 🏃`
        : `Delivered! Your French Toes Order #${payloadData?.orderNumber} has arrived 🎉`,
      htmlContent: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f4a7c3; border-radius: 16px; background-color: #fffdf9;">
          <h2 style="color: #5c3d2e; font-family: Georgia, serif; border-bottom: 2px solid #f4a7c3; padding-bottom: 10px; margin-top: 0;">
            ${type === 'order_shipped' ? 'Your Order Has Shipped! 🚚' : type === 'order_out_for_delivery' ? 'Out For Delivery Today! 🏃' : 'Your Order Is Delivered! 🎉'}
          </h2>
          <p style="font-size: 15px; color: #5c3d2e;">Dear ${recipientName},</p>
          <p style="font-size: 15px; color: #5c3d2e;">
            ${type === 'order_shipped'
              ? `Your French Toes order (<strong>#${payloadData?.orderNumber}</strong>) has been shipped via <strong>${payloadData?.courier || 'courier'}</strong>.`
              : type === 'order_out_for_delivery'
              ? `Your order (<strong>#${payloadData?.orderNumber}</strong>) is out for delivery today!`
              : `Your French Toes order (<strong>#${payloadData?.orderNumber}</strong>) has been delivered successfully!`}
          </p>
          ${payloadData?.awb ? `
            <div style="margin: 15px 0; padding: 15px; background: #faf5f0; border-radius: 10px;">
              <p style="margin: 0; font-size: 14px; color: #5c3d2e;"><strong>AWB Number:</strong> ${payloadData.awb}</p>
              ${payloadData?.courier ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #5c3d2e;"><strong>Courier:</strong> ${payloadData.courier}</p>` : ''}
              ${payloadData?.trackingUrl ? `<p style="margin: 10px 0 0 0;"><a href="${payloadData.trackingUrl}" target="_blank" style="color: #ff7f6e; font-weight: bold;">Click Here to Track Shipment →</a></p>` : ''}
            </div>
          ` : ''}
        </div>
      `,
    }),
  });
  if (!res.ok) {
    console.warn('[Shiprocket Email] Brevo send failed:', res.status, await res.text());
  }
}

/**
 * Send Admin Alert Email helper
 */
async function sendAdminEmail(subject: string, htmlContent: string) {
  if (!brevoApiKey || ADMIN_EMAILS.length === 0) return;
  for (const adminEmail of ADMIN_EMAILS) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: 'French Toes System', email: 'alerts@frenchtoes.in' },
          to: [{ email: adminEmail, name: 'Admin' }],
          subject,
          htmlContent,
        }),
      });
    } catch (e) {
      console.warn(`[Shiprocket Admin Email] Failed for ${adminEmail}:`, (e as Error).message);
    }
  }
}

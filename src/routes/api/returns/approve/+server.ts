export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin, createShiprocketReturnOrder } from '$lib/server/shiprocket';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const {
      returnId,
      mode = 'shiprocket',
      courierId,
      courierName,
      addressOverride,
      notes,
      manualCourier,
      manualAwb,
      pickupDate,
      sessionToken,
    } = body;

    if (!returnId) {
      return json({ success: false, error: 'Return ID is required' }, { status: 400 });
    }

    // Resolve authenticated client for admin operations
    const sessionCookie = cookies.get('sb-session');
    const authHeader = request.headers.get('authorization');
    let userToken = '';
    if (authHeader?.startsWith('Bearer ')) {
      userToken = authHeader.replace('Bearer ', '').trim();
    } else if (sessionToken) {
      userToken = String(sessionToken).trim();
    } else if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie));
        userToken = parsed.access_token || '';
      } catch {}
    }

    let adminClient = supabaseAdmin;
    if (userToken) {
      adminClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      });
    }

    if (mode === 'shiprocket') {
      // 1. Automated Shiprocket Reverse Pickup
      console.log(`[API Return Approve] Triggering Shiprocket Reverse API for return ${returnId}`, { courierId, courierName });
      const srResult = await createShiprocketReturnOrder(returnId, {
        courierId,
        courierName,
        addressOverride,
        notes,
        client: adminClient,
      });

      if (!srResult.success) {
        return json({
          success: false,
          error: `Shiprocket Return API error: ${srResult.error}`,
          canFallbackToManual: true,
        }, { status: 400 });
      }

      return json({
        success: true,
        message: `Shiprocket reverse pickup scheduled successfully via ${srResult.courier_name || 'Shiprocket'}! Return Order ID: ${srResult.return_order_id}, AWB: ${srResult.awb}`,
        data: srResult,
      });
    }

    // 2. Manual Schedule Fallback
    console.log(`[API Return Approve] Scheduling manual reverse pickup for return ${returnId}`);
    const { error: updateErr } = await adminClient
      .from('order_returns')
      .update({
        status: 'pickup_scheduled',
        pickup_scheduled_for: pickupDate || new Date().toISOString(),
        courier_name: manualCourier || 'Manual Courier',
        shiprocket_return_awb: manualAwb || 'MANUAL-AWB',
        admin_notes: `Manual Courier: ${manualCourier || 'Assigned'}, AWB: ${manualAwb || 'N/A'}. ${notes || ''}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId);

    if (updateErr) {
      return json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Manual reverse pickup recorded successfully!',
    });
  } catch (err: any) {
    console.error('[API Return Approve Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

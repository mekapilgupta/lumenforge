export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin, createShiprocketReturnOrder } from '$lib/server/shiprocket';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { returnId, mode = 'shiprocket', manualCourier, manualAwb, pickupDate, notes } = body;

    if (!returnId) {
      return json({ success: false, error: 'Return ID is required' }, { status: 400 });
    }

    if (mode === 'shiprocket') {
      // 1. Automated Shiprocket Reverse Pickup
      console.log(`[API Return Approve] Triggering Shiprocket Reverse API for return ${returnId}`);
      const srResult = await createShiprocketReturnOrder(returnId);

      if (!srResult.success) {
        return json({
          success: false,
          error: `Shiprocket Return API error: ${srResult.error}`,
          canFallbackToManual: true,
        }, { status: 400 });
      }

      return json({
        success: true,
        message: `Shiprocket reverse pickup created successfully! Return Order ID: ${srResult.return_order_id}, AWB: ${srResult.awb}`,
        data: srResult,
      });
    }

    // 2. Manual Schedule Fallback
    console.log(`[API Return Approve] Scheduling manual reverse pickup for return ${returnId}`);
    const { error: updateErr } = await supabaseAdmin
      .from('order_returns')
      .update({
        status: 'pickup_scheduled',
        pickup_scheduled_for: pickupDate || new Date().toISOString(),
        admin_notes: `Manual Courier: ${manualCourier || 'Assigned'}, AWB: ${manualAwb || 'N/A'}. ${notes || ''}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId);

    if (updateErr) {
      return json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Manual reverse pickup scheduled successfully!',
    });
  } catch (err: any) {
    console.error('[API Return Approve Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

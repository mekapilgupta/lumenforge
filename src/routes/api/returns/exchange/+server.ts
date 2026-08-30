export const prerender = false;
import { json } from '@sveltejs/kit';
import { createShiprocketExchangeOrder } from '$lib/server/shiprocket';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { returnId } = body;

    if (!returnId) {
      return json({ success: false, error: 'Return ID is required' }, { status: 400 });
    }

    const result = await createShiprocketExchangeOrder(returnId);
    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 400 });
    }

    return json({
      success: true,
      message: `Exchange replacement shipment dispatched via Shiprocket! Order ID: ${result.exchange_order_id}`,
      exchange_order_id: result.exchange_order_id,
    });
  } catch (err: any) {
    console.error('[API Exchange Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

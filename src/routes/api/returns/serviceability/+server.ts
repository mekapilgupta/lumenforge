export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin, getShiprocketReturnServiceability } from '$lib/server/shiprocket';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Check reverse courier serviceability for customer pickup location
 */
export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const { returnId, pincode: directPincode, sessionToken } = body;

    // Resolve admin authenticated client
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

    let client = supabaseAdmin;
    if (userToken) {
      client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      });
    }

    let customerPincode = directPincode || '';
    let customerDetails: any = null;

    if (returnId) {
      let ret: any = null;
      const { data: directRet } = await client
        .from('order_returns')
        .select(`
          id,
          order_id,
          customer_id,
          order:orders(
            id,
            order_number,
            shipping_address_id,
            total_amount,
            shipping_address:addresses!shipping_address_id(*),
            profile:user_id(full_name, email, phone)
          )
        `)
        .eq('id', returnId)
        .maybeSingle();

      ret = directRet;
      if (!ret && client !== supabaseAdmin) {
        const { data: adminRet } = await supabaseAdmin
          .from('order_returns')
          .select(`
            id,
            order_id,
            customer_id,
            order:orders(
              id,
              order_number,
              shipping_address_id,
              total_amount,
              shipping_address:addresses!shipping_address_id(*),
              profile:user_id(full_name, email, phone)
            )
          `)
          .eq('id', returnId)
          .maybeSingle();
        if (adminRet) ret = adminRet;
      }

      const order = ret?.order;
      const address = order?.shipping_address;
      const profile = order?.profile;

      if (address?.pincode) {
        customerPincode = address.pincode;
      }

      customerDetails = {
        full_name: address?.full_name || profile?.full_name || 'Customer',
        phone: address?.phone || profile?.phone || '',
        address_line1: address?.address_line1 || '',
        address_line2: address?.address_line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        pincode: address?.pincode || '',
        email: profile?.email || '',
      };
    }

    if (!customerPincode || !/^\d{6}$/.test(String(customerPincode).trim())) {
      return json({
        success: false,
        error: 'A valid 6-digit delivery pincode is required for checking pickup serviceability',
        couriers: [],
        customer: customerDetails,
      }, { status: 400 });
    }

    const sResult = await getShiprocketReturnServiceability(String(customerPincode).trim());

    return json({
      success: sResult.success,
      couriers: sResult.couriers || [],
      warehousePincode: sResult.warehousePincode || '131028',
      pickupPincode: customerPincode,
      customer: customerDetails,
      error: sResult.error,
    });
  } catch (err: any) {
    console.error('[Return Serviceability Exception]', err);
    return json({ success: false, error: err.message || 'Failed to check serviceability', couriers: [] }, { status: 500 });
  }
}

export async function GET({ url }) {
  const pincode = url.searchParams.get('pincode');
  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    return json({ success: false, error: 'Valid 6-digit pincode is required', couriers: [] }, { status: 400 });
  }

  const sResult = await getShiprocketReturnServiceability(pincode.trim());
  return json(sResult);
}

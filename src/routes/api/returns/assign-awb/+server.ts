export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin, assignShiprocketReturnAwb } from '$lib/server/shiprocket';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const { returnId, courierId, courierName, sessionToken } = body;

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

    const result = await assignShiprocketReturnAwb(returnId, {
      courierId,
      courierName,
      client: adminClient,
    });

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 400 });
    }

    return json({
      success: true,
      message: `Courier AWB generated successfully: ${result.awb} via ${result.courier_name}! Pickup requested.`,
      data: result,
    });
  } catch (err: any) {
    console.error('[API Assign AWB Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

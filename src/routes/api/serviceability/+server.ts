export const prerender = false;
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseUrl = env.PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined);
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.MYSUPABASE_SERVICE_ROLE_KEY || (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MYSUPABASE_SERVICE_ROLE_KEY) : undefined) || PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

let memoryToken: string | null = null;
let memoryTokenExpiry: Date | null = null;

async function getShiprocketToken() {
  // 1. Check in-memory cache first
  if (memoryToken && memoryTokenExpiry && memoryTokenExpiry > new Date()) {
    console.log("[Serviceability API] Reusing valid in-memory token");
    return memoryToken;
  }

  // 2. Check Supabase database cache (with fallback on failure/RLS)
  try {
    const { data: existingToken, error: readError } = await supabaseAdmin
      .from("api_tokens")
      .select("*")
      .eq("service_name", "shiprocket")
      .maybeSingle();

    if (readError) {
      console.warn("[Serviceability API] Non-critical: Error reading token from DB:", readError.message);
    } else if (existingToken && new Date(existingToken.expires_at) > new Date()) {
      console.log("[Serviceability API] Reusing valid cached database token");
      memoryToken = existingToken.token;
      memoryTokenExpiry = new Date(existingToken.expires_at);
      return existingToken.token;
    }
  } catch (dbReadErr: any) {
    console.warn("[Serviceability API] Non-critical: DB read exception:", dbReadErr.message || dbReadErr);
  }

  const email = env.SHIPROCKET_API_EMAIL || (typeof process !== 'undefined' ? process.env.SHIPROCKET_API_EMAIL : undefined);
  const password = env.SHIPROCKET_API_PASSWORD || (typeof process !== 'undefined' ? process.env.SHIPROCKET_API_PASSWORD : undefined);

  if (!email || !password) {
    console.error("[Serviceability API] Shiprocket credentials missing from environment variables");
    throw new Error("Shiprocket credentials missing");
  }

  console.log("[Serviceability API] Token absent/expired. Requesting new auth from Shiprocket...");
  const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Serviceability API] Auth connection failed:", errText);
    throw new Error("Shiprocket Auth Failed");
  }

  const data = await response.json();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 9);

  // 3. Save to in-memory cache
  memoryToken = data.token;
  memoryTokenExpiry = expiresAt;

  // 4. Try to save to Supabase database cache (do not crash on RLS error)
  try {
    const { error: saveError } = await supabaseAdmin.from("api_tokens").upsert({
      service_name: "shiprocket",
      token: data.token,
      expires_at: expiresAt.toISOString(),
    });

    if (saveError) {
      console.warn("[Serviceability API] Non-critical: Could not cache token to database (RLS/permissions):", saveError.message);
    } else {
      console.log("[Serviceability API] New token cached successfully in database.");
    }
  } catch (dbSaveErr: any) {
    console.warn("[Serviceability API] Non-critical: DB write exception:", dbSaveErr.message || dbSaveErr);
  }

  return data.token;
}

export async function GET({ url }) {
  const pincode = url.searchParams.get('pincode');
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return json({ error: 'Invalid pincode format' }, { status: 400 });
  }

  try {
    const token = await getShiprocketToken();
    const pickupPostcode = env.SHIPROCKET_PICKUP_POSTCODE || (typeof process !== 'undefined' ? process.env.SHIPROCKET_PICKUP_POSTCODE : undefined) || '131028';

    // Step 1: Check COD serviceability (cod=1)
    let codUrl = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${pincode}&weight=1.0&cod=1`;
    let response = await fetch(codUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    let result = await response.json();

    if (response.ok && result.status === 200 && result.data?.available_courier_companies?.length > 0) {
      const couriers = result.data.available_courier_companies;
      const etdDates = couriers
        .map((c: any) => c.etd)
        .filter(Boolean)
        .map((d: string) => new Date(d));

      let etdString = '';
      if (etdDates.length > 0) {
        const fastestDate = new Date(Math.min(...etdDates.map((d: Date) => d.getTime())));
        etdString = fastestDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      } else {
        const minDays = Math.min(...couriers.map((c: any) => parseInt(c.estimated_delivery_days || '7', 10)));
        const estDate = new Date();
        estDate.setDate(estDate.getDate() + minDays);
        etdString = estDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      }

      return json({
        serviceable: true,
        cod: true,
        etd: etdString
      });
    }

    // Step 2: Fallback to Prepaid serviceability (cod=0)
    let prepaidUrl = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${pincode}&weight=1.0&cod=0`;
    response = await fetch(prepaidUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    result = await response.json();

    if (response.ok && result.status === 200 && result.data?.available_courier_companies?.length > 0) {
      const couriers = result.data.available_courier_companies;
      const etdDates = couriers
        .map((c: any) => c.etd)
        .filter(Boolean)
        .map((d: string) => new Date(d));

      let etdString = '';
      if (etdDates.length > 0) {
        const fastestDate = new Date(Math.min(...etdDates.map((d: Date) => d.getTime())));
        etdString = fastestDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      } else {
        const minDays = Math.min(...couriers.map((c: any) => parseInt(c.estimated_delivery_days || '7', 10)));
        const estDate = new Date();
        estDate.setDate(estDate.getDate() + minDays);
        etdString = estDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      }

      return json({
        serviceable: true,
        cod: false,
        etd: etdString
      });
    }

    // Unserviceable
    return json({
      serviceable: false,
      cod: false
    });

  } catch (err: any) {
    console.error('[Serviceability API] Error:', err);
    return json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

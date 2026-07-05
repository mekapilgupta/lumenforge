import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const shiprocketEmail = Deno.env.get("SHIPROCKET_API_EMAIL")!;
const shiprocketPassword = Deno.env.get("SHIPROCKET_API_PASSWORD")!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper function to get or refresh the Bearer Token
async function getShiprocketToken() {
  console.log("[Shiprocket Push] Checking cache for token...");
  const { data: existingToken } = await supabaseAdmin
    .from("api_tokens")
    .select("*")
    .eq("service_name", "shiprocket")
    .maybeSingle();

  if (existingToken && new Date(existingToken.expires_at) > new Date()) {
    console.log("[Shiprocket Push] Cached token valid. Reusing.");
    return existingToken.token;
  }

  console.log("[Shiprocket Push] Token absent/expired. Requesting new auth...");
  const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: shiprocketEmail, password: shiprocketPassword }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Shiprocket Push] Auth connection failed:", errorText);
    throw new Error("Shiprocket Auth Failed");
  }

  const data = await response.json();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 9);

  await supabaseAdmin.from("api_tokens").upsert({
    service_name: "shiprocket",
    token: data.token,
    expires_at: expiresAt.toISOString(),
  });

  console.log("[Shiprocket Push] New token saved successfully.");
  return data.token;
}

serve(async (req) => {
  console.log("[Shiprocket Push] Target Edge Function awakened.");
  
  try {
    const body = await req.json();
    console.log("[Shiprocket Push] Received initial trigger payload:", JSON.stringify(body, null, 2));

    const orderId = body.id || body.orderId;
    if (!orderId) {
      console.error("[Shiprocket Push] Execution halted: No orderId was supplied.");
      return new Response(JSON.stringify({ error: "Missing order identification parameter" }), { status: 400 });
    }

    // Checking UUID state to safely choose standard query syntax versus string parsing
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orderId));
    console.log(`[Shiprocket Push] Identifier "${orderId}" evaluates to UUID format? ${isUuid}`);

    let dbQuery = supabaseAdmin
      .from("orders")
      .select(`
        *,
        address:addresses!shipping_address_id(*),
        items:order_items(*)
      `);

    if (isUuid) {
      dbQuery = dbQuery.or(`id.eq.${orderId},razorpay_order_id.eq.${orderId},order_number.eq.${orderId}`);
    } else {
      dbQuery = dbQuery.or(`razorpay_order_id.eq.${orderId},order_number.eq.${orderId}`);
    }

    const { data: fullOrder, error: dbQueryError } = await dbQuery.maybeSingle();

    if (dbQueryError) {
      console.error("[Shiprocket Push] Database fetch error:", JSON.stringify(dbQueryError));
      return new Response(JSON.stringify({ error: dbQueryError.message }), { status: 500 });
    }

    if (!fullOrder) {
      console.error(`[Shiprocket Push] No order matched column targets for ID: ${orderId}`);
      return new Response(JSON.stringify({ error: "Order context missing from DB" }), { status: 404 });
    }

    console.log("[Shiprocket Push] Full database row retrieved successfully:", JSON.stringify(fullOrder, null, 2));

    // Safely mapping parameters and matching correct underscored table field columns
    const customerName = fullOrder.address?.full_name || "Valued Customer";
    const add1 = fullOrder.address?.address_line_1 || "No Address Provided"; // Fixed spelling
    const add2 = fullOrder.address?.address_line_2 || "";                  // Fixed spelling
    const city = fullOrder.address?.city || "City Missing";
    const pincode = fullOrder.address?.pincode || "000000";
    const state = fullOrder.address?.state || "State Missing";
    const email = fullOrder.payment_gateway_response?.email || "customer@frenchtoes.in";
    const phone = fullOrder.address?.phone || fullOrder.payment_gateway_response?.contact || "9999999999";
    const isCod = fullOrder.payment_method === "cod";

    console.log(`[Shiprocket Push] Field Verification: Name: ${customerName}, Pincode: ${pincode}, Phone: ${phone}`);

    const token = await getShiprocketToken();

    // Constructing clean payload conversion (paise back to INR)
    const shiprocketPayload = {
      "order_id": fullOrder.id,
      "order_date": new Date().toISOString().split("T")[0],
      "pickup_location": "Primary",
      "channel_id": "11173693",
      "billing_customer_name": customerName,
      "billing_last_name": "",
      "billing_address": add1,
      "billing_address_2": add2,
      "billing_city": city,
      "billing_pincode": pincode,
      "billing_state": state,
      "billing_country": "India",
      "billing_email": email,
      "billing_phone": phone,
      "shipping_is_billing": true,
      "order_items": (fullOrder.items || []).map((item: any) => ({
        "name": item.product_name || "Slipper Item",
        "sku": item.product_sku || "FT-DEFAULT-SKU",
        "units": item.quantity || 1,
        "selling_price": (item.unit_price || 0) / 100,
        "discount": (item.discount_amount || 0) / 100,
      })),
      "payment_method": isCod ? "COD" : "Prepaid",
      "sub_total": (fullOrder.total_amount || 0) / 100,
      "length": 30,
      "breadth": 20,
      "height": 10,
      "weight": 1.0,
    };

    console.log("[Shiprocket Push] Pushing constructed payload directly to Shiprocket:", JSON.stringify(shiprocketPayload, null, 2));

    const srResponse = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(shiprocketPayload),
    });

    const srResult = await srResponse.json();
    console.log(`[Shiprocket Push] Shiprocket response status code: ${srResponse.status}`, JSON.stringify(srResult, null, 2));

    if (!srResponse.ok) {
      console.error("[Shiprocket Push] Shiprocket API rejected order placement:", srResult);
      return new Response(JSON.stringify({ error: srResult.message || "Shiprocket rejected input payload" }), { status: 400 });
    }

    console.log(`[Shiprocket Push] Success! Received SR Order ID: ${srResult.order_id}. Writing back to orders table...`);

    // Persisting confirmation records back to database row
    const { error: finalDbUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        shiprocket_order_id: String(srResult.order_id),
        shiprocket_shipment_id: String(srResult.shipment_id),
        status: "confirmed"
      })
      .eq("id", fullOrder.id);

    if (finalDbUpdateError) {
      console.error("[Shiprocket Push] Critical failure saving tracking context back to table row:", finalDbUpdateError);
    } else {
      console.log("[Shiprocket Push] Complete workflow finalized. Table tracking records synced successfully.");
    }

    return new Response(JSON.stringify({ success: true, shiprocket_order_id: srResult.order_id }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Shiprocket Push] Uncaught Exception crash inside handler:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

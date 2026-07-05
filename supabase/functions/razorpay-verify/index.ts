// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// // ─── Environment Variables ────────────────────────────────────────────────────

// const supabaseUrl = Deno.env.get("MYSUPABASE_URL")!;
// const supabaseServiceKey = Deno.env.get("MYSUPABASE_SERVICE_ROLE_KEY")!;
// const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
// const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

// // ─── Supabase Admin Client ────────────────────────────────────────────────────

// const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
//   auth: { autoRefreshToken: false, persistSession: false },
// });

// // ─── CORS Headers ─────────────────────────────────────────────────────────────

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
// };

// // ─── Response Helpers ─────────────────────────────────────────────────────────

// function jsonResponse(body: unknown, status = 200): Response {
//   return new Response(JSON.stringify(body), {
//     status,
//     headers: { ...corsHeaders, "Content-Type": "application/json" },
//   });
// }

// // ─── Razorpay API Helper ──────────────────────────────────────────────────────

// async function razorpayApi(
//   path: string,
//   method: string,
//   body?: Record<string, unknown>
// ): Promise<Record<string, unknown>> {
//   if (!razorpayKeyId || !razorpayKeySecret) {
//     throw new Error("Razorpay credentials not configured");
//   }

//   const authHeader = "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
//   const url = `https://api.razorpay.com/v1${path}`;

//   const res = await fetch(url, {
//     method,
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: authHeader,
//     },
//     body: body ? JSON.stringify(body) : undefined,
//   });

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(
//       `Razorpay API error: ${data.error?.description ?? JSON.stringify(data)}`
//     );
//   }

//   return data;
// }

// // ─── HMAC Signature Verification ──────────────────────────────────────────────

// async function verifySignature(
//   orderId: string,
//   paymentId: string,
//   signature: string
// ): Promise<boolean> {
//   const body = `${orderId}|${paymentId}`;
//   const encoder = new TextEncoder();
//   const keyData = encoder.encode(razorpayKeySecret);
//   const msgData = encoder.encode(body);

//   const cryptoKey = await crypto.subtle.importKey(
//     "raw",
//     keyData,
//     { name: "HMAC", hash: "SHA-256" },
//     false,
//     ["sign"]
//   );

//   const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
//   const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");

//   return expectedSignature === signature;
// }

// // ─── Main Handler ─────────────────────────────────────────────────────────────

// serve(async (req) => {
//   // 1. Preflight
//   if (req.method === "OPTIONS") {
//     return new Response("ok", { headers: corsHeaders, status: 200 });
//   }

//   console.log(`\n─── [START] ${req.method} ───`);

//   try {
//     // 2. Validate env vars
//     if (!razorpayKeyId || !razorpayKeySecret) {
//       console.error("[FAIL] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set.");
//       return jsonResponse(
//         { success: false, error: "Server misconfiguration: Razorpay credentials missing" },
//         500
//       );
//     }

//     // 3. Parse body
//     console.log("[1/5] Parsing request body...");
//     const body = await req.json();
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

//     console.log(`[1/5] order_id: ${razorpay_order_id}, payment_id: ${razorpay_payment_id}`);

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return jsonResponse(
//         { success: false, error: "Missing required payment verification fields" },
//         400
//       );
//     }

//     // 4. Verify HMAC signature
//     console.log("[2/5] Verifying HMAC signature...");
//     const isValid = await verifySignature(
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature
//     );

//     if (!isValid) {
//       console.error("[FAIL] Signature verification failed!");
//       return jsonResponse(
//         { success: false, error: "Invalid payment signature" },
//         400
//       );
//     }

//     console.log("[2/5] Signature verified ✓");

//     // 5. Fetch payment details from Razorpay
//     console.log("[3/5] Fetching payment details from Razorpay...");
//     const paymentDetails = await razorpayApi(
//       `/payments/${razorpay_payment_id}`,
//       "GET"
//     ) as Record<string, unknown>;

//     console.log(`[3/5] Payment method: ${paymentDetails.method}, status: ${paymentDetails.status}`);

//     // 6. Update the order row in Supabase
//     console.log("[4/5] Updating order in Supabase...");
//     const { error: updateError } = await supabaseAdmin
//       .from("orders")
//       .update({
//         payment_status: "paid",
//         razorpay_payment_id,
//         razorpay_signature,
//         payment_method: "razorpay", // Hardcoded to match ENUM; full details stored in payment_gateway_response
//         payment_gateway_response: paymentDetails,
//         payment_completed_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//       })
//       .eq("razorpay_order_id", razorpay_order_id);

//     if (updateError) {
//       console.error("[ERROR] Supabase update failed:", updateError);
//       throw updateError;
//     }

//     console.log("[4/5] Order updated to 'paid' ✓");

//     // 7. Return success
//     console.log("[SUCCESS] Payment verified and stored.");
//     console.log("─── [END] ───\n");

//     return jsonResponse({
//       success: true,
//       message: "Payment verified and stored",
//       payment_method: paymentDetails.method,
//     });
//   } catch (error) {
//     console.error("[CRITICAL]", error);
//     console.log("─── [END — 500] ───\n");

//     return jsonResponse(
//       { success: false, error: (error as Error).message ?? "Internal Server Error" },
//       500
//     );
//   }
// });





import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment Variables ────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get("MYSUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("MYSUPABASE_SERVICE_ROLE_KEY")!;
const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

// ─── Supabase Admin Client ────────────────────────────────────────────────────

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── CORS Headers ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// ─── Response Helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Razorpay API Helper ──────────────────────────────────────────────────────

async function razorpayApi(
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay credentials not configured");
  }

  const authHeader = "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
  const url = `https://api.razorpay.com/v1${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Razorpay API error: ${data.error?.description ?? JSON.stringify(data)}`
    );
  }

  return data;
}

// ─── HMAC Signature Verification ──────────────────────────────────────────────

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const body = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(razorpayKeySecret);
  const msgData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === signature;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // 1. Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  console.log(`\n─── [START] ${req.method} ───`);

  try {
    // 2. Validate env vars
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("[FAIL] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set.");
      return jsonResponse(
        { success: false, error: "Server misconfiguration: Razorpay credentials missing" },
        500
      );
    }

    // 3. Parse body
    console.log("[1/5] Parsing request body...");
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    console.log(`[1/5] order_id: ${razorpay_order_id}, payment_id: ${razorpay_payment_id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return jsonResponse(
        { success: false, error: "Missing required payment verification fields" },
        400
      );
    }

    // 4. Verify HMAC signature
    console.log("[2/5] Verifying HMAC signature...");
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error("[FAIL] Signature verification failed!");
      return jsonResponse(
        { success: false, error: "Invalid payment signature" },
        400
      );
    }

    console.log("[2/5] Signature verified ✓");

    // 5. Fetch payment details from Razorpay
    console.log("[3/5] Fetching payment details from Razorpay...");
    const paymentDetails = await razorpayApi(
      `/payments/${razorpay_payment_id}`,
      "GET"
    ) as Record<string, unknown>;

    console.log(`[3/5] Payment method: ${paymentDetails.method}, status: ${paymentDetails.status}`);

    // 6. Update the order row in Supabase
    console.log("[4/5] Updating order in Supabase...");
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        razorpay_payment_id,
        razorpay_signature,
        payment_method: "razorpay", // Hardcoded to match ENUM; full details stored in payment_gateway_response
        payment_gateway_response: paymentDetails,
        payment_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpay_order_id);

    if (updateError) {
      console.error("[ERROR] Supabase update failed:", updateError);
      throw updateError;
    }

    console.log("[4/5] Order updated to 'paid' ✓");

    // 7. Return success
    console.log("[SUCCESS] Payment verified and stored.");
    console.log("─── [END] ───\n");

    return jsonResponse({
      success: true,
      message: "Payment verified and stored",
      payment_method: paymentDetails.method,
    });
  } catch (error) {
    console.error("[CRITICAL]", error);
    console.log("─── [END — 500] ───\n");

    return jsonResponse(
      { success: false, error: (error as Error).message ?? "Internal Server Error" },
      500
    );
  }
});
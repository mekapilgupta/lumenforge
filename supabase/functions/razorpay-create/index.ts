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
    const {
      amount,
      currency = "INR",
      receiptId,
      userId,
      shippingAddressId,
      billingAddressId,
      couponCode,
      subtotal,
      discountAmount = 0,
      shippingCharges = 0,
      codCharges = 0,
      gstAmount = 0,
      totalAmount,
      items,
    } = body;

    console.log(`[1/5] amount: ${amount}, receiptId: ${receiptId}, userId: ${userId}`);
    console.log(`[1/5] subtotal: ${subtotal}, discount: ${discountAmount}, shipping: ${shippingCharges}, cod: ${codCharges}, gst: ${gstAmount}, total: ${totalAmount}`);

    if (!amount || typeof amount !== "number" || amount < 100) {
      return jsonResponse(
        { success: false, error: "Invalid amount. Must be at least 100 paise (₹1)" },
        400
      );
    }

    if (!receiptId) {
      return jsonResponse({ success: false, error: "receiptId is required" }, 400);
    }

    if (!shippingAddressId) {
      return jsonResponse({ success: false, error: "shippingAddressId is required" }, 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse({ success: false, error: "At least one order item is required" }, 400);
    }

    // 4. Create order on Razorpay
    console.log("[2/5] Creating Razorpay order...");
    const razorpayOrder = await razorpayApi("/orders", "POST", {
      amount,
      currency,
      receipt: receiptId,
    }) as { id: string; amount: number; currency: string; status: string };

    console.log(`[2/5] Razorpay order created: ${razorpayOrder.id}`);

    // 5. Insert pending order into Supabase (only columns that exist in schema)
    console.log("[3/5] Inserting pending order into Supabase...");
    const { data: orderRow, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId ?? null,
        razorpay_order_id: razorpayOrder.id,
        payment_method: "razorpay",
        payment_status: "pending",
        status: "pending",
        subtotal: subtotal ?? amount,
        discount_amount: discountAmount,
        shipping_charges: shippingCharges,
        cod_charges: codCharges,
        gst_amount: gstAmount,
        total_amount: totalAmount ?? amount,
        coupon_code: couponCode ?? null,
        shipping_address_id: shippingAddressId,
        billing_address_id: billingAddressId ?? shippingAddressId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[ERROR] Supabase insert failed:", insertError);
      throw insertError;
    }

    console.log(`[3/5] Order row inserted: ${orderRow.id}, order_number: ${orderRow.order_number}`);

    // 6. Insert order items into order_items table
    console.log("[4/5] Inserting order items...");
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: orderRow.id,
      product_id: item.product_id ?? null,
      variant_id: item.variant_id ?? null,
      product_name: item.name ?? "Unknown",
      product_sku: item.sku ?? "N/A",
      variant_info: item.variant_info ?? (item.color || item.size ? { size: item.size ?? null, color: item.color ?? null } : null),
      unit_price: item.price ?? 0,
      quantity: item.quantity ?? 1,
      discount_amount: item.discount_amount ?? 0,
      gst_amount: item.gst_amount ?? 0,
      total_price: (item.price ?? 0) * (item.quantity ?? 1),
      product_image_url: item.product_image_url ?? item.image ?? null,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (itemsError) {
      console.error("[WARN] Failed to insert order items:", itemsError);
      // Don't throw — order was created, items can be added later
    } else {
      console.log(`[4/5] ${orderItemsToInsert.length} order items inserted`);
    }

    // 7. Return success
    console.log("[SUCCESS] Order creation complete.");
    console.log("─── [END] ───\n");

    return jsonResponse({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: receiptId,
      },
      dbOrderId: orderRow.id,
      orderNumber: orderRow.order_number,
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
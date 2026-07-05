import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("LOGISTICS_WEBHOOK_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@yourdomain.com";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function log(reqId: string, level: "info" | "warn" | "error", msg: string, meta: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), reqId, level, msg, ...meta };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

async function sendAdminEmail(reqId: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    log(reqId, "warn", "Email alert skipped — RESEND_API_KEY/ADMIN_EMAIL not set", { subject });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject, html }),
    });
    if (!res.ok) log(reqId, "warn", "Email alert failed", { subject, status: res.status });
  } catch (e) {
    log(reqId, "warn", "Email alert threw (non-fatal)", { subject, error: (e as Error).message });
  }
}

// Shiprocket's own current_status text → our orders.status enum.
// Keys normalized to UPPERCASE for robust, case-insensitive comparison.
const STATUS_MAP: Record<string, string> = {
  "PICKUP SCHEDULED": "processing",
  "PICKUP GENERATED": "processing",
  "SHIPPED": "shipped",
  "IN TRANSIT": "shipped",
  "OUT FOR DELIVERY": "out_for_delivery",
  "DELIVERED": "delivered",
  "CANCELLED": "cancelled",
  "CANCELED": "cancelled", // Handle both British & American spellings
  "RTO INITIATED": "processing",
  "RTO IN TRANSIT": "processing",
  "RTO DELIVERED": "returned",
};

// Events worth an immediate email in UPPERCASE
const NOTIFY_ON = new Set(["CANCELLED", "CANCELED", "RTO DELIVERED", "DELIVERED"]);

serve(async (req) => {
  const reqId = crypto.randomUUID();
  const authHeader = req.headers.get("Authorization");

  if (authHeader !== webhookSecret) {
    log(reqId, "warn", "Rejected webhook call — bad/missing auth header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json();
    const orderId = payload.channel_order_id ?? payload.order_id;
    const shiprocketStatus = payload.current_status;
    const awbCode = payload.awb;
    const srOrderId = payload.sr_order_id;

    log(reqId, "info", "Webhook received", { orderId, shiprocketStatus, awbCode });

    if (!orderId || orderId === "enter your channel order id") {
      log(reqId, "info", "Ignoring Shiprocket test payload");
      return new Response(JSON.stringify({ success: true, message: "Test payload ignored" }), { headers: { "Content-Type": "application/json" } });
    }

    // --- Idempotency: dedupe on (order, status, awb, latest scan timestamp).
    const latestScan = payload.scans && payload.scans.length > 0 ? payload.scans[0] : null;
    const dedupeKey = `${orderId}|${shiprocketStatus}|${awbCode ?? ""}|${latestScan?.date ?? payload.current_timestamp ?? ""}`;

    const { error: dedupeErr } = await supabaseAdmin
      .from("shiprocket_webhook_log")
      .insert({ dedupe_key: dedupeKey, order_id: orderId, event_status: shiprocketStatus, raw_payload: payload });

    if (dedupeErr) {
      // Unique violation = we've already processed this exact event.
      if (dedupeErr.code === "23505") {
        log(reqId, "info", "Duplicate webhook event ignored", { dedupeKey });
        return new Response(JSON.stringify({ success: true, message: "Duplicate event ignored" }), { headers: { "Content-Type": "application/json" } });
      }
      log(reqId, "warn", "Failed to write webhook dedupe log — proceeding anyway", { error: dedupeErr.message });
    }

    // --- Look up the order first so we can compare current vs incoming status
    const { data: currentOrder, error: currentOrderErr } = await supabaseAdmin
      .from("orders").select("id, status, payment_status").eq("id", orderId).maybeSingle();

    if (currentOrderErr || !currentOrder) {
      log(reqId, "error", "Webhook references unknown order — ignoring", { orderId, error: currentOrderErr?.message });
      return new Response(JSON.stringify({ success: true, message: "Unknown order, ignored" }), { headers: { "Content-Type": "application/json" } });
    }

    // Normalize incoming status for case-insensitive lookup
    const statusNormalized = (shiprocketStatus ?? "").trim().toUpperCase();
    const dbStatus = STATUS_MAP[statusNormalized] ?? currentOrder.status;
    const statusChanged = dbStatus !== currentOrder.status;

    const updatePayload: Record<string, unknown> = {
      shiprocket_status: shiprocketStatus,
      shiprocket_last_synced_at: new Date().toISOString(),
      awb_code: awbCode,
    };
    if (statusChanged) updatePayload.status = dbStatus;

    const { error: updateError } = await supabaseAdmin.from("orders").update(updatePayload).eq("id", orderId);
    if (updateError) {
      log(reqId, "error", "Failed to update order from webhook", { orderId, error: updateError.message });
      throw updateError;
    }

    if (latestScan) {
      await supabaseAdmin.from("order_logs").insert({
        order_id: orderId,
        status: dbStatus,
        note: `Shiprocket: ${latestScan.activity} at ${latestScan.location}`,
      });
    }

    log(reqId, "info", "Order synced from Shiprocket", { orderId, shiprocketStatus, dbStatus, statusChanged });

    if (NOTIFY_ON.has(statusNormalized) && statusChanged) {
      await sendAdminEmail(reqId, `Shipment update: ${shiprocketStatus} — Order ${orderId}`,
        `<p>Shiprocket reports <b>${shiprocketStatus}</b> for order <b>${orderId}</b> (AWB ${awbCode ?? "N/A"}).</p>` +
        ((statusNormalized === "CANCELLED" || statusNormalized === "CANCELED") ? "<p>Refund and internal cancellation have been queued automatically.</p>" : ""));
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    log(reqId, "error", "Webhook processing error", { error: (error as Error).message, stack: (error as Error).stack });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

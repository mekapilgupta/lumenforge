import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ============================================================================
 * Run supabase/snippets/02_returns_and_reverse_logistics.sql before deploying
 * this version — it adds max_attempts/next_retry_at/last_error_at, the
 * 'failed_permanent' status, the 'create_reverse_pickup' /
 * 'create_exchange_shipment' actions, and the order_returns table this file
 * reads from.
 *
 * New env vars needed (Project Settings → Edge Functions → Secrets):
 *   RESEND_API_KEY      — for admin email alerts (swap sendEmail() below if
 *                          you use a different provider)
 *   ADMIN_EMAIL         — where alerts go
 *   STORE_PICKUP_*      — your warehouse/return-to address, used when
 *                          creating Shiprocket return orders (see §Config)
 * ========================================================================== */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RETRY_DELAY_MS = 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;
const BATCH_LIMIT = 10;
const CANDIDATE_LIMIT = 50;

function requireEnv(...names: string[][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [primary, fallback] of names) {
    const val = Deno.env.get(primary) ?? (fallback ? Deno.env.get(fallback) : undefined);
    if (!val) throw new Error(`Missing required environment variable: ${primary}${fallback ? ` (or ${fallback})` : ""}`);
    out[primary] = val;
  }
  return out;
}

let env: Record<string, string>;
try {
  env = requireEnv(
    ["MYSUPABASE_URL", "SUPABASE_URL"],
    ["MYSUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    ["RAZORPAY_KEY_ID"],
    ["RAZORPAY_KEY_SECRET"],
    ["SHIPROCKET_API_EMAIL"],
    ["SHIPROCKET_API_PASSWORD"],
  );
} catch (e) {
  console.error("[Startup] FATAL: " + (e as Error).message);
  env = {} as Record<string, string>;
}

// Optional — email alerts degrade gracefully if these are missing rather than
// crashing the whole worker (a missed email is better than a failed refund).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@yourdomain.com";

// Your warehouse / return-to address — used as the "shipping" (destination)
// side of every Shiprocket return order. Fill these in as env vars.
const STORE_PICKUP = {
  name: Deno.env.get("STORE_PICKUP_NAME") ?? "",
  address: Deno.env.get("STORE_PICKUP_ADDRESS") ?? "",
  city: Deno.env.get("STORE_PICKUP_CITY") ?? "",
  state: Deno.env.get("STORE_PICKUP_STATE") ?? "",
  pincode: Deno.env.get("STORE_PICKUP_PINCODE") ?? "",
  country: Deno.env.get("STORE_PICKUP_COUNTRY") ?? "India",
  email: Deno.env.get("STORE_PICKUP_EMAIL") ?? "",
  phone: Deno.env.get("STORE_PICKUP_PHONE") ?? "",
};

const supabaseAdmin = createClient(
  env.MYSUPABASE_URL ?? Deno.env.get("SUPABASE_URL")!,
  env.MYSUPABASE_SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const razorpayAuth = "Basic " + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
const shiprocketEmail = env.SHIPROCKET_API_EMAIL;
const shiprocketPassword = env.SHIPROCKET_API_PASSWORD;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function log(runId: string, level: "info" | "warn" | "error", msg: string, meta: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), runId, level, msg, ...meta };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

// ---------------------------------------------------------------------------
// Email alerts (Resend). Swap the body of this function if you use a
// different provider — every call site elsewhere stays the same.
// ---------------------------------------------------------------------------
async function sendAdminEmail(runId: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    log(runId, "warn", "Email alert skipped — RESEND_API_KEY or ADMIN_EMAIL not configured", { subject });
    return;
  }
  try {
    const res = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject, html }),
    }, 10_000);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log(runId, "warn", "Email alert failed to send", { subject, status: res.status, body });
    } else {
      log(runId, "info", "Email alert sent", { subject });
    }
  } catch (e) {
    log(runId, "warn", "Email alert threw an error (non-fatal)", { subject, error: (e as Error).message });
  }
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class TaskError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

// ---------------------------------------------------------------------------
// Shiprocket token (unchanged from previous version)
// ---------------------------------------------------------------------------
let shiprocketTokenCache: string | null = null;

async function getShiprocketToken(runId: string): Promise<string> {
  if (shiprocketTokenCache) return shiprocketTokenCache;

  const { data: existingToken, error } = await supabaseAdmin
    .from("api_tokens").select("*").eq("service_name", "shiprocket").maybeSingle();
  if (error) log(runId, "warn", "Failed to read cached Shiprocket token", { error: error.message });

  if (existingToken && new Date(existingToken.expires_at) > new Date()) {
    shiprocketTokenCache = existingToken.token;
    return existingToken.token;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shiprocketEmail, password: shiprocketPassword }),
    });
  } catch (e) {
    throw new TaskError(`Shiprocket auth request failed/timed out: ${(e as Error).message}`, true);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "<unreadable body>");
    throw new TaskError(`Shiprocket auth failed (${response.status}): ${errorText}`, response.status >= 500);
  }

  const data = await response.json();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 9);
  await supabaseAdmin.from("api_tokens").upsert({
    service_name: "shiprocket", token: data.token, expires_at: expiresAt.toISOString(),
  });

  log(runId, "info", "New Shiprocket token acquired");
  shiprocketTokenCache = data.token;
  return data.token;
}

async function writeOrderLog(runId: string, orderId: string, status: string, note: string) {
  const { error } = await supabaseAdmin.from("order_logs").insert({ order_id: orderId, status, note });
  if (error) log(runId, "warn", "Failed to write order_logs entry", { orderId, error: error.message });
}

// ---------------------------------------------------------------------------
// Handler: process_refund
// ---------------------------------------------------------------------------
async function handleProcessRefund(runId: string, task: any) {
  const { razorpay_payment_id, amount, order_return_id } = task.payload ?? {};

  if (!razorpay_payment_id) throw new TaskError("Missing razorpay_payment_id in payload", false);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new TaskError(`Invalid refund amount in payload: ${JSON.stringify(amount)}`, false);
  }

  const { data: order, error: orderFetchErr } = await supabaseAdmin
    .from("orders").select("id, payment_status, payment_gateway_response").eq("id", task.order_id).maybeSingle();
  if (orderFetchErr) {
    log(runId, "warn", "Could not verify order before refund, proceeding cautiously", { orderId: task.order_id, error: orderFetchErr.message });
  }
  if (order?.payment_status === "refunded") {
    log(runId, "info", "Order already refunded — skipping duplicate call", { orderId: task.order_id });
    if (order_return_id) await supabaseAdmin.from("order_returns").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", order_return_id);
    return;
  }

  log(runId, "info", "Calling Razorpay refund API", { orderId: task.order_id, razorpay_payment_id, amount, order_return_id });

  let refundRes: Response;
  try {
    refundRes = await fetchWithTimeout(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: razorpayAuth },
      body: JSON.stringify({ amount }),
    });
  } catch (e) {
    throw new TaskError(`Razorpay refund request failed/timed out: ${(e as Error).message}`, true);
  }

  const refundData = await refundRes.json().catch(() => ({}));

  if (!refundRes.ok) {
    const description: string = refundData?.error?.description ?? JSON.stringify(refundData);
    const alreadyRefunded = /already.*refund/i.test(description);
    if (alreadyRefunded) {
      await finalizeRefund(runId, task.order_id, order_return_id, amount, refundData, order?.payment_gateway_response);
      return;
    }
    throw new TaskError(`Razorpay refund failed (${refundRes.status}): ${description}`, refundRes.status >= 500);
  }

  await finalizeRefund(runId, task.order_id, order_return_id, amount, refundData, order?.payment_gateway_response);
}

async function finalizeRefund(runId: string, orderId: string, orderReturnId: string | undefined, amount: number, refundData: any, existingGatewayResponse: any) {
  const mergedGatewayResponse = { ...(existingGatewayResponse ?? {}), refund: refundData };

  const { error: orderUpdateErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "refunded",
      refund_amount: amount,
      refund_completed_at: new Date().toISOString(),
      payment_gateway_response: mergedGatewayResponse,
    })
    .eq("id", orderId);

  if (orderUpdateErr) {
    log(runId, "error", "CRITICAL: Razorpay refund succeeded but order update failed — needs manual reconciliation", {
      orderId, refundId: refundData.id, error: orderUpdateErr.message,
    });
    await sendAdminEmail(runId, `URGENT: Refund succeeded but DB update failed — Order ${orderId}`,
      `<p>Razorpay refund <b>${refundData.id ?? "N/A"}</b> for order <b>${orderId}</b> succeeded, but saving it to the database failed: ${orderUpdateErr.message}. Please reconcile manually in Razorpay + Supabase.</p>`);
  }

  if (orderReturnId) {
    await supabaseAdmin.from("order_returns").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", orderReturnId);
  }

  await writeOrderLog(runId, orderId, "refunded",
    `System: Refund of ₹${(amount / 100).toFixed(2)} processed via Razorpay. Refund ID: ${refundData.id ?? "N/A"}`);

  await sendAdminEmail(runId, `Refund completed — Order ${orderId}`,
    `<p>Refund of <b>₹${(amount / 100).toFixed(2)}</b> completed for order <b>${orderId}</b>.</p><p>Razorpay Refund ID: ${refundData.id ?? "N/A"}</p>`);

  log(runId, "info", "Refund finalized", { orderId, refundId: refundData.id, amount });
}

// ---------------------------------------------------------------------------
// Handler: cancel_shipment (unchanged behavior, tightened idempotency)
// ---------------------------------------------------------------------------
async function handleCancelShipment(runId: string, task: any) {
  const { shiprocket_order_id } = task.payload ?? {};
  if (!shiprocket_order_id) throw new TaskError("Missing shiprocket_order_id in payload", false);

  const srToken = await getShiprocketToken(runId);
  let cancelRes: Response;
  try {
    cancelRes = await fetchWithTimeout("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${srToken}` },
      body: JSON.stringify({ ids: [shiprocket_order_id] }),
    });
  } catch (e) {
    throw new TaskError(`Shiprocket cancel request failed/timed out: ${(e as Error).message}`, true);
  }
  if (cancelRes.status === 401 || cancelRes.status === 403) shiprocketTokenCache = null;

  const cancelData = await cancelRes.json().catch(() => ({}));
  if (!cancelRes.ok) {
    const message: string = cancelData?.message ?? JSON.stringify(cancelData);
    if (/already.*cancel/i.test(message)) {
      await writeOrderLog(runId, task.order_id, "cancelled", "System: Shipment was already cancelled in Shiprocket.");
      return;
    }
    throw new TaskError(`Shiprocket cancellation failed (${cancelRes.status}): ${message}`, cancelRes.status >= 500);
  }

  await writeOrderLog(runId, task.order_id, "cancelled", `System: Shipment cancelled in Shiprocket. Response: ${cancelData.message ?? "Success"}`);
}

// ---------------------------------------------------------------------------
// Handler: create_reverse_pickup (return shipment)
// ---------------------------------------------------------------------------
async function handleCreateReversePickup(runId: string, task: any) {
  const { order_return_id } = task.payload ?? {};
  if (!order_return_id) throw new TaskError("Missing order_return_id in payload", false);

  const { data: ret, error: retErr } = await supabaseAdmin
    .from("order_returns").select("*").eq("id", order_return_id).maybeSingle();
  if (retErr || !ret) throw new TaskError(`Could not load order_returns row ${order_return_id}: ${retErr?.message ?? "not found"}`, false);

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders").select("*").eq("id", ret.order_id).maybeSingle();
  if (orderErr || !order) throw new TaskError(`Could not load order ${ret.order_id}: ${orderErr?.message ?? "not found"}`, false);

  if (!order.shipping_address_id) throw new TaskError("Order has no shipping_address_id — cannot schedule pickup", false);
  const { data: address, error: addrErr } = await supabaseAdmin
    .from("addresses").select("*").eq("id", order.shipping_address_id).maybeSingle();
  if (addrErr || !address) throw new TaskError(`Could not load shipping address: ${addrErr?.message ?? "not found"}`, false);

  const items = Array.isArray(ret.items) ? ret.items : [];
  if (items.length === 0) throw new TaskError("Return has no items recorded", false);

  const srToken = await getShiprocketToken(runId);

  const body = {
    order_id: `RET-${ret.id}`,
    order_date: new Date().toISOString().slice(0, 10),
    channel_id: "",
    pickup_customer_name: address.full_name ?? order.customer_name ?? "Customer",
    pickup_address: address.address_line1,
    pickup_address_2: address.address_line2 ?? "",
    pickup_city: address.city,
    pickup_state: address.state,
    pickup_country: STORE_PICKUP.country,
    pickup_pincode: address.pincode,
    pickup_email: order.customer_email ?? STORE_PICKUP.email,
    pickup_phone: address.phone ?? order.customer_phone,
    shipping_customer_name: STORE_PICKUP.name,
    shipping_address: STORE_PICKUP.address,
    shipping_city: STORE_PICKUP.city,
    shipping_state: STORE_PICKUP.state,
    shipping_country: STORE_PICKUP.country,
    shipping_pincode: STORE_PICKUP.pincode,
    shipping_email: STORE_PICKUP.email,
    shipping_phone: STORE_PICKUP.phone,
    order_items: items.map((it: any) => ({
      sku: it.sku ?? it.order_item_id,
      name: it.product_name ?? "Item",
      units: it.quantity ?? 1,
      selling_price: it.unit_price ?? 0,
      qc_enable: false,
    })),
    payment_method: "Prepaid",
    sub_total: items.reduce((s: number, it: any) => s + (it.unit_price ?? 0) * (it.quantity ?? 1), 0),
    length: 15, breadth: 10, height: 5, weight: 0.5,
  };

  let res: Response;
  try {
    res = await fetchWithTimeout("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${srToken}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new TaskError(`Shiprocket return-order request failed/timed out: ${(e as Error).message}`, true);
  }
  if (res.status === 401 || res.status === 403) shiprocketTokenCache = null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TaskError(`Shiprocket return-order creation failed (${res.status}): ${data?.message ?? JSON.stringify(data)}`, res.status >= 500);
  }

  await supabaseAdmin.from("order_returns").update({
    status: "pickup_scheduled",
    shiprocket_return_order_id: String(data.order_id ?? ""),
    shiprocket_return_shipment_id: String(data.shipment_id ?? ""),
    updated_at: new Date().toISOString(),
  }).eq("id", order_return_id);

  await writeOrderLog(runId, ret.order_id, "return_pickup_scheduled",
    `System: Reverse pickup scheduled via Shiprocket. Return Order ID: ${data.order_id ?? "N/A"}`);

  await sendAdminEmail(runId, `Return pickup scheduled — Order ${ret.order_id}`,
    `<p>A reverse pickup has been scheduled with Shiprocket for return <b>${order_return_id}</b> (order <b>${ret.order_id}</b>).</p>`);

  log(runId, "info", "Reverse pickup created", { returnId: order_return_id, orderId: ret.order_id, shiprocketOrderId: data.order_id });
}

// ---------------------------------------------------------------------------
// Handler: create_exchange_shipment
// ---------------------------------------------------------------------------
async function handleCreateExchangeShipment(runId: string, task: any) {
  const { replacement_order_id } = task.payload ?? {};
  if (!replacement_order_id) throw new TaskError("Missing replacement_order_id in payload", false);

  log(runId, "info", "Creating exchange replacement shipment in Shiprocket", { replacement_order_id });

  const supabaseUrl = env.MYSUPABASE_URL ?? Deno.env.get("SUPABASE_URL")!;
  const serviceKey = env.MYSUPABASE_SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/push-to-shiprocket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ orderId: replacement_order_id }),
    });
  } catch (e) {
    throw new TaskError(`Exchange shipment push request failed/timed out: ${(e as Error).message}`, true);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TaskError(`Exchange shipment creation failed (${res.status}): ${data?.error ?? JSON.stringify(data)}`, res.status >= 500);
  }

  log(runId, "info", "Exchange shipment created successfully", { replacement_order_id, shiprocketOrderId: data.shiprocket_order_id });

  await writeOrderLog(runId, replacement_order_id, "exchange_shipment_created",
    `System: Exchange replacement shipment created in Shiprocket. Order ID: ${data.shiprocket_order_id ?? "N/A"}`);
}

// ---------------------------------------------------------------------------
// Claim / complete / fail (unchanged from previous version)
// ---------------------------------------------------------------------------
async function claimTask(runId: string, task: any): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from("automation_queue")
    .update({ status: "processing", attempts: (task.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", task.id).eq("status", task.status).select().maybeSingle();
  if (error) { log(runId, "warn", "Failed to claim task", { taskId: task.id, error: error.message }); return null; }
  if (!data) { log(runId, "info", "Task claimed by another run — skipping", { taskId: task.id }); return null; }
  return data;
}

async function markCompleted(runId: string, taskId: string) {
  await supabaseAdmin.from("automation_queue").update({ status: "completed", error_log: null, updated_at: new Date().toISOString() }).eq("id", taskId);
  log(runId, "info", "Task marked completed", { taskId });
}

async function markFailed(runId: string, task: any, err: TaskError) {
  const maxAttempts = task.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const attemptsExhausted = task.attempts >= maxAttempts;
  const nowIso = new Date().toISOString();

  if (err.retryable && !attemptsExhausted) {
    const nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    await supabaseAdmin.from("automation_queue").update({
      status: "failed", error_log: err.message, last_error_at: nowIso, next_retry_at: nextRetryAt, updated_at: nowIso,
    }).eq("id", task.id);
    log(runId, "warn", "Task failed — scheduled for retry", { taskId: task.id, attempts: task.attempts, maxAttempts, nextRetryAt, error: err.message });
  } else {
    await supabaseAdmin.from("automation_queue").update({
      status: "failed_permanent", error_log: err.message, last_error_at: nowIso, next_retry_at: null, updated_at: nowIso,
    }).eq("id", task.id);
    log(runId, "error", "Task permanently failed — needs manual review", { taskId: task.id, attempts: task.attempts, maxAttempts, error: err.message });
    await sendAdminEmail(runId, `Task failed permanently — needs manual review (Order ${task.order_id})`,
      `<p>Action <b>${task.action_type}</b> for order <b>${task.order_id}</b> failed after ${task.attempts} attempt(s) and will not retry automatically.</p><p>Error: ${err.message}</p>`);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  log(runId, "info", "Queue worker run started");

  if (Object.keys(env).length === 0) {
    const msg = "Worker misconfigured: required environment variables are missing.";
    log(runId, "error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  const summary = { claimed: 0, completed: 0, retried: 0, failedPermanent: 0, skipped: 0 };

  try {
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("automation_queue").select("*")
      .in("status", ["pending", "failed", "processing"])
      .order("created_at", { ascending: true }).limit(CANDIDATE_LIMIT);

    if (fetchError) {
      log(runId, "error", "Failed to fetch candidate tasks", { error: fetchError.message });
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    const now = Date.now();
    const workList = (candidates ?? []).filter((t: any) => {
      if (t.status === "pending") return true;
      if (t.status === "failed") {
        const maxAttempts = t.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
        const due = !t.next_retry_at || new Date(t.next_retry_at).getTime() <= now;
        return t.attempts < maxAttempts && due;
      }
      if (t.status === "processing") return now - new Date(t.updated_at).getTime() > STALE_PROCESSING_MS;
      return false;
    }).slice(0, BATCH_LIMIT);

    if (workList.length === 0) {
      log(runId, "info", "No eligible tasks found");
      return new Response(JSON.stringify({ message: "No eligible tasks.", ...summary }), { status: 200 });
    }

    log(runId, "info", `Found ${workList.length} eligible task(s)`, { taskIds: workList.map((t: any) => t.id) });

    for (const rawTask of workList) {
      const claimed = await claimTask(runId, rawTask);
      if (!claimed) { summary.skipped++; continue; }
      summary.claimed++;

      log(runId, "info", "Processing task", { taskId: claimed.id, orderId: claimed.order_id, actionType: claimed.action_type, attempt: claimed.attempts });

      try {
        switch (claimed.action_type) {
          case "process_refund": await handleProcessRefund(runId, claimed); break;
          case "cancel_shipment": await handleCancelShipment(runId, claimed); break;
          case "create_reverse_pickup": await handleCreateReversePickup(runId, claimed); break;
          case "create_exchange_shipment": await handleCreateExchangeShipment(runId, claimed); break;
          default: throw new TaskError(`Unknown action_type: ${claimed.action_type}`, false);
        }
        await markCompleted(runId, claimed.id);
        summary.completed++;
      } catch (err: any) {
        const taskErr = err instanceof TaskError ? err : new TaskError(err?.message ?? String(err), true);
        await markFailed(runId, claimed, taskErr);
        if (taskErr.retryable && claimed.attempts < (claimed.max_attempts ?? DEFAULT_MAX_ATTEMPTS)) summary.retried++;
        else summary.failedPermanent++;
      }
    }

    const durationMs = Date.now() - startedAt;
    log(runId, "info", "Queue worker run finished", { ...summary, durationMs });
    return new Response(JSON.stringify({ runId, durationMs, ...summary }), { status: 200 });
  } catch (globalErr: any) {
    log(runId, "error", "Uncaught exception in worker run", { error: globalErr.message, stack: globalErr.stack });
    return new Response(JSON.stringify({ error: globalErr.message }), { status: 500 });
  }
});
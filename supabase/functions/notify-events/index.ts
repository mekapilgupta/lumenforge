import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Generic admin-email dispatcher. Currently called by the pg_net trigger on
 * order_returns insert (see 02_returns_and_reverse_logistics.sql), but built
 * to take an `event` field so you can point future DB triggers at it too
 * without adding another function.
 *
 * Env vars needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 * ADMIN_EMAIL, NOTIFY_EVENTS_SECRET (must match what's hardcoded in the
 * pg_net trigger's Authorization header).
 */

const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@yourdomain.com";
const NOTIFY_EVENTS_SECRET = Deno.env.get("NOTIFY_EVENTS_SECRET");

function log(reqId: string, level: "info" | "warn" | "error", msg: string, meta: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), reqId, level, msg, ...meta };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

async function sendEmail(reqId: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    log(reqId, "warn", "Email skipped — RESEND_API_KEY/ADMIN_EMAIL not set");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject, html }),
  });
  if (!res.ok) log(reqId, "warn", "Email send failed", { status: res.status, body: await res.text().catch(() => "") });
  else log(reqId, "info", "Email sent", { subject });
}

serve(async (req) => {
  const reqId = crypto.randomUUID();

  if (NOTIFY_EVENTS_SECRET) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${NOTIFY_EVENTS_SECRET}`) {
      log(reqId, "warn", "Rejected notify-events call — bad/missing auth");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  try {
    const { event, return_id, order_id } = await req.json();
    log(reqId, "info", "notify-events received", { event, return_id, order_id });

    if (event === "return_requested") {
      const { data: ret } = await supabaseAdmin.from("order_returns").select("*").eq("id", return_id).maybeSingle();
      const { data: order } = await supabaseAdmin.from("orders").select("order_number, customer_name, customer_email").eq("id", order_id).maybeSingle();

      await sendEmail(reqId, `New ${ret?.type === "exchange" ? "exchange" : "return"} request — Order ${order?.order_number ?? order_id}`,
        `<p><b>${order?.customer_name ?? "A customer"}</b> (${order?.customer_email ?? "—"}) requested a <b>${ret?.type ?? "return"}</b> on order <b>${order?.order_number ?? order_id}</b>.</p>
         <p>Reason: ${ret?.reason_code ?? "—"}</p>
         <p>Note: ${ret?.customer_note ?? "—"}</p>
         <p>Review it in the admin panel under Returns &amp; Exchanges.</p>`);

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    log(reqId, "warn", "Unhandled event type", { event });
    return new Response(JSON.stringify({ success: true, message: "Unhandled event, ignored" }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    log(reqId, "error", "notify-events error", { error: (error as Error).message });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});

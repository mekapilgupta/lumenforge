import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ADMIN_EMAILS = ["kapilgupta@duck.com", "hello@frenchtoes.in", "FRENCHTOESAPPARELS@GMAIL.COM"];
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "alerts@frenchtoes.in";
const NOTIFY_EVENTS_SECRET = Deno.env.get("NOTIFY_EVENTS_SECRET");

function log(reqId: string, level: "info" | "warn" | "error", msg: string, meta: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), reqId, level, msg, ...meta };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

async function sendEmail(reqId: string, subject: string, html: string) {
  if (!BREVO_API_KEY || ADMIN_EMAILS.length === 0) {
    log(reqId, "warn", "Email skipped — BREVO_API_KEY or ADMIN_EMAILS not set");
    return;
  }
  for (const email of ADMIN_EMAILS) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: "FrenchToes Alerts", email: EMAIL_FROM },
          to: [{ email, name: "Admin" }],
          subject,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        log(reqId, "warn", `Email send failed to ${email}`, { status: res.status, body: await res.text().catch(() => "") });
      } else {
        const data = await res.json().catch(() => ({}));
        log(reqId, "info", `Email sent to ${email}`, { subject, messageId: data.messageId });
      }
    } catch (e) {
      log(reqId, "warn", `Email send threw for ${email}`, { error: (e as Error).message });
    }
  }
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
# Email Setup — French Toes

## 1. OTP login email (remove login link, OTP only)

The OTP email is sent by **Supabase Auth**, so its template lives in the Supabase
dashboard, not in this codebase.

**Where:** https://supabase.com/dashboard/project/mmmtpheheqxdojbssapb/auth/templates
→ open **"Login / Signup"** (magic link) template.

Replace the entire body with exactly this (keeps `{{ .Token }}`, removes `{{ .ConfirmationURL }}`):

```html
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fff7f3;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f3;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #f0e0d6;border-radius:12px;font-family:Georgia,'Times New Roman',serif;">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:18px;letter-spacing:2px;color:#b0533f;">FRENCH TOES</div>
        </td></tr>
        <tr><td style="padding:16px 28px 4px;">
          <h1 style="margin:0;font-size:21px;color:#3d2c22;font-weight:normal;">Your login code</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#3d2c22;font-family:Arial,Helvetica,sans-serif;">
            Use the code below to sign in to your French Toes account. It expires in 10 minutes.
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;">
          <div style="background:#faf6f1;border:1px solid #e8ddd2;border-radius:10px;padding:18px;text-align:center;">
            <span style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#b0533f;font-family:Arial,Helvetica,sans-serif;">{{ .Token }}</span>
          </div>
          <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#a08a77;font-family:Arial,Helvetica,sans-serif;">
            Didn't request this? You can safely ignore this email — your account is secure.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px 20px;">
          <div style="margin-top:10px;padding-top:14px;border-top:1px solid #f0e7dc;font-size:12px;color:#a08a77;font-family:Arial,Helvetica,sans-serif;">
            French Toes · Handcrafted footwear, made to order in India.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

Also set the **subject** to: `Your French Toes login code: {{ .Token }}`

And confirm in **Auth → Email Settings** that "Send magic link" style templates no
longer include `{{ .ConfirmationURL }}` — the app now verifies by 6-digit OTP only
(`signInWithOtp` + `verifyOtp` in `src/lib/stores/auth.svelte.ts`).

## 2. Anti-spam configuration (Brevo)

Our transactional mails come from `alerts@frenchtoes.in` via Brevo with
`replyTo: hello@frenchtoes.in`. Templates are deliberately simple: single wrapper
table, inline CSS, no hosted images, no tracking pixels, 1–2 links max.

Checklist in Brevo:
- **Authenticate the domain**: add the Brevo-supplied SPF, DKIM, and DMARC DNS
  records for `frenchtoes.in` (Brevo → Senders, Domains & Dedicated IPs).
  This is the single biggest spam-fix.
- Use `alerts@frenchtoes.in` (or any address on your own domain) — never a Gmail
  alias — as the sender.
- Keep one unsubscribe-list impression low: transactional order emails shouldn't
  include marketing footers.

## 3. What emails exist now (single source of truth: `src/lib/server/orderEmails.ts`)

Every order event sends a **detailed email** — full item list (name, SKU, color,
size, qty, line total), payment summary (subtotal / discount / shipping / COD
charges / GST / total / paid online / due on delivery), delivery address, phone,
payment IDs — to the **customer** and a matching **admin copy** to
`ADMIN_NOTIFICATION_EMAILS`.

Events wired:
| Event | Trigger |
|---|---|
| order_placed | checkout (COD direct + Razorpay paths) — `/api/emails` |
| order_processing / confirmed / shipped / out_for_delivery / delivered / cancelled | admin status update (detailed payload incl. items & payment) |
| cancellation_approved / cancellation_rejected | admin cancellation actions |
| cod_balance_collected | admin "Mark COD Balance Collected" |
| new_message | customer↔admin chat on an order |
| return_requested | notify-events edge function (returns flow) |

Legacy `type: 'transactional' | 'status_update' | 'cancellation_response'` calls
are mapped to the new events for backward compatibility (order email upgrades come
automatically from the shared template).

// ─── French Toes — Shared Refund Logic ──────────────────────────────────────
// One function for all refund paths: Razorpay API (original_payment),
// manual UPI / bank_transfer / store_credit.

import { supabase } from '$lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RefundOptions {
  /** The order_return row id this refund is tied to. */
  orderReturnId: string;
  /** The order id. */
  orderId: string;
  /** Refund method. */
  method: 'original_payment' | 'upi' | 'bank_transfer' | 'store_credit';
  /** Refund amount in PAISE (matches existing paise convention). */
  amountPaise: number;
  /** Required for upi / bank_transfer. */
  referenceId?: string;
  /** Optional deduction info for partial refunds. */
  deductions?: { reason: string; amount: number } | null;
  /** The admin id performing the action (for manual_action_log). */
  adminId: string;
  /** Razorpay payment id (required if method = original_payment). */
  razorpayPaymentId?: string;
  /** Whether this is an automated refund (no manual_action_log row needed). */
  automated?: boolean;
  /** Admin action id to resolve (mark as resolved) after manual refund. */
  adminActionId?: string;
}

export interface RefundResult {
  success: boolean;
  error?: string;
  /** For automated original_payment, the Razorpay refund id. */
  razorpayRefundId?: string;
}

// ─── processRefund — routes to correct refund path ──────────────────────────

export async function processRefund(opts: RefundOptions): Promise<RefundResult> {
  if (opts.method === 'original_payment') {
    return processRazorpayRefund(opts);
  }
  return processManualRefund(opts);
}

// ─── Razorpay refund (automated) ────────────────────────────────────────────

async function processRazorpayRefund(opts: RefundOptions): Promise<RefundResult> {
  if (!opts.razorpayPaymentId) {
    return { success: false, error: 'Missing Razorpay payment ID — cannot refund via original payment.' };
  }

  try {
    // Queue the refund via the existing automation_queue pattern
    // The queue-worker edge function processes these in the background.
    const { error: queueErr } = await supabase.from('automation_queue').insert({
      order_id: opts.orderId,
      action_type: 'process_refund',
      payload: {
        razorpay_payment_id: opts.razorpayPaymentId,
        amount: opts.amountPaise,
        order_return_id: opts.orderReturnId,
        deductions: opts.deductions ?? null,
      },
    });

    if (queueErr) {
      return { success: false, error: 'Failed to queue Razorpay refund: ' + queueErr.message };
    }

    // Update order_returns refund fields
    await supabase
      .from('order_returns')
      .update({
        refund_mode: opts.deductions ? 'partial' : 'full',
        refund_amount: opts.amountPaise / 100, // store as numeric rupees
        refund_method: 'original_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.orderReturnId);

    // Write customer timeline entry
    await supabase.from('order_logs').insert({
      order_id: opts.orderId,
      status: 'refunded',
      note: `Refund of ₹${(opts.amountPaise / 100).toFixed(2)} processed via original payment method.${
        opts.deductions ? ` Deduction: ₹${opts.deductions.amount} (${opts.deductions.reason}).` : ''
      }`,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: 'Razorpay refund failed: ' + (e.message ?? 'unknown error') };
  }
}

// ─── Manual refund (UPI / bank transfer / store credit) ─────────────────────

async function processManualRefund(opts: RefundOptions): Promise<RefundResult> {
  if (!opts.referenceId && ['upi', 'bank_transfer'].includes(opts.method)) {
    return { success: false, error: 'Reference ID is required for manual UPI or bank transfer refunds.' };
  }

  try {
    // Write refund details to order_returns
    const { error: updateErr } = await supabase
      .from('order_returns')
      .update({
        refund_mode: opts.deductions ? 'partial' : 'full',
        refund_amount: opts.amountPaise / 100,
        refund_method: opts.method,
        refund_reference_id: opts.referenceId ?? null,
        refund_deductions: opts.deductions ?? null,
        manual_override: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.orderReturnId);

    if (updateErr) {
      return { success: false, error: 'Failed to update return record: ' + updateErr.message };
    }

    // Write to manual_action_log
    const { error: logErr } = await supabase.from('manual_action_log').insert({
      admin_id: opts.adminId,
      action_type: 'manual_refund',
      input_data: {
        order_return_id: opts.orderReturnId,
        order_id: opts.orderId,
        method: opts.method,
        amount_paise: opts.amountPaise,
        reference_id: opts.referenceId ?? null,
        deductions: opts.deductions ?? null,
      },
    });

    if (logErr) {
      console.warn('Manual refund logged but audit trail insert failed:', logErr.message);
    }

    // Write customer timeline entry
    const methodLabel: Record<string, string> = {
      upi: 'UPI',
      bank_transfer: 'bank transfer',
      store_credit: 'store credit',
    };

    await supabase.from('order_logs').insert({
      order_id: opts.orderId,
      status: 'refunded',
      note: `Refund of ₹${(opts.amountPaise / 100).toFixed(2)} processed via ${methodLabel[opts.method] ?? opts.method}.${
        opts.referenceId ? ` Reference: ${opts.referenceId}.` : ''
      }${
        opts.deductions
          ? ` Deduction: ₹${opts.deductions.amount} (${opts.deductions.reason}).`
          : ''
      }`,
    });

    // Resolve the matching admin_actions row
    if (opts.adminActionId) {
      await supabase
        .from('admin_actions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', opts.adminActionId);
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: 'Manual refund failed: ' + (e.message ?? 'unknown error') };
  }
}
import { supabase } from '$lib/supabaseClient';

export interface ProcessRefundOptions {
  mode: 'full' | 'partial';
  amount: number; // in Rupees
  method: 'original_payment' | 'upi' | 'bank_transfer' | 'store_credit';
  referenceId?: string;
  deductionReason?: string;
  adminId: string;
  adminActionId?: string | null;
}

export interface RefundResult {
  success: boolean;
  error?: string;
  refundId?: string;
}

/**
 * Shared refund function used by returns drawer to process refunds securely.
 * Handles Razorpay API integrations and manual methods (UPI/Bank/Store Credit).
 */
export async function processRefund(
  orderReturn: any,
  options: ProcessRefundOptions
): Promise<RefundResult> {
  const amountPaise = Math.round(options.amount * 100);

  if (options.method === 'original_payment') {
    // 1. Original Payment (Razorpay) Flow
    if (!orderReturn.order?.razorpay_payment_id) {
      return { success: false, error: 'Original order does not have a Razorpay payment ID.' };
    }

    try {
      const response = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: orderReturn.order.razorpay_payment_id,
          amount_paise: amountPaise
        })
      });

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to process Razorpay refund.' };
      }

      // Success! Update order returns and orders
      const note = `Auto-refunded ₹${options.amount} via Razorpay. Refund ID: ${result.refund_id}`;
      
      const { error: retErr } = await supabase
        .from('order_returns')
        .update({
          status: 'refunded',
          refund_mode: options.mode,
          refund_amount: options.amount,
          refund_method: options.method,
          refund_reference_id: result.refund_id,
          admin_notes: note,
          admin_refund_amount: amountPaise,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderReturn.id);

      if (retErr) {
        return { success: false, error: 'Refund completed in Razorpay, but failed to update return record: ' + retErr.message };
      }

      await supabase
        .from('orders')
        .update({
          status: 'returned',
          payment_status: 'refunded',
          refund_amount: amountPaise,
          refund_completed_at: new Date().toISOString()
        })
        .eq('id', orderReturn.order_id);

      await supabase.from('order_logs').insert({
        order_id: orderReturn.order_id,
        status: 'returned',
        note: note,
        created_by: options.adminId
      });

      // Audit log in manual_action_log
      await supabase.from('manual_action_log').insert({
        admin_action_id: options.adminActionId || null,
        admin_id: options.adminId,
        action_type: 'refund_original_payment',
        input_data: {
          order_return_id: orderReturn.id,
          amount_paise: amountPaise,
          refund_id: result.refund_id
        }
      });

      return { success: true, refundId: result.refund_id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error executing Razorpay refund API.' };
    }
  } else {
    // 2. Manual Payment Flow (UPI, Bank Transfer, Store Credit)
    const note = `Manually refunded ₹${options.amount} via ${options.method.toUpperCase()}. Ref: ${options.referenceId || 'N/A'}`;
    
    const { error: retErr } = await supabase
      .from('order_returns')
      .update({
        status: 'refunded',
        refund_mode: options.mode,
        refund_amount: options.amount,
        refund_method: options.method,
        refund_reference_id: options.referenceId || null,
        refund_deductions: options.deductionReason ? { reason: options.deductionReason } : null,
        admin_notes: note,
        admin_refund_amount: amountPaise,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderReturn.id);

    if (retErr) {
      return { success: false, error: 'Failed to update return record: ' + retErr.message };
    }

    await supabase
      .from('orders')
      .update({
        status: 'returned',
        payment_status: 'refunded',
        refund_amount: amountPaise,
        refund_completed_at: new Date().toISOString()
      })
      .eq('id', orderReturn.order_id);

    await supabase.from('order_logs').insert({
      order_id: orderReturn.order_id,
      status: 'returned',
      note: note,
      created_by: options.adminId
    });

    // Audit log in manual_action_log
    await supabase.from('manual_action_log').insert({
      admin_action_id: options.adminActionId || null,
      admin_id: options.adminId,
      action_type: `refund_manual_${options.method}`,
      input_data: {
        order_return_id: orderReturn.id,
        amount_paise: amountPaise,
        reference_id: options.referenceId,
        deduction_reason: options.deductionReason
      }
    });

    return { success: true };
  }
}

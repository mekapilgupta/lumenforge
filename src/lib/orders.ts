// ─── French Toes — Shared Order Logic ───────────────────────────────────────
// One function for cancellation rules, used by both customer UI and API.
// One function for exchange order creation, used by admin returns page.

import { supabase } from '$lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrderSnapshot {
  id: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  cancellation_status?: string | null;
  razorpay_payment_id?: string | null;
  user_id: string;
  shipping_address_id?: string | null;
  billing_address_id?: string | null;
  customer_notes?: string | null;
  admin_notes?: string | null;
  total_amount: number;
}

export interface CancellationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

// ─── can_cancel(order) — single source of truth ─────────────────────────────

export function canCancel(order: OrderSnapshot): CancellationResult {
  const stage = order.status;

  // Delivered / Returned / Cancelled / Refunded — no cancel
  if (['delivered', 'returned', 'cancelled', 'refunded'].includes(stage)) {
    return { allowed: false, requiresApproval: false, reason: 'Order is past the cancellation window.' };
  }

  // Confirmed — can cancel immediately, auto-approved
  if (stage === 'confirmed') {
    return { allowed: true, requiresApproval: false };
  }

  // Processing — can request cancel, but admin must approve
  if (stage === 'processing') {
    return { allowed: true, requiresApproval: true };
  }

  // Packed / Shipped / Out for Delivery — physically can't cancel
  if (['packed', 'shipped', 'out_for_delivery'].includes(stage)) {
    return { allowed: false, requiresApproval: false, reason: 'Cannot cancel once packed or shipped. Please refuse delivery or request a return after delivery.' };
  }

  // Pending orders can be cancelled
  if (stage === 'pending') {
    return { allowed: true, requiresApproval: false };
  }

  // Unknown stage — conservative: don't allow
  return { allowed: false, requiresApproval: false, reason: 'Unknown order state.' };
}

// ─── createExchangeOrder(orderReturn) — creates a linked replacement order ──

export interface ExchangeOrderParams {
  orderReturnId: string;
  originalOrderId: string;
  requestedVariantId: string;
  priceDifference: number; // positive = customer owes, negative = refund owed, 0 = even
  userId: string;
  shippingAddressId: string;
  productName: string;
  productImageUrl?: string | null;
}

export interface ExchangeOrderResult {
  success: boolean;
  newOrderId?: string;
  newOrderNumber?: string;
  error?: string;
}

export async function createExchangeOrder(
  params: ExchangeOrderParams
): Promise<ExchangeOrderResult> {
  // ── 1. Re-validate variant stock ──────────────────────────────────────
  const { data: variant, error: variantErr } = await supabase
    .from('product_variants')
    .select('id, stock_quantity, product_id, sku, size, color, price_adjustment')
    .eq('id', params.requestedVariantId)
    .single();

  if (variantErr || !variant) {
    return { success: false, error: 'Requested variant not found.' };
  }
  if (variant.stock_quantity <= 0) {
    return { success: false, error: 'Requested variant is out of stock. Offer the customer an alternative.' };
  }

  // ── 2. Decrement stock of the replacement variant (reserve immediately) ──
  const { error: stockErr } = await supabase
    .from('product_variants')
    .update({ stock_quantity: variant.stock_quantity - 1 })
    .eq('id', params.requestedVariantId)
    .eq('stock_quantity', variant.stock_quantity); // optimistic concurrency

  if (stockErr) {
    return { success: false, error: 'Failed to reserve stock. The variant may have sold out between validation and reservation.' };
  }

  // ── 3. Get original order to clone customer / shipping info ────────────
  const { data: originalOrder, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.originalOrderId)
    .single();

  if (orderErr || !originalOrder) {
    // Rollback stock reservation
    await supabase
      .from('product_variants')
      .update({ stock_quantity: variant.stock_quantity })
      .eq('id', params.requestedVariantId);
    return { success: false, error: 'Original order not found.' };
  }

  // ── 4. Determine new order's payment + status based on price difference ──
  let newStatus = 'confirmed';
  let newPaymentStatus = originalOrder.payment_status;

  if (params.priceDifference > 0) {
    // Customer owes money — order sits in awaiting_payment
    newStatus = 'pending';
    newPaymentStatus = 'awaiting_payment';
  }
  // If priceDifference <= 0, order is confirmed immediately
  // (refund for the negative difference is handled in Task 8 by calling processRefund)

  // ── 5. Generate new order number ───────────────────────────────────────
  const { data: latestOrder } = await supabase
    .from('orders')
    .select('order_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1001;
  if (latestOrder?.order_number) {
    const match = latestOrder.order_number.match(/FT-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const newOrderNumber = `FT-${String(nextNum).padStart(5, '0')}-EX`;

  // ── 6. Create the new exchange order ───────────────────────────────────
  const { data: newOrder, error: insertErr } = await supabase
    .from('orders')
    .insert({
      order_number: newOrderNumber,
      user_id: params.userId,
      status: newStatus,
      payment_method: originalOrder.payment_method,
      payment_status: newPaymentStatus,
      subtotal: originalOrder.subtotal,
      discount_amount: 0,
      shipping_charges: 0,
      cod_charges: 0,
      gst_amount: originalOrder.gst_amount,
      total_amount: originalOrder.total_amount,
      shipping_address_id: params.shippingAddressId,
      billing_address_id: originalOrder.billing_address_id,
      customer_notes: originalOrder.customer_notes,
      parent_order_id: params.originalOrderId,
      order_type: 'exchange',
      has_active_return: false,
    })
    .select()
    .single();

  if (insertErr || !newOrder) {
    // Rollback stock reservation
    await supabase
      .from('product_variants')
      .update({ stock_quantity: variant.stock_quantity })
      .eq('id', params.requestedVariantId);
    return { success: false, error: 'Failed to create exchange order: ' + (insertErr?.message ?? 'unknown') };
  }

  // ── 7. Create order item for the exchange variant ──────────────────────
  // Get product base price to calculate unit price
  const { data: product } = await supabase
    .from('products')
    .select('price')
    .eq('id', variant.product_id)
    .single();

  const unitPrice = (product?.price ?? originalOrder.total_amount) + (variant.price_adjustment ?? 0);

  const { error: itemErr } = await supabase
    .from('order_items')
    .insert({
      order_id: newOrder.id,
      product_id: variant.product_id,
      variant_id: variant.id,
      product_name: params.productName,
      product_sku: variant.sku,
      variant_info: { size: variant.size, color: variant.color },
      unit_price: unitPrice,
      quantity: 1,
      total_price: unitPrice,
      gst_amount: 0,
      product_image_url: params.productImageUrl ?? null,
    });

  if (itemErr) {
    console.warn('Exchange order created but item insert failed:', itemErr.message);
  }

  // ── 8. Add timeline entries ────────────────────────────────────────────
  // On the ORIGINAL order:
  await supabase.from('order_logs').insert({
    order_id: params.originalOrderId,
    status: originalOrder.status,
    note: `Exchange requested — replacement order ${newOrderNumber} created.`,
    metadata: { exchange_order_id: newOrder.id, exchange_order_number: newOrderNumber },
  });

  // On the NEW order:
  await supabase.from('order_logs').insert({
    order_id: newOrder.id,
    status: newStatus,
    note: `Exchange order created from order ${originalOrder.order_number}.`,
    metadata: { parent_order_id: params.originalOrderId, parent_order_number: originalOrder.order_number },
  });

  return { success: true, newOrderId: newOrder.id, newOrderNumber };
}
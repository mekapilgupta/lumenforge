import type { Order } from '$lib/types';

/**
 * Stage-based check to determine if an order is eligible for cancellation.
 * 
 * - Confirmed (or pending) -> Eligible, auto-approves instantly.
 * - Processing -> Eligible, but requires admin review (cancellation_status = pending).
 * - Packed, Shipped, Out for Delivery, Delivered, etc. -> Ineligible, cannot be cancelled.
 */
export function can_cancel(order: Partial<Order> | null | undefined): boolean {
  if (!order || !order.status) return false;
  
  // If already requested or cancelled, prevent requesting again
  if (
    order.cancellation_status === 'pending' || 
    order.cancellation_status === 'approved' || 
    order.status === 'cancelled' ||
    order.status === 'refunded' ||
    order.status === 'returned'
  ) {
    return false;
  }

  // Eligible statuses
  return ['pending', 'confirmed', 'processing'].includes(order.status);
}

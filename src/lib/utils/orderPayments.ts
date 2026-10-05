// ─── Order Payment Utility Helpers ─────────────────────────────────────────────
// Strictly enforce correct detection of Prepaid vs COD, advance paid, and balance due

export interface OrderPaymentInfo {
  isCod: boolean;
  paymentType: 'cod' | 'prepaid';
  label: string;
  badgeText: string;
  advancePaidPaise: number;
  balanceDuePaise: number;
  isFullyPaid: boolean;
  advancePaidFormatted: string;
  balanceDueFormatted: string;
  totalFormatted: string;
}

export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || isNaN(paise)) return '₹0';
  return '₹' + (Math.round(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Robustly detects whether an order is Cash on Delivery (COD with advance or standard COD)
 *
 * Single source of truth for Prepaid vs COD. A settled prepaid order must NEVER be
 * reclassified as COD by description heuristics — that is what caused the portal
 * flip-flopping between "paid" and "COD advance" views.
 */
export function isCodOrder(o: any): boolean {
  if (!o) return false;
  const total = Number(o.total_amount || 0);
  const adv = Number(o.advance_amount || 0);
  const due = Number(o.cod_balance_due || 0);

  // Explicit payment method is authoritative when present
  if (o.payment_method === 'cod') return true;
  if (o.payment_method === 'razorpay' || o.payment_method === 'prepaid') {
    // Fully-settled prepaid order (incl. one converted from COD after balance collection)
    if (o.payment_status === 'paid' && !(due > 0)) return false;
    return o.payment_status === 'partial_paid' || due > 0 || (adv > 0 && total > 0 && adv < total);
  }

  // Unknown/missing method: rely on hard signals only (no loose description matching)
  if (o.payment_status === 'partial_paid' || o.payment_status === 'paid_advance') return true;
  if (due > 0) return true;
  if (adv > 0 && total > 0 && adv < total) return true;

  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && total > 0 && gwAmount < total) return true;

  const desc = (o.payment_gateway_response as any)?.description;
  if (typeof desc === 'string' && (
    desc.toLowerCase().includes('cod advance') ||
    desc.toLowerCase().includes('advance confirmation')
  )) return true;

  return false;
}

/**
 * Returns the advance amount paid online in paise
 */
export function getAdvAmount(o: any): number {
  if (!o) return 0;
  const total = Number(o.total_amount || 0);
  const adv = Number(o.advance_amount || 0);

  // Advance covering (or exceeding) the full total = order was converted to fully paid
  if (adv > 0 && total > 0 && adv >= total) return adv;
  if (adv > 0 && total > 0 && adv < total) return adv;

  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && total > 0 && gwAmount < total) {
    return Number(gwAmount);
  }
  // If marked as COD but no advance amount saved, fall back to total - stored balance due
  if (o.payment_method === 'cod' && o.cod_balance_due && total) {
    return Math.max(0, total - Number(o.cod_balance_due));
  }
  // Only default to the ₹5 token advance for genuinely COD orders with no data at all
  return isCodOrder(o) ? 500 : 0;
}

/**
 * Returns the remaining balance due in paise for delivery
 */
export function getCodDue(o: any): number {
  if (!o) return 0;
  if (o.cod_balance_due != null && o.cod_balance_due > 0) {
    return Number(o.cod_balance_due);
  }
  if (!isCodOrder(o)) return 0;
  const adv = getAdvAmount(o);
  return Math.max(0, (o.total_amount || 0) - adv);
}

/**
 * Comprehensive payment info resolver for UI display everywhere
 */
export function getOrderPaymentInfo(o: any): OrderPaymentInfo {
  const isCod = isCodOrder(o);
  const totalPaise = Number(o?.total_amount || 0);

  if (isCod) {
    const advancePaidPaise = getAdvAmount(o);
    // Amounts are the source of truth — payment_status can be stale/corrupt.
    const balanceDuePaise = getCodDue(o);
    const isFullyPaid = balanceDuePaise <= 0 || advancePaidPaise >= totalPaise;

    return {
      isCod: true,
      paymentType: 'cod',
      label: 'Cash on Delivery (COD)',
      badgeText: isFullyPaid ? 'COD (Fully Paid)' : `COD (${formatPaise(advancePaidPaise)} Advance Paid)`,
      advancePaidPaise,
      balanceDuePaise,
      isFullyPaid,
      advancePaidFormatted: formatPaise(advancePaidPaise),
      balanceDueFormatted: formatPaise(balanceDuePaise),
      totalFormatted: formatPaise(totalPaise)
    };
  }

  // 100% Prepaid order
  return {
    isCod: false,
    paymentType: 'prepaid',
    label: o?.payment_method === 'razorpay' ? 'Online Paid (Razorpay)' : (o?.payment_method?.toUpperCase() || 'Online Paid'),
    badgeText: 'Prepaid (100% Paid)',
    advancePaidPaise: totalPaise,
    balanceDuePaise: 0,
    isFullyPaid: true,
    advancePaidFormatted: formatPaise(totalPaise),
    balanceDueFormatted: '₹0',
    totalFormatted: formatPaise(totalPaise)
  };
}

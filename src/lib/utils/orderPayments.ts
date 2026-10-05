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

  // 1. Explicit COD method or partial payment status is immediately COD
  if (o.payment_method === 'cod') return true;
  if (o.payment_status === 'partial_paid' || o.payment_status === 'paid_advance') return true;
  if (due > 0) return true;
  if (adv > 0 && total > 0 && adv < total) return true;

  // 2. Razorpay payment gateway proof: if online charged amount < total or description indicates COD advance
  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && total > 0 && gwAmount < total) return true;

  const desc = (o.payment_gateway_response as any)?.description;
  if (typeof desc === 'string' && (
    desc.toLowerCase().includes('cod advance') ||
    desc.toLowerCase().includes('advance confirmation') ||
    desc.toLowerCase().includes('balance')
  )) return true;

  // 3. Fully-settled prepaid order without any partial indicators
  if (o.payment_method === 'razorpay' || o.payment_method === 'prepaid') {
    return false;
  }

  return false;
}

/**
 * Returns the advance amount paid online in paise
 */
export function getAdvAmount(o: any): number {
  if (!o) return 0;
  const total = Number(o.total_amount || 0);
  const adv = Number(o.advance_amount || 0);

  // If advance was saved and less than total
  if (adv > 0 && total > 0 && adv < total) return adv;

  // Check actual amount paid in payment gateway response
  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && total > 0 && gwAmount < total) {
    return Number(gwAmount);
  }

  // If stored balance due exists, advance is total - due
  if (o.cod_balance_due != null && Number(o.cod_balance_due) > 0 && total > Number(o.cod_balance_due)) {
    return total - Number(o.cod_balance_due);
  }

  return isCodOrder(o) ? 500 : 0;
}

/**
 * Returns the remaining balance due in paise for delivery
 */
export function getCodDue(o: any): number {
  if (!o) return 0;
  if (!isCodOrder(o)) return 0;
  const total = Number(o.total_amount || 0);
  const adv = getAdvAmount(o);
  if (o.cod_balance_due != null && Number(o.cod_balance_due) > 0) {
    return Number(o.cod_balance_due);
  }
  return Math.max(0, total - adv);
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

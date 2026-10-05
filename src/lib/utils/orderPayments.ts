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
 */
export function isCodOrder(o: any): boolean {
  if (!o) return false;
  if (o.payment_method === 'cod') return true;
  if (o.payment_status === 'partial_paid' || o.payment_status === 'paid_advance') return true;
  if (o.advance_amount && o.advance_amount > 0 && o.advance_amount < o.total_amount) return true;
  if (o.cod_balance_due && o.cod_balance_due > 0) return true;
  
  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && o.total_amount && gwAmount < o.total_amount) return true;
  
  const desc = (o.payment_gateway_response as any)?.description;
  if (typeof desc === 'string' && (
    desc.toLowerCase().includes('cod advance') || 
    desc.toLowerCase().includes('advance confirmation') ||
    desc.toLowerCase().includes('balance')
  )) return true;

  return false;
}

/**
 * Returns the advance amount paid online in paise
 */
export function getAdvAmount(o: any): number {
  if (!o) return 0;
  if (o.advance_amount && o.advance_amount > 0 && o.total_amount && o.advance_amount < o.total_amount) {
    return Number(o.advance_amount);
  }
  const gwAmount = (o.payment_gateway_response as any)?.amount;
  if (typeof gwAmount === 'number' && gwAmount > 0 && o.total_amount && gwAmount < o.total_amount) {
    return Number(gwAmount);
  }
  // If marked as COD but no advance amount saved, fallback to 500 (₹5) or difference
  if (o.payment_method === 'cod' && o.cod_balance_due && o.total_amount) {
    return Math.max(0, o.total_amount - o.cod_balance_due);
  }
  return 500;
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
    const balanceDuePaise = o?.payment_status === 'paid' ? 0 : getCodDue(o);
    const isFullyPaid = balanceDuePaise === 0 || o?.payment_status === 'paid';

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

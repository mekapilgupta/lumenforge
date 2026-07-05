// ─── General Helpers ──────────────────────────────────────────────────────────

/** Format date for Indian display  "2025-01-15T10:30:00Z" → "15 Jan 2025" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format date with time */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Truncate text */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/** Debounce */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/** Order status label */
export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    packed: 'Packed',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refund_requested: 'Refund Requested',
    refunded: 'Refunded',
    returned: 'Returned',
  };
  return map[status] ?? status;
}

/** Order status color */
export function orderStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    packed: '#06b6d4',
    shipped: '#06b6d4',
    out_for_delivery: '#f97316',
    delivered: '#22c55e',
    cancelled: '#ef4444',
    refund_requested: '#ec4899',
    refunded: '#6b7280',
    returned: '#374151',
  };
  return map[status] ?? '#9ca3af';
}

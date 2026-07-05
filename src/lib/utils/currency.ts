// ─── Currency Utilities ───────────────────────────────────────────────────────

/** Convert paise to formatted INR string  179900 → "₹1,799" */
export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Convert rupees to paise  1799 → 179900 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to rupees  179900 → 1799 */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Calculate discount percentage  original: 249900, current: 179900 → 28 */
export function discountPercent(original: number, current: number): number {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

/** Format price range  min: 129900, max: 219900 → "₹1,299 – ₹2,199" */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

// ─── French Toes — Footwear Sizing Standard & Mapping Utility ────────────────

export interface SizeOption {
  key: string;       // Canonical internal key (e.g. '37' or '4')
  euro: string;      // Euro / Brand size: 35, 36, 37, 38, 39, 40, 41, 42
  ukIndia: string;   // UK / India size: 2, 3, 4, 5, 6, 7, 8, 9
  us: string;        // US Women: 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5
  cm: string;        // Foot length in cm: 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25
  label: string;     // Friendly display: "UK 4 (EU 37)"
  shortLabel: string;// "UK 4 / 37"
}

export const STANDARD_SIZE_MAP: SizeOption[] = [
  { key: '35', euro: '35', ukIndia: '2', us: '4.5', cm: '21.5', label: 'UK 2 (EU 35)', shortLabel: 'UK 2 / 35' },
  { key: '36', euro: '36', ukIndia: '3', us: '5.5', cm: '22.0', label: 'UK 3 (EU 36)', shortLabel: 'UK 3 / 36' },
  { key: '37', euro: '37', ukIndia: '4', us: '6.5', cm: '22.5', label: 'UK 4 (EU 37)', shortLabel: 'UK 4 / 37' },
  { key: '38', euro: '38', ukIndia: '5', us: '7.5', cm: '23.0', label: 'UK 5 (EU 38)', shortLabel: 'UK 5 / 38' },
  { key: '39', euro: '39', ukIndia: '6', us: '8.5', cm: '23.5', label: 'UK 6 (EU 39)', shortLabel: 'UK 6 / 39' },
  { key: '40', euro: '40', ukIndia: '7', us: '9.5', cm: '24.0', label: 'UK 7 (EU 40)', shortLabel: 'UK 7 / 40' },
  { key: '41', euro: '41', ukIndia: '8', us: '10.5', cm: '24.5', label: 'UK 8 (EU 41)', shortLabel: 'UK 8 / 41' },
  { key: '42', euro: '42', ukIndia: '9', us: '11.5', cm: '25.0', label: 'UK 9 (EU 42)', shortLabel: 'UK 9 / 42' },
];

/**
 * Find size option by any representation (e.g. '4', '37', 'UK 4', 'EU 37', '22.5')
 */
export function findSizeOption(rawSize: string | number): SizeOption | undefined {
  const str = String(rawSize).trim().toLowerCase().replace(/^(uk|eu|size|ind)\s*/i, '');
  return STANDARD_SIZE_MAP.find(
    s =>
      s.key === str ||
      s.euro === str ||
      s.ukIndia === str ||
      s.us === str ||
      s.euro.toLowerCase() === str ||
      s.ukIndia.toLowerCase() === str
  );
}

/**
 * Returns formatted display label for any size input (e.g. "UK 4 (EU 37)")
 */
export function formatSizeDisplay(rawSize: string | number, format: 'full' | 'short' | 'uk' | 'eu' = 'full'): string {
  const opt = findSizeOption(rawSize);
  if (!opt) return `Size ${rawSize}`;

  switch (format) {
    case 'full':
      return opt.label;
    case 'short':
      return opt.shortLabel;
    case 'uk':
      return `UK ${opt.ukIndia}`;
    case 'eu':
      return `EU ${opt.euro}`;
    default:
      return opt.label;
  }
}

/**
 * Check if two size inputs refer to the same physical shoe size
 * (e.g. isSameSize('4', '37') === true)
 */
export function isSameSize(a: string | number, b: string | number): boolean {
  if (String(a).trim() === String(b).trim()) return true;
  const optA = findSizeOption(a);
  const optB = findSizeOption(b);
  if (optA && optB) {
    return optA.euro === optB.euro;
  }
  return false;
}

/**
 * Normalizes size strings to canonical euro/brand size string ('35'..'42')
 */
export function canonicalizeSize(rawSize: string | number): string {
  const opt = findSizeOption(rawSize);
  return opt ? opt.euro : String(rawSize).trim();
}

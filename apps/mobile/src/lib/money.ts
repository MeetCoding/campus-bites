const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const rupeesAndPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money is stored as integer paise everywhere; format only at render. 4000 → "₹40", 4050 → "₹40.50" */
export function formatPaise(paise: number): string {
  return (paise % 100 === 0 ? wholeRupees : rupeesAndPaise).format(paise / 100);
}

/** "40.5" / "₹40" → 4050; null if not a valid non-negative amount with ≤ 2 decimals. */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

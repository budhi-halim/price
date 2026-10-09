/** Preserve the established growth, buffer, and rounding order. */
export function calculatePrice(usd, year, currentYear, rate) {
  const elapsed = Math.max(currentYear - year, 0);
  const spices = Math.round(usd * Math.pow(1.005, elapsed) * 1.1 * 10) / 10;
  const seasoning = Math.round(usd * Math.pow(1.015, elapsed) * 1.2 * 10) / 10;
  const idr = value => rate ? Math.round(value * rate / 1000) * 1000 : null;
  return { spices, seasoning, bottomIdr: idr(usd), spicesIdr: idr(spices), seasoningIdr: idr(seasoning) };
}

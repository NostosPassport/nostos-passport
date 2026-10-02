/** Money is integer cents everywhere. The UI takes dollars; convert at the edge. */
export function dollarsToCents(input: string | number): number | null {
  const s = String(input).trim().replace(/^\$/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  if (cents === 0) return "Free";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

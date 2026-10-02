/** Display formatting. Pure functions: no rules, only words and numbers. */

/** Server distance in meters to "140 m" or "1.8 km". Anything from 1000 m up is kilometers. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${m} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** "just now", "4 min ago", "2 h ago", "3 d ago". `now` should be the server's time when available. */
export function formatAge(iso: string, now: Date | string = new Date()): string {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  const s = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "1 stamp", "4 stamps". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Initial for avatars: first letter of the name or handle, uppercased. */
export function initial(name: string | null | undefined): string {
  const ch = (name ?? "").trim().replace(/^@/, "").charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

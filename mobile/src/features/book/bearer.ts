/** The bearer page: what a passport prints about its holder. Pure functions, so every line is testable. */
import { hashString } from "@/lib/rng";

export type Bearer = { displayName: string; handle: string; memberSince: string; bio: string };

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "03 OCT 2026" in UTC, so the same instant reads the same on every phone. */
export function bookDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A passport number made from the handle alone: "N" and eight digits. It is not the account id and cannot be turned back into it. */
export function documentNumber(handle: string): string {
  const h = hashString(`nostos:${handle.toLowerCase()}`);
  const h2 = hashString(`${handle.toLowerCase()}:nostos`);
  return `N${String(h % 10_000).padStart(4, "0")}${String(h2 % 10_000).padStart(4, "0")}`;
}

/** The standard 7-3-1 check digit used in machine-readable zones. Letters count 10 to 35, filler counts 0. */
export function checkDigit(field: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i]!;
    const v = c === "<" ? 0 : c >= "0" && c <= "9" ? c.charCodeAt(0) - 48 : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 55 : 0;
    sum += v * weights[i % 3]!;
  }
  return sum % 10;
}

const LINE = 44;
const fill = (s: string) => (s + "<".repeat(LINE)).slice(0, LINE);
/** Latin capitals and digits only; spaces and punctuation become filler, accents fold, other scripts drop out. */
const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<")
    .replace(/^<+|<+$/g, "");

/** Two 44-character lines in the style of a passport's machine zone, for decoration. Always A to Z, 0 to 9 and "<". */
export function machineZone(b: Bearer): [string, string] {
  const words = b.displayName.trim().split(/\s+/).map(clean).filter(Boolean);
  const name = words.length > 1 ? `${words[words.length - 1]}<<${words.slice(0, -1).join("<")}` : words[0] ?? clean(b.handle);
  const line1 = fill(`P<NYC${name}`);
  const num = documentNumber(b.handle);
  const issued = new Date(b.memberSince);
  const ymd = Number.isNaN(issued.getTime()) ? "000000" : `${String(issued.getUTCFullYear() % 100).padStart(2, "0")}${String(issued.getUTCMonth() + 1).padStart(2, "0")}${String(issued.getUTCDate()).padStart(2, "0")}`;
  const line2Core = `${num}${checkDigit(num)}NYC${ymd}${checkDigit(ymd)}`;
  return [line1, fill(line2Core)];
}

/** The labeled fields of the bearer page, in reading order. Nothing here is private: no email, no id. */
export function bearerFields(b: Bearer): { label: string; value: string }[] {
  const fields = [
    { label: "SURNAME AND GIVEN NAMES", value: b.displayName },
    { label: "HANDLE", value: `@${b.handle}` },
    { label: "PASSPORT NO.", value: documentNumber(b.handle) },
    { label: "ISSUED", value: bookDate(b.memberSince) },
  ];
  if (b.bio.trim()) fields.push({ label: "REMARKS", value: b.bio.trim() });
  return fields;
}

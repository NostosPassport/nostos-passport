import { SUBSTRING, WHOLE_WORD } from "./wordlist";

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b", "9": "g" };

/** Lowercase, strip accents and map leetspeak. */
function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c);
}

/**
 * A term as a pattern of letter runs: each run of k identical letters becomes `x{k,}`. So stretched spellings
 * ("faaaggggot") still match, but a term never matches a *different* word ("coon" won't match "con"/"cons",
 * "nigger" won't match "Nigerian").
 */
function pattern(term: string): string {
  return term.replace(/([a-z])\1*/g, (run, ch: string) => `${ch}{${run.length},}`);
}
const WHOLE_RE = new RegExp(`^(?:${WHOLE_WORD.map(pattern).join("|")})$`);
const SUB_RE = new RegExp(SUBSTRING.map(pattern).join("|"));

/**
 * Letter tokens. Runs of single letters ("f a g", "w h o r e") are spelled-out words, so every contiguous piece
 * of such a run (3+ letters) is also checked; that catches "what a w h o r e" even though "a" joins the run.
 */
function tokens(norm: string): string[] {
  const raw = norm.split(/[^a-z]+/).filter(Boolean);
  const out = [...raw];
  const runs: string[] = [];
  let run = "";
  for (const t of raw) {
    if (t.length === 1) run += t;
    else {
      if (run.length > 1) runs.push(run);
      run = "";
    }
  }
  if (run.length > 1) runs.push(run);
  for (const r of runs) for (let i = 0; i < r.length; i++) for (let j = i + 3; j <= r.length; j++) out.push(r.slice(i, j));
  return out;
}

export function containsObjectionable(text: string | null | undefined): boolean {
  if (!text) return false;
  const toks = tokens(normalize(text));
  return toks.some((t) => WHOLE_RE.test(t) || SUB_RE.test(t));
}

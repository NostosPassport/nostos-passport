/**
 * Server-side list of slurs and sexually explicit terms that are rejected in user-visible text
 * (App Store Guideline 1.2). Deliberately small and high-precision: ordinary profanity is allowed (this is
 * a nightlife app), hate speech and explicit sexual terms are not. Moderators handle everything else.
 *
 * WHOLE_WORD terms match a complete token after normalization, so "cocktail", "spicy", "raccoon",
 * "Scunthorpe" and "fire retardant" are fine. SUBSTRING terms are long and unambiguous enough to also be
 * caught inside a single run-together token such as a handle ("xx<term>xx"), never across word breaks.
 *
 * Deliberately NOT listed: words with common innocent uses ("cock" as in Cock & Bull, "cum" as in cum laude),
 * and "rape": people must be able to warn others about assault at a venue. Moderators handle abuse of these.
 */
export const WHOLE_WORD: readonly string[] = [
  // racial and ethnic slurs
  "nigger", "niggers", "nigga", "niggas", "chink", "chinks", "gook", "gooks", "spic", "spics", "kike", "kikes",
  "wetback", "wetbacks", "raghead", "ragheads", "towelhead", "towelheads", "coon", "coons", "beaner", "beaners",
  "paki", "pakis", "zipperhead",
  // homophobic / transphobic slurs
  "fag", "fags", "faggot", "faggots", "dyke", "dykes", "tranny", "trannies", "shemale",
  // ableist slurs
  "retard", "retards", "retarded",
  // sexually explicit terms
  "cunt", "cunts", "pussy", "pussies", "blowjob", "blowjobs", "handjob", "handjobs",
  "cumshot", "cumshots", "porn", "porno", "whore", "whores", "slut", "sluts", "dildo", "jizz",
];

export const SUBSTRING: readonly string[] = ["nigger", "nigga", "faggot", "wetback", "towelhead", "raghead", "blowjob", "cumshot"];

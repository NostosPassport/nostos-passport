/** Sample stamps for the dev preview sheets (web) and the Design gallery (native). Development fixtures only; never imported by product screens. */
import { inkAtContrast, type StampDesignInput, type PriceTier } from "./category-stamp-design";

export type SheetCase = { design: StampDesignInput; visitedAt: string; photo: string | null; seed?: string; caption?: string };
const DAY = "2026-10-19T12:00:00-04:00";
const base = { timeZone: "America/New_York", locality: "New York", cuisine: "", priceTier: null as PriceTier | null };
const mk = (a: Partial<StampDesignInput> & Pick<StampDesignInput, "template" | "name" | "label" | "icon" | "color">): StampDesignInput => ({ ...base, ...a } as StampDesignInput);

export const REFERENCE: SheetCase[] = [
  { design: mk({ template: "restaurant", name: "Osteria della Piazza", label: "ITALIAN", icon: "pasta", color: inkAtContrast("#143B2B"), priceTier: "$$", cuisine: "italian" }), visitedAt: DAY, photo: "restaurant" },
  { design: mk({ template: "airport", name: "John F. Kennedy", label: "JFK", icon: "plane", color: inkAtContrast("#17305E") }), visitedAt: DAY, photo: "airport" },
  { design: mk({ template: "hotel", name: "The Aster House", label: "HOTEL", icon: "key", color: inkAtContrast("#5B2A22"), priceTier: "$$$" }), visitedAt: DAY, photo: "hotel" },
  { design: mk({ template: "bar", name: "Midnight Social", label: "BAR / CLUB", icon: "glass", color: inkAtContrast("#7C1030") }), visitedAt: DAY, photo: "bar" },
];

const T = {
  restaurant: { label: "ITALIAN", icon: "pasta" as const, color: inkAtContrast("#143B2B") },
  airport: { label: "AIRPORT", icon: "plane" as const, color: inkAtContrast("#17305E") },
  hotel: { label: "HOTEL", icon: "key" as const, color: inkAtContrast("#5B2A22") },
  bar: { label: "BAR / CLUB", icon: "glass" as const, color: inkAtContrast("#7C1030") },
};
const templates = ["restaurant", "airport", "hotel", "bar"] as const;
const photoFor = { restaurant: "restaurant", airport: "airport", hotel: "hotel", bar: "bar" } as const;

function across(name: string, caption: string, photo?: string | null, locality?: string): SheetCase[] {
  return templates.map((t) => ({ design: mk({ template: t, name, ...T[t], ...(locality ? { locality } : {}) }), visitedAt: DAY, photo: photo === undefined ? photoFor[t] : photo, caption: `${t} · ${caption}` }));
}

export function stampSheetCases(sheet: string): SheetCase[] {
  if (sheet === "reference") return REFERENCE;
  if (sheet === "long") return [
    ...across("The Extraordinary Restaurant at Washington Square Park and Gardens", "very long name"),
    ...across("Joe's", "short name"),
    ...across("L'Épicérie Française de Saint-Germain-des-Prés", "accents + apostrophe"),
    ...across("東京の小さな食堂", "CJK name"),
    ...across("Αθήνα Μεζεδοπωλείο", "Greek name"),
    ...across("Супер Длинное Название Заведения", "Cyrillic name"),
    ...across("Supercalifragilisticexpialidocious", "one long word"),
    ...across("WWWWWWWW MMMMMMMM", "wide glyphs"),
    ...across("iiiii lllll iiii", "narrow glyphs"),
    ...across("Osteria della Piazza", "WEST VILLAGE locality", undefined, "West Village"),
    ...across("Osteria della Piazza", "very long locality", undefined, "Saint-Jean-Cap-Ferrat-sur-Mer"),
  ];
  if (sheet === "photos") {
    const names = [["portrait", "portrait"], ["landscape", "landscape"], ["bright", "very bright"], ["dark", "very dark"], ["lowres", "low resolution"], [null, "no photo"]] as const;
    return names.flatMap(([p, cap]) => templates.map((t) => ({ design: mk({ template: t, name: t === "restaurant" ? "Osteria della Piazza" : t === "airport" ? "John F. Kennedy" : t === "hotel" ? "The Aster House" : "Midnight Social", ...T[t] }), visitedAt: DAY, photo: p, caption: `${t} · ${cap}` })));
  }
  return REFERENCE;
}

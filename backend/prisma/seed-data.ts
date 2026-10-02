// Static seed fixtures. All venue names are fictional.
import type { LineWait, Vibe } from "@prisma/client";

export type VenueFixture = {
  slug: string;
  name: string;
  address: string;
  neighborhood: "East Village" | "Lower East Side";
  lat: number;
  lng: number;
  officialCoverCents: number | null;
  dressCode: string | null;
  /** open/close in local wall time; close past midnight means next morning */
  open: string;
  close: string;
  closedDays?: number[];
  tonight: {
    /** number of distinct users reporting tonight (0 = no data) */
    reporters: number;
    vibe: Partial<Record<Vibe, number>>;
    line: Partial<Record<LineWait, number>>;
    /** what users actually pay tonight, in cents */
    realCoverCents: number;
    here: number;
    going: number;
  };
  /** cover history for the accuracy score: nights/week with reports, and what users report vs official */
  history: { nightsPerWeek: number; realCoverCents: number; jitterCents: number } | null;
};

export const VENUES: VenueFixture[] = [
  // --- Scenario: official cover consistently lower than reality ---
  {
    slug: "velvet-anchor", name: "The Velvet Anchor", address: "112 St Marks Pl", neighborhood: "East Village",
    lat: 40.72705, lng: -73.98468, officialCoverCents: 1000, dressCode: "No sportswear", open: "20:00", close: "04:00",
    tonight: { reporters: 14, vibe: { PACKED: 6, BUSY: 3 }, line: { TEN_TO_30: 5, OVER_30: 3 }, realCoverCents: 2000, here: 11, going: 18 },
    history: { nightsPerWeek: 3, realCoverCents: 2000, jitterCents: 0 },
  },
  // --- Scenario: paid promo, bad live reports ---
  {
    slug: "neon-oyster", name: "Neon Oyster", address: "61 Avenue A", neighborhood: "East Village",
    lat: 40.72431, lng: -73.98439, officialCoverCents: 0, dressCode: null, open: "18:00", close: "03:00",
    tonight: { reporters: 9, vibe: { DEAD: 6, CHILL: 1 }, line: { NONE: 6 }, realCoverCents: 0, here: 3, going: 4 },
    history: { nightsPerWeek: 2, realCoverCents: 0, jitterCents: 0 },
  },
  {
    slug: "blue-hour-social", name: "Blue Hour Social", address: "203 E 4th St", neighborhood: "East Village",
    lat: 40.72262, lng: -73.98367, officialCoverCents: 1500, dressCode: "Smart casual", open: "21:00", close: "04:00",
    tonight: { reporters: 12, vibe: { BUSY: 6, PACKED: 3 }, line: { UNDER_10: 5, TEN_TO_30: 3 }, realCoverCents: 1500, here: 9, going: 14 },
    history: { nightsPerWeek: 3, realCoverCents: 1500, jitterCents: 200 },
  },
  {
    slug: "copper-fox", name: "Copper Fox Tavern", address: "88 E 7th St", neighborhood: "East Village",
    lat: 40.72686, lng: -73.98636, officialCoverCents: 0, dressCode: null, open: "16:00", close: "02:00",
    tonight: { reporters: 5, vibe: { DEAD: 4, CHILL: 1 }, line: { NONE: 5 }, realCoverCents: 0, here: 1, going: 1 },
    history: { nightsPerWeek: 1, realCoverCents: 0, jitterCents: 0 },
  },
  {
    slug: "sixth-street-static", name: "Sixth Street Static", address: "504 E 6th St", neighborhood: "East Village",
    lat: 40.72481, lng: -73.98313, officialCoverCents: 1000, dressCode: null, open: "20:00", close: "04:00",
    tonight: { reporters: 8, vibe: { BUSY: 4, CHILL: 2 }, line: { UNDER_10: 4, NONE: 2 }, realCoverCents: 1000, here: 6, going: 7 },
    history: { nightsPerWeek: 2, realCoverCents: 1000, jitterCents: 100 },
  },
  {
    slug: "lantern-and-lark", name: "Lantern & Lark", address: "37 Avenue B", neighborhood: "East Village",
    lat: 40.72191, lng: -73.98241, officialCoverCents: 2000, dressCode: "Dress to impress", open: "22:00", close: "04:00",
    tonight: { reporters: 11, vibe: { PACKED: 7, BUSY: 2 }, line: { OVER_30: 5, TEN_TO_30: 3 }, realCoverCents: 2000, here: 10, going: 16 },
    history: { nightsPerWeek: 3, realCoverCents: 2000, jitterCents: 100 },
  },
  {
    slug: "moth-room", name: "The Moth Room", address: "9 E 1st St", neighborhood: "East Village",
    lat: 40.72381, lng: -73.99011, officialCoverCents: 500, dressCode: null, open: "19:00", close: "02:00",
    tonight: { reporters: 4, vibe: { CHILL: 3, BUSY: 1 }, line: { NONE: 3 }, realCoverCents: 500, here: 3, going: 3 },
    history: null,
  },
  {
    slug: "crooked-key", name: "The Crooked Key", address: "145 Avenue A", neighborhood: "East Village",
    lat: 40.72734, lng: -73.98244, officialCoverCents: 0, dressCode: null, open: "17:00", close: "04:00",
    tonight: { reporters: 7, vibe: { CHILL: 4, BUSY: 2 }, line: { NONE: 5 }, realCoverCents: 0, here: 5, going: 5 },
    history: { nightsPerWeek: 1, realCoverCents: 0, jitterCents: 0 },
  },
  {
    slug: "avenue-b-bunker", name: "Avenue B Bunker", address: "171 Avenue B", neighborhood: "East Village",
    lat: 40.72696, lng: -73.97918, officialCoverCents: 1500, dressCode: "All black encouraged", open: "23:00", close: "04:00",
    tonight: { reporters: 6, vibe: { BUSY: 3, PACKED: 2 }, line: { TEN_TO_30: 3, UNDER_10: 2 }, realCoverCents: 2000, here: 4, going: 9 },
    history: { nightsPerWeek: 2, realCoverCents: 1600, jitterCents: 300 },
  },
  {
    slug: "saint-marigold", name: "Saint Marigold", address: "22 St Marks Pl", neighborhood: "East Village",
    lat: 40.72858, lng: -73.98849, officialCoverCents: null, dressCode: null, open: "18:00", close: "02:00",
    tonight: { reporters: 0, vibe: {}, line: {}, realCoverCents: 0, here: 0, going: 2 },
    history: null,
  },
  {
    slug: "low-tide-lounge", name: "Low Tide Lounge", address: "76 E 3rd St", neighborhood: "East Village",
    lat: 40.72447, lng: -73.98763, officialCoverCents: 0, dressCode: null, open: "17:00", close: "02:00",
    tonight: { reporters: 3, vibe: { CHILL: 3 }, line: { NONE: 3 }, realCoverCents: 0, here: 2, going: 2 },
    history: null,
  },
  {
    slug: "parlor-nine", name: "Parlor Nine", address: "309 E 9th St", neighborhood: "East Village",
    lat: 40.72847, lng: -73.98568, officialCoverCents: 1000, dressCode: "Collared shirts after 10pm", open: "20:00", close: "03:00",
    tonight: { reporters: 1, vibe: { BUSY: 1 }, line: { UNDER_10: 1 }, realCoverCents: 1000, here: 1, going: 3 },
    history: { nightsPerWeek: 1, realCoverCents: 1000, jitterCents: 0 },
  },
  {
    slug: "half-moon-hifi", name: "Half Moon Hi-Fi", address: "54 E 4th St", neighborhood: "East Village",
    lat: 40.72601, lng: -73.99092, officialCoverCents: 1200, dressCode: null, open: "21:00", close: "04:00",
    tonight: { reporters: 10, vibe: { BUSY: 5, PACKED: 3 }, line: { UNDER_10: 4, TEN_TO_30: 3 }, realCoverCents: 1200, here: 7, going: 10 },
    history: { nightsPerWeek: 2, realCoverCents: 1200, jitterCents: 100 },
  },
  {
    slug: "tompkins-tap", name: "Tompkins Tap & Tonic", address: "132 Avenue A", neighborhood: "East Village",
    lat: 40.72676, lng: -73.98336, officialCoverCents: 0, dressCode: null, open: "15:00", close: "02:00",
    tonight: { reporters: 5, vibe: { CHILL: 3, BUSY: 2 }, line: { NONE: 4 }, realCoverCents: 0, here: 4, going: 3 },
    history: null,
  },
  // --- Lower East Side ---
  {
    slug: "delancey-echo", name: "Delancey Echo", address: "140 Delancey St", neighborhood: "Lower East Side",
    lat: 40.71868, lng: -73.98776, officialCoverCents: 2500, dressCode: "No hats", open: "22:00", close: "04:00",
    tonight: { reporters: 13, vibe: { PACKED: 7, BUSY: 3 }, line: { OVER_30: 6, TEN_TO_30: 2 }, realCoverCents: 2500, here: 12, going: 20 },
    history: { nightsPerWeek: 3, realCoverCents: 2500, jitterCents: 200 },
  },
  {
    slug: "orchard-afterglow", name: "Orchard Afterglow", address: "171 Orchard St", neighborhood: "Lower East Side",
    lat: 40.72071, lng: -73.98844, officialCoverCents: 1000, dressCode: null, open: "20:00", close: "04:00",
    tonight: { reporters: 7, vibe: { BUSY: 4, CHILL: 2 }, line: { UNDER_10: 4, NONE: 2 }, realCoverCents: 1000, here: 5, going: 6 },
    history: { nightsPerWeek: 2, realCoverCents: 1000, jitterCents: 100 },
  },
  {
    slug: "pickle-jar", name: "The Pickle Jar", address: "88 Essex St", neighborhood: "Lower East Side",
    lat: 40.71849, lng: -73.98814, officialCoverCents: 0, dressCode: null, open: "12:00", close: "01:00",
    tonight: { reporters: 2, vibe: { CHILL: 2 }, line: { NONE: 2 }, realCoverCents: 0, here: 1, going: 1 },
    history: null,
  },
  {
    slug: "ludlow-lights", name: "Ludlow Lights", address: "165 Ludlow St", neighborhood: "Lower East Side",
    lat: 40.72163, lng: -73.98753, officialCoverCents: 1000, dressCode: null, open: "20:00", close: "04:00",
    tonight: { reporters: 9, vibe: { BUSY: 4, PACKED: 3 }, line: { TEN_TO_30: 4, UNDER_10: 3 }, realCoverCents: 1500, here: 7, going: 11 },
    history: { nightsPerWeek: 2, realCoverCents: 1100, jitterCents: 200 },
  },
  {
    slug: "rivington-riot", name: "Rivington Riot", address: "110 Rivington St", neighborhood: "Lower East Side",
    lat: 40.71987, lng: -73.98701, officialCoverCents: 2000, dressCode: null, open: "22:00", close: "04:00",
    tonight: { reporters: 10, vibe: { PACKED: 5, BUSY: 3 }, line: { TEN_TO_30: 5, OVER_30: 2 }, realCoverCents: 2000, here: 8, going: 12 },
    history: { nightsPerWeek: 2, realCoverCents: 2000, jitterCents: 100 },
  },
  {
    slug: "essex-ember", name: "Essex Ember", address: "12 Essex St", neighborhood: "Lower East Side",
    lat: 40.71613, lng: -73.98792, officialCoverCents: 0, dressCode: null, open: "18:00", close: "02:00",
    tonight: { reporters: 0, vibe: {}, line: {}, realCoverCents: 0, here: 0, going: 0 },
    history: null,
  },
  {
    slug: "allen-arcade", name: "Allen Street Arcade", address: "181 Allen St", neighborhood: "Lower East Side",
    lat: 40.72235, lng: -73.98982, officialCoverCents: 500, dressCode: null, open: "17:00", close: "03:00",
    tonight: { reporters: 6, vibe: { BUSY: 3, CHILL: 2 }, line: { NONE: 3, UNDER_10: 2 }, realCoverCents: 500, here: 5, going: 4 },
    history: { nightsPerWeek: 1, realCoverCents: 500, jitterCents: 0 },
  },
  {
    slug: "clinton-cellar", name: "Clinton Cellar", address: "71 Clinton St", neighborhood: "Lower East Side",
    lat: 40.71953, lng: -73.98453, officialCoverCents: 1500, dressCode: "No sneakers", open: "21:00", close: "04:00",
    tonight: { reporters: 4, vibe: { CHILL: 2, BUSY: 2 }, line: { UNDER_10: 3 }, realCoverCents: 1500, here: 3, going: 5 },
    history: { nightsPerWeek: 1, realCoverCents: 1500, jitterCents: 100 },
  },
  {
    slug: "broome-bells", name: "Broome Street Bells", address: "302 Broome St", neighborhood: "Lower East Side",
    lat: 40.71838, lng: -73.99192, officialCoverCents: 0, dressCode: null, open: "16:00", close: "02:00",
    tonight: { reporters: 3, vibe: { CHILL: 2, DEAD: 1 }, line: { NONE: 3 }, realCoverCents: 0, here: 2, going: 1 },
    history: null,
  },
  {
    slug: "norfolk-night-owl", name: "Norfolk Night Owl", address: "130 Norfolk St", neighborhood: "Lower East Side",
    lat: 40.71932, lng: -73.98619, officialCoverCents: 1000, dressCode: null, open: "21:00", close: "04:00", closedDays: [1],
    tonight: { reporters: 5, vibe: { BUSY: 3, CHILL: 1 }, line: { UNDER_10: 3 }, realCoverCents: 1000, here: 3, going: 4 },
    history: { nightsPerWeek: 1, realCoverCents: 1000, jitterCents: 0 },
  },
  {
    slug: "grand-and-ghost", name: "Grand & Ghost", address: "385 Grand St", neighborhood: "Lower East Side",
    lat: 40.71588, lng: -73.98556, officialCoverCents: null, dressCode: null, open: "19:00", close: "02:00",
    tonight: { reporters: 0, vibe: {}, line: {}, realCoverCents: 0, here: 0, going: 1 },
    history: null,
  },
];

export const FIRST_NAMES = [
  "Ava", "Ben", "Cleo", "Dev", "Eli", "Fern", "Gus", "Hana", "Ivan", "Jade", "Kofi", "Luz", "Milo", "Nia", "Omar",
  "Pia", "Quinn", "Rae", "Sol", "Tess", "Umar", "Vera", "Wes", "Xena", "Yuki", "Zane", "Ari", "Bea", "Cy", "Dara",
  "Emil", "Faye", "Gio", "Hugo", "Ines", "Jules", "Kai", "Lena", "Max", "Nora", "Otis", "Priya", "Remy", "Sage",
  "Theo", "Uma", "Vic", "Wren", "Yara", "Zoe", "Ash", "Bo", "Cam",
];
export const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVW".split("");

export const COMMENTS_GOOD = [
  "DJ is actually great tonight, came for one drink and stayed two hours",
  "Bartenders are fast even with the crowd",
  "Back room opened up around midnight, way more space",
  "Sound system slaps. Bring earplugs if you care about your ears",
  "Chill crowd, good for a date",
  "Happy hour pricing still going, nice surprise",
];
export const COMMENTS_BAD = [
  "Bouncer said $20 at the door, not what the sign says",
  "Line barely moving, 40 min and counting",
  "Basically empty despite the promo",
  "AC is broken, it's a sauna in here",
];
export const CAPTIONS = [
  "the line right now", "dance floor 🔥", "neon vibes", "back bar", "quiet corner", "crowd at the door",
  "bartender MVP", "DJ booth", "patio", "late night",
];

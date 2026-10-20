// Static seed fixtures for places. Names are fictional; coordinates sit around New York City.

export type PlaceFixture = { slug: string; name: string; address: string; area: string; lat: number; lng: number };

export const PLACES: PlaceFixture[] = [
  { slug: "velvet-anchor", name: "The Velvet Anchor", address: "112 St Marks Pl", area: "East Village", lat: 40.72705, lng: -73.98468 },
  { slug: "neon-oyster", name: "Neon Oyster", address: "61 Avenue A", area: "East Village", lat: 40.72431, lng: -73.98439 },
  { slug: "blue-hour-social", name: "Blue Hour Social", address: "203 E 4th St", area: "East Village", lat: 40.72262, lng: -73.98367 },
  { slug: "copper-fox", name: "Copper Fox Tavern", address: "88 E 7th St", area: "East Village", lat: 40.72686, lng: -73.98636 },
  { slug: "sixth-street-static", name: "Sixth Street Static", address: "504 E 6th St", area: "East Village", lat: 40.72481, lng: -73.98313 },
  { slug: "lantern-and-lark", name: "Lantern & Lark", address: "37 Avenue B", area: "East Village", lat: 40.72191, lng: -73.98241 },
  { slug: "moth-room", name: "The Moth Room", address: "9 E 1st St", area: "East Village", lat: 40.72381, lng: -73.99011 },
  { slug: "crooked-key", name: "The Crooked Key", address: "145 Avenue A", area: "East Village", lat: 40.72734, lng: -73.98244 },
  { slug: "avenue-b-bunker", name: "Avenue B Bunker", address: "171 Avenue B", area: "East Village", lat: 40.72696, lng: -73.97918 },
  { slug: "saint-marigold", name: "Saint Marigold", address: "22 St Marks Pl", area: "East Village", lat: 40.72858, lng: -73.98849 },
  { slug: "low-tide-lounge", name: "Low Tide Lounge", address: "76 E 3rd St", area: "East Village", lat: 40.72447, lng: -73.98763 },
  { slug: "parlor-nine", name: "Parlor Nine", address: "309 E 9th St", area: "East Village", lat: 40.72847, lng: -73.98568 },
  { slug: "half-moon-hifi", name: "Half Moon Hi-Fi", address: "54 E 4th St", area: "East Village", lat: 40.72601, lng: -73.99092 },
  { slug: "tompkins-tap", name: "Tompkins Tap & Tonic", address: "132 Avenue A", area: "East Village", lat: 40.72676, lng: -73.98336 },
  { slug: "delancey-echo", name: "Delancey Echo", address: "140 Delancey St", area: "Lower East Side", lat: 40.71868, lng: -73.98776 },
  { slug: "orchard-afterglow", name: "Orchard Afterglow", address: "171 Orchard St", area: "Lower East Side", lat: 40.72071, lng: -73.98844 },
  { slug: "pickle-jar", name: "The Pickle Jar", address: "88 Essex St", area: "Lower East Side", lat: 40.71849, lng: -73.98814 },
  { slug: "ludlow-lights", name: "Ludlow Lights", address: "165 Ludlow St", area: "Lower East Side", lat: 40.72163, lng: -73.98753 },
  { slug: "rivington-riot", name: "Rivington Riot", address: "110 Rivington St", area: "Lower East Side", lat: 40.71987, lng: -73.98701 },
  { slug: "essex-ember", name: "Essex Ember", address: "12 Essex St", area: "Lower East Side", lat: 40.71613, lng: -73.98792 },
  { slug: "allen-arcade", name: "Allen Street Arcade", address: "181 Allen St", area: "Lower East Side", lat: 40.72235, lng: -73.98982 },
  { slug: "clinton-cellar", name: "Clinton Cellar", address: "71 Clinton St", area: "Lower East Side", lat: 40.71953, lng: -73.98453 },
  { slug: "broome-bells", name: "Broome Street Bells", address: "302 Broome St", area: "Lower East Side", lat: 40.71838, lng: -73.99192 },
  { slug: "norfolk-night-owl", name: "Norfolk Night Owl", address: "130 Norfolk St", area: "Lower East Side", lat: 40.71932, lng: -73.98619 },
  { slug: "grand-and-ghost", name: "Grand & Ghost", address: "385 Grand St", area: "Lower East Side", lat: 40.71588, lng: -73.98556 },
  { slug: "tompkins-square-park", name: "Tompkins Square Park", address: "Avenue A at E 9th St", area: "East Village", lat: 40.72654, lng: -73.98179 },
  { slug: "washington-square-park", name: "Washington Square Park", address: "Washington Square", area: "Greenwich Village", lat: 40.73082, lng: -73.99733 },
  { slug: "union-square", name: "Union Square", address: "E 14th St at Broadway", area: "Union Square", lat: 40.7359, lng: -73.9906 },
  { slug: "the-high-line-gansevoort", name: "The High Line at Gansevoort", address: "Gansevoort St", area: "Meatpacking District", lat: 40.73926, lng: -74.00811 },
  { slug: "brooklyn-bridge-park-pier-1", name: "Brooklyn Bridge Park, Pier 1", address: "Furman St", area: "Brooklyn Heights", lat: 40.70237, lng: -73.99646 },
  { slug: "bethesda-terrace", name: "Bethesda Terrace", address: "Central Park Mall", area: "Central Park", lat: 40.77391, lng: -73.9709 },
];

export type SeedPerson = {
  handle: string;
  name: string;
  bio?: string;
  exempt?: boolean;
  ageDays: number;
};

export const PEOPLE: SeedPerson[] = [
  { handle: "appreview", name: "App Review", exempt: true, ageDays: 150, bio: "App Review account." },
  { handle: "maya_r", name: "Maya Rao", bio: "Parks, pizza, vinyl.", ageDays: 120 },
  { handle: "avaa", name: "Ava Alvarez", bio: "Mostly the East Village.", ageDays: 110 },
  { handle: "theo_k", name: "Theo Kim", bio: "Cheap beer, long walks.", ageDays: 100 },
  { handle: "kofi_b", name: "Kofi Boateng", ageDays: 95 },
  { handle: "nia_s", name: "Nia Sato", bio: "I stamp everything.", ageDays: 90 },
  { handle: "sol_m", name: "Sol Marin", ageDays: 80 },
  { handle: "pia_l", name: "Pia Lindqvist", ageDays: 70 },
  { handle: "rowan_k", name: "Rowan Kell", ageDays: 40 },
  { handle: "jules_v", name: "Jules Vega", ageDays: 35 },
  { handle: "ines_p", name: "Ines Pires", ageDays: 30 },
  { handle: "omar_q", name: "Omar Qadir", ageDays: 28 },
];

export const CAPTIONS = [
  "first time here", "the light at golden hour", "back again", "we stayed way too long", "best seat in the house",
  "rainy and perfect", "somebody brought a guitar", "line was worth it", "quiet corner", "this song came on",
  "sunday slow", "last night out before the move", "new favorite", "met an old friend here", "the sunset though",
];

export const SONGS = [
  { title: "Heroes", artist: "David Bowie" },
  { title: "Dreams", artist: "Fleetwood Mac" },
  { title: "Midnight City", artist: "M83" },
  { title: "Take Me Out", artist: "Franz Ferdinand" },
  { title: "Genius of Love", artist: "Tom Tom Club" },
  { title: "Space Song", artist: "Beach House" },
  { title: "Fast Car", artist: "Tracy Chapman" },
  { title: "Electric Feel", artist: "MGMT" },
];

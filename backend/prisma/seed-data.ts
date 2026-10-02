// Static seed fixtures for places. Names are fictional; coordinates sit in the East Village and Lower East Side.

export type PlaceFixture = { slug: string; name: string; address: string; neighborhood: string; lat: number; lng: number };

export const PLACES: PlaceFixture[] = [
  { slug: "velvet-anchor", name: "The Velvet Anchor", address: "112 St Marks Pl", neighborhood: "East Village", lat: 40.72705, lng: -73.98468 },
  { slug: "neon-oyster", name: "Neon Oyster", address: "61 Avenue A", neighborhood: "East Village", lat: 40.72431, lng: -73.98439 },
  { slug: "blue-hour-social", name: "Blue Hour Social", address: "203 E 4th St", neighborhood: "East Village", lat: 40.72262, lng: -73.98367 },
  { slug: "copper-fox", name: "Copper Fox Tavern", address: "88 E 7th St", neighborhood: "East Village", lat: 40.72686, lng: -73.98636 },
  { slug: "sixth-street-static", name: "Sixth Street Static", address: "504 E 6th St", neighborhood: "East Village", lat: 40.72481, lng: -73.98313 },
  { slug: "lantern-and-lark", name: "Lantern & Lark", address: "37 Avenue B", neighborhood: "East Village", lat: 40.72191, lng: -73.98241 },
  { slug: "moth-room", name: "The Moth Room", address: "9 E 1st St", neighborhood: "East Village", lat: 40.72381, lng: -73.99011 },
  { slug: "crooked-key", name: "The Crooked Key", address: "145 Avenue A", neighborhood: "East Village", lat: 40.72734, lng: -73.98244 },
  { slug: "avenue-b-bunker", name: "Avenue B Bunker", address: "171 Avenue B", neighborhood: "East Village", lat: 40.72696, lng: -73.97918 },
  { slug: "saint-marigold", name: "Saint Marigold", address: "22 St Marks Pl", neighborhood: "East Village", lat: 40.72858, lng: -73.98849 },
  { slug: "low-tide-lounge", name: "Low Tide Lounge", address: "76 E 3rd St", neighborhood: "East Village", lat: 40.72447, lng: -73.98763 },
  { slug: "parlor-nine", name: "Parlor Nine", address: "309 E 9th St", neighborhood: "East Village", lat: 40.72847, lng: -73.98568 },
  { slug: "half-moon-hifi", name: "Half Moon Hi-Fi", address: "54 E 4th St", neighborhood: "East Village", lat: 40.72601, lng: -73.99092 },
  { slug: "tompkins-tap", name: "Tompkins Tap & Tonic", address: "132 Avenue A", neighborhood: "East Village", lat: 40.72676, lng: -73.98336 },
  { slug: "delancey-echo", name: "Delancey Echo", address: "140 Delancey St", neighborhood: "Lower East Side", lat: 40.71868, lng: -73.98776 },
  { slug: "orchard-afterglow", name: "Orchard Afterglow", address: "171 Orchard St", neighborhood: "Lower East Side", lat: 40.72071, lng: -73.98844 },
  { slug: "pickle-jar", name: "The Pickle Jar", address: "88 Essex St", neighborhood: "Lower East Side", lat: 40.71849, lng: -73.98814 },
  { slug: "ludlow-lights", name: "Ludlow Lights", address: "165 Ludlow St", neighborhood: "Lower East Side", lat: 40.72163, lng: -73.98753 },
  { slug: "rivington-riot", name: "Rivington Riot", address: "110 Rivington St", neighborhood: "Lower East Side", lat: 40.71987, lng: -73.98701 },
  { slug: "essex-ember", name: "Essex Ember", address: "12 Essex St", neighborhood: "Lower East Side", lat: 40.71613, lng: -73.98792 },
  { slug: "allen-arcade", name: "Allen Street Arcade", address: "181 Allen St", neighborhood: "Lower East Side", lat: 40.72235, lng: -73.98982 },
  { slug: "clinton-cellar", name: "Clinton Cellar", address: "71 Clinton St", neighborhood: "Lower East Side", lat: 40.71953, lng: -73.98453 },
  { slug: "broome-bells", name: "Broome Street Bells", address: "302 Broome St", neighborhood: "Lower East Side", lat: 40.71838, lng: -73.99192 },
  { slug: "norfolk-night-owl", name: "Norfolk Night Owl", address: "130 Norfolk St", neighborhood: "Lower East Side", lat: 40.71932, lng: -73.98619 },
  { slug: "grand-and-ghost", name: "Grand & Ghost", address: "385 Grand St", neighborhood: "Lower East Side", lat: 40.71588, lng: -73.98556 },
];

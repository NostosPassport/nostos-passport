import { z } from "zod";

import { ServiceError } from "@/server/errors";

export const GOOGLE_MAPS_ATTRIBUTION = "Google Maps" as const;
export const GOOGLE_PLACES_TIMEOUT_MS = 5_000;
export const GOOGLE_NEARBY_RADIUS_M = 750;
export const GOOGLE_NEARBY_MAX_RESULTS = 20;

const SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
const LIST_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents",
  "places.timeZone",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
].join(",");
const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "addressComponents",
  "timeZone",
  "primaryType",
  "types",
  "businessStatus",
  "priceLevel",
].join(",");

const addressComponentSchema = z.object({
  longText: z.string().optional(),
  shortText: z.string().optional(),
  types: z.array(z.string()).optional().default([]),
}).passthrough();

const timeZoneSchema = z.union([
  z.string(),
  z.object({ id: z.string().min(1), version: z.string().optional() }).passthrough(),
]);

export const googlePriceLevelSchema = z.enum([
  "PRICE_LEVEL_UNSPECIFIED",
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
]);
export type GooglePriceLevel = z.infer<typeof googlePriceLevelSchema>;

const googlePlaceSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({ text: z.string().min(1) }).passthrough(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).passthrough(),
  addressComponents: z.array(addressComponentSchema).optional().default([]),
  timeZone: timeZoneSchema.optional(),
  primaryType: z.string().optional(),
  types: z.array(z.string()).optional().default([]),
  businessStatus: z.string().optional(),
  priceLevel: googlePriceLevelSchema.optional(),
}).passthrough();

const googleListSchema = z.object({ places: z.array(googlePlaceSchema).optional().default([]) }).passthrough();

type GoogleAddressComponent = z.infer<typeof addressComponentSchema>;

export type PlaceLocality = {
  area: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
};

export type GooglePlace = PlaceLocality & {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  timeZone: string;
  primaryType: string | null;
  types: string[];
  businessStatus: string | null;
  priceLevel: GooglePriceLevel | null;
  category: "restaurant" | "bar";
  cuisines: string[];
};

const BAR_TYPES = new Set([
  "bar",
  "bar_and_grill",
  "beer_garden",
  "brewpub",
  "cocktail_bar",
  "gastropub",
  "hookah_bar",
  "irish_pub",
  "lounge_bar",
  "pub",
  "snack_bar",
  "sports_bar",
  "wine_bar",
  "night_club",
  "nightclub",
  "dance_club",
]);

const TYPE_LABELS: Record<string, string> = {
  asian_fusion_restaurant: "Asian Fusion",
  barbecue_restaurant: "Barbecue",
  bar_and_grill: "Bar & Grill",
  beer_garden: "Beer Garden",
  breakfast_restaurant: "Breakfast",
  brewpub: "Brewpub",
  brunch_restaurant: "Brunch",
  buffet_restaurant: "Buffet",
  burrito_restaurant: "Burritos",
  chicken_wings_restaurant: "Chicken Wings",
  chinese_noodle_restaurant: "Chinese Noodles",
  cocktail_bar: "Cocktail Bar",
  dessert_restaurant: "Dessert",
  dim_sum_restaurant: "Dim Sum",
  dumpling_restaurant: "Dumplings",
  eastern_european_restaurant: "Eastern European",
  falafel_restaurant: "Falafel",
  fast_food_restaurant: "Fast Food",
  fine_dining_restaurant: "Fine Dining",
  fish_and_chips_restaurant: "Fish & Chips",
  fusion_restaurant: "Fusion",
  gastropub: "Gastropub",
  gyro_restaurant: "Gyros",
  hamburger_restaurant: "Burgers",
  hot_dog_restaurant: "Hot Dogs",
  hot_pot_restaurant: "Hot Pot",
  irish_pub: "Irish Pub",
  japanese_curry_restaurant: "Japanese Curry",
  japanese_izakaya_restaurant: "Izakaya",
  korean_barbecue_restaurant: "Korean Barbecue",
  latin_american_restaurant: "Latin American",
  lounge_bar: "Lounge Bar",
  middle_eastern_restaurant: "Middle Eastern",
  mongolian_barbecue_restaurant: "Mongolian Barbecue",
  north_indian_restaurant: "North Indian",
  oyster_bar_restaurant: "Oyster Bar",
  pizza_restaurant: "Pizza",
  ramen_restaurant: "Ramen",
  seafood_restaurant: "Seafood",
  soul_food_restaurant: "Soul Food",
  south_american_restaurant: "South American",
  south_indian_restaurant: "South Indian",
  southwestern_us_restaurant: "Southwestern",
  sports_bar: "Sports Bar",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  taco_restaurant: "Tacos",
  tapas_restaurant: "Tapas",
  tex_mex_restaurant: "Tex-Mex",
  wine_bar: "Wine Bar",
  yakiniku_restaurant: "Yakiniku",
  yakitori_restaurant: "Yakitori",
};

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForType(type: string): string | null {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]!;
  if (BAR_TYPES.has(type)) return type === "bar" ? null : titleCase(type);
  if (type === "restaurant") return null;
  if (type.endsWith("_restaurant")) return titleCase(type.slice(0, -"_restaurant".length));
  return null;
}

function categoryFor(primaryType: string | null, types: readonly string[]): "restaurant" | "bar" | null {
  if (primaryType && BAR_TYPES.has(primaryType)) return "bar";
  if (primaryType === "restaurant" || primaryType?.endsWith("_restaurant") || primaryType === "steak_house") return "restaurant";
  if (types.some((type) => type === "restaurant" || type.endsWith("_restaurant") || type === "steak_house")) return "restaurant";
  if (types.some((type) => BAR_TYPES.has(type))) return "bar";
  return null;
}

export function cuisineTags(primaryType: string | null, types: readonly string[]) {
  const ordered = [...(primaryType ? [primaryType] : []), ...types];
  const tags: string[] = [];
  for (const type of ordered) {
    const tag = labelForType(type);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 6);
}

function component(components: readonly GoogleAddressComponent[], types: readonly string[]) {
  for (const type of types) {
    const match = components.find((item) => item.types.includes(type));
    if (match) return match;
  }
  return null;
}

export function localityFromAddressComponents(components: readonly GoogleAddressComponent[]): PlaceLocality {
  const area = component(components, ["neighborhood", "sublocality_level_1", "sublocality_level_2", "sublocality"]);
  const city = component(components, ["locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2"]);
  const region = component(components, ["administrative_area_level_1"]);
  const country = component(components, ["country"]);
  return {
    area: area?.longText?.trim() || null,
    city: city?.longText?.trim() || null,
    region: region?.longText?.trim() || null,
    country: country?.longText?.trim() || null,
    countryCode: country?.shortText?.trim().toUpperCase() || null,
  };
}

function normalize(raw: z.infer<typeof googlePlaceSchema>): GooglePlace | null {
  const primaryType = raw.primaryType ?? null;
  const category = categoryFor(primaryType, raw.types);
  if (!category) return null;
  const timeZone = typeof raw.timeZone === "string" ? raw.timeZone : raw.timeZone?.id;
  return {
    googlePlaceId: raw.id,
    name: raw.displayName.text.trim().slice(0, 160),
    address: (raw.formattedAddress ?? "").trim().slice(0, 240),
    lat: raw.location.latitude,
    lng: raw.location.longitude,
    ...localityFromAddressComponents(raw.addressComponents),
    timeZone: timeZone?.trim() || "UTC",
    primaryType,
    types: [...new Set(raw.types)].slice(0, 32),
    businessStatus: raw.businessStatus ?? null,
    priceLevel: raw.priceLevel ?? null,
    category,
    cuisines: cuisineTags(primaryType, raw.types),
  };
}

function apiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) throw new ServiceError(503, "places_unavailable", "Place search isn't configured right now.");
  return key;
}

async function googleFetch(url: string, init: RequestInit, fieldMask: string, fetchImpl: typeof fetch): Promise<unknown> {
  try {
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": fieldMask,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
      credentials: "omit",
      redirect: "error",
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    return await res.json();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(503, "places_unavailable", "Place search isn't available right now. Try again in a moment.");
  }
}

function parseList(body: unknown): GooglePlace[] {
  const parsed = googleListSchema.safeParse(body);
  if (!parsed.success) throw new ServiceError(503, "places_bad_response", "Place search returned something unexpected.");
  return parsed.data.places.map(normalize).filter((place): place is GooglePlace => place !== null);
}

export async function googleNearby(
  pos: { lat: number; lng: number },
  radiusM = GOOGLE_NEARBY_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
): Promise<GooglePlace[]> {
  const body = await googleFetch(
    SEARCH_NEARBY_URL,
    {
      method: "POST",
      body: JSON.stringify({
        includedTypes: ["restaurant", "bar"],
        maxResultCount: GOOGLE_NEARBY_MAX_RESULTS,
        rankPreference: "DISTANCE",
        languageCode: "en",
        locationRestriction: { circle: { center: { latitude: pos.lat, longitude: pos.lng }, radius: Math.max(100, Math.min(5_000, radiusM)) } },
      }),
    },
    LIST_FIELD_MASK,
    fetchImpl,
  );
  return parseList(body).filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY");
}

export async function googleTextSearch(
  term: string,
  bias: { lat: number; lng: number } | null,
  fetchImpl: typeof fetch = fetch,
): Promise<GooglePlace[]> {
  const request: Record<string, unknown> = {
    textQuery: term,
    maxResultCount: 20,
    languageCode: "en",
  };
  if (bias) {
    request.locationBias = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 20_000 },
    };
  }
  const body = await googleFetch(
    SEARCH_TEXT_URL,
    { method: "POST", body: JSON.stringify(request) },
    LIST_FIELD_MASK,
    fetchImpl,
  );
  return parseList(body);
}

export async function googlePlaceDetails(placeId: string, fetchImpl: typeof fetch = fetch): Promise<GooglePlace> {
  const body = await googleFetch(
    `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`,
    { method: "GET" },
    DETAIL_FIELD_MASK,
    fetchImpl,
  );
  const parsed = googlePlaceSchema.safeParse(body);
  if (!parsed.success) throw new ServiceError(503, "places_bad_response", "Place details returned something unexpected.");
  const place = normalize(parsed.data);
  if (!place) throw new ServiceError(400, "unsupported_place", "Nostos currently supports restaurants and bars.");
  return place;
}

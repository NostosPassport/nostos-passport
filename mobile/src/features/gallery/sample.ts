/** Made-up data for the Design gallery: no network, no account. Deterministic. */
import type { StampView } from "@/api/contracts";
import { pageAndSlot } from "@/lib/layout";
import { SAMPLE_PHOTOS } from "./sample-photos";

export const SAMPLE_USER = { displayName: "Ava Lee", handle: "avaa", memberSince: "2026-03-14T16:00:00.000Z", bio: "Out late, mostly." };

type SamplePlace = {
  name: string;
  area: string | null;
  city: string;
  region: string | null;
  country: string;
  countryCode: string;
  timeZone: string;
};

export const SAMPLE_PLACES: readonly SamplePlace[] = [
  { name: "Katz's Delicatessen", area: "Lower East Side", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Tompkins Square Park", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Veselka", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Roscioli", area: "Regola", city: "Rome", region: "Lazio", country: "Italy", countryCode: "IT", timeZone: "Europe/Rome" },
  { name: "Bar San Calisto", area: "Trastevere", city: "Rome", region: "Lazio", country: "Italy", countryCode: "IT", timeZone: "Europe/Rome" },
  { name: "All'Antico Vinaio", area: "Santa Croce", city: "Florence", region: "Tuscany", country: "Italy", countryCode: "IT", timeZone: "Europe/Rome" },
  { name: "The High Line", area: "Chelsea", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Chelsea Market", area: "Chelsea", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Printed Matter", area: "Chelsea", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Brooklyn Bridge Park", area: "Dumbo", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Grimaldi's Pizzeria", area: "Dumbo", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "The Metropolitan Museum of Art", area: "Upper East Side", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Central Park Boathouse", area: "Central Park", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Russ & Daughters", area: "Lower East Side", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Doughnut Plant", area: "Lower East Side", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Shibuya Crossing", area: "Shibuya", city: "Tokyo", region: "Tokyo", country: "Japan", countryCode: "JP", timeZone: "Asia/Tokyo" },
  { name: "Prospect Park", area: "Park Slope", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  { name: "Grand Central Terminal", area: "Midtown", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
];

export function sampleStamp(i: number, over: Partial<StampView> = {}): StampView {
  const sample = SAMPLE_PLACES[i % SAMPLE_PLACES.length]!;
  const { page, slot } = pageAndSlot(i);
  const at = new Date(Date.UTC(2026, 5, 1 + i, 2, 30)).toISOString();
  return {
    id: `sample-${i}`,
    photoUrl: null,
    photos: [],
    caption: "",
    song: null,
    page,
    slot,
    createdAt: at,
    visitedAt: at,
    verifiedAt: i % 3 === 0 ? at : null,
    verified: i % 3 === 0,
    editedAt: null,
    place: {
      id: `place-${i % SAMPLE_PLACES.length}`,
      slug: `place-${i}`,
      name: sample.name,
      area: sample.area,
      city: sample.city,
      region: sample.region,
      country: sample.country,
      countryCode: sample.countryCode,
      timeZone: sample.timeZone,
    },
    ...over,
  };
}

export const sampleStamps = (n: number): StampView[] => Array.from({ length: n }, (_, i) => sampleStamp(i));

export const SAMPLE_VISA_STAMP: StampView = sampleStamp(0, {
  caption: "Pastrami on rye at midnight. The man behind the counter remembered nothing and everything.",
  song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  photos: SAMPLE_PHOTOS.slice(0, 4).map((url, position) => ({ id: `sample-photo-${position}`, url, position, x: null, y: null, rotation: null })),
});

/** Made-up data for the Design gallery: no network, no account. Deterministic. */
import type { NeighborhoodIndexResponse, NeighborhoodProgress, StampView } from "@/api/contracts";
import { pageAndSlot } from "@/lib/layout";
import { SAMPLE_PHOTOS } from "./sample-photos";

export const SAMPLE_USER = { displayName: "Ava Lee", handle: "avaa", memberSince: "2026-03-14T16:00:00.000Z", bio: "Out late, mostly." };

export const SAMPLE_PLACES = [
  ["Katz's Delicatessen", "East Village", "n-ev"], ["Tompkins Square Park", "East Village", "n-ev"], ["Veselka", "East Village", "n-ev"],
  ["The Strand", "Greenwich Village", "n-gv"], ["Washington Square Park", "Greenwich Village", "n-gv"], ["Joe's Pizza", "Greenwich Village", "n-gv"],
  ["The High Line", "Chelsea", "n-ch"], ["Chelsea Market", "Chelsea", "n-ch"], ["Printed Matter", "Chelsea", "n-ch"],
  ["Brooklyn Bridge Park", "Dumbo", "n-du"], ["Grimaldi's Pizzeria", "Dumbo", "n-du"], ["The Metropolitan Museum of Art", "Upper East Side", "n-ues"],
  ["Central Park Boathouse", "Upper East Side", "n-ues"], ["Russ & Daughters", "Lower East Side", "n-les"], ["Doughnut Plant", "Lower East Side", "n-les"],
  ["Rockaway Beach", "Far Rockaway", "n-fr"], ["Prospect Park", "Park Slope", "n-ps"], ["Grand Central Terminal", "Midtown", "n-mt"],
] as const;

export function sampleStamp(i: number, over: Partial<StampView> = {}): StampView {
  const [name, hood, hoodId] = SAMPLE_PLACES[i % SAMPLE_PLACES.length]!;
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
    place: { id: `place-${i % SAMPLE_PLACES.length}`, slug: `place-${i}`, name, neighborhood: hood, neighborhoodId: hoodId },
    ...over,
  };
}

export const sampleStamps = (n: number): StampView[] => Array.from({ length: n }, (_, i) => sampleStamp(i));

export const SAMPLE_VISA_STAMP: StampView = sampleStamp(0, {
  caption: "Pastrami on rye at midnight. The man behind the counter remembered nothing and everything.",
  song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  photos: SAMPLE_PHOTOS.slice(0, 4).map((url, position) => ({ id: `sample-photo-${position}`, url, position, x: null, y: null, rotation: null })),
});

export const SAMPLE_PROGRESS: NeighborhoodProgress = { neighborhoodId: "n-ev", name: "East Village", borough: "Manhattan", visited: 3, total: 3, complete: true, justCompleted: true, newPlace: true };

export const SAMPLE_INDEX: NeighborhoodIndexResponse["neighborhoods"] = [
  { neighborhoodId: "n-ev", name: "East Village", borough: "Manhattan", visited: 3, total: 3, complete: true, completedAt: "2026-06-03T02:30:00.000Z", percent: 100 },
  { neighborhoodId: "n-gv", name: "Greenwich Village", borough: "Manhattan", visited: 2, total: 4, complete: false, completedAt: null, percent: 50 },
  { neighborhoodId: "n-ch", name: "Chelsea", borough: "Manhattan", visited: 1, total: 6, complete: false, completedAt: null, percent: 17 },
  { neighborhoodId: "n-du", name: "Dumbo", borough: "Brooklyn", visited: 0, total: 5, complete: false, completedAt: null, percent: 0 },
];

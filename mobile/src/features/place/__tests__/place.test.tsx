import { fireEvent, render, screen } from "@testing-library/react-native";

import type { StampView } from "@/api/contracts";
import PlacePage from "@/app/(app)/place/[id]";
import { dayLabel, stampLine, standing, visitSummary } from "../place-page";

const mockPush = jest.fn();
let mockQuery: Record<string, unknown>;
let mockHere: { lat: number; lng: number } | null = null;

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({ id: "p1" }) }));
jest.mock("@/auth/account-state", () => ({ useAccountState: () => ({ state: "ready", retry: jest.fn(), retrying: false }) }));
jest.mock("@/api/queries", () => ({ usePlacePage: () => mockQuery }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: {}, mediaUrl: (u: string) => u, errorText: client.errorText };
});
jest.mock("@/features/location/location-store", () => ({ useUserCoords: () => mockHere }));

const stamp = (id: string, visitedAt: string, caption = "", verified = false): StampView => ({
  id, photoUrl: null, photos: [], caption, song: null, page: 1, slot: 1,
  createdAt: "2026-10-08T20:00:00.000Z", visitedAt, verifiedAt: verified ? "2026-10-08T20:00:00.000Z" : null, verified, editedAt: null,
  place: { id: "p1", slug: "katz", name: "Katz's", neighborhood: "East Village", neighborhoodId: "n1" },
});
const place = { id: "p1", slug: "katz", name: "Katz's", address: "205 E Houston St", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, neighborhoodId: "n1", fromOsm: false };

describe("place page words", () => {
  it("writes a day as a passport date, and leaves anything else alone", () => {
    expect(dayLabel("2026-10-03")).toBe("03 OCT 2026");
    expect(dayLabel("2027-01-09")).toBe("09 JAN 2027");
    expect(dayLabel("2027-13-09")).toBe("2027-13-09");
    expect(dayLabel("today")).toBe("today");
  });
  it("sums up visits without nightlife language", () => {
    const a = stamp("a", "2026-10-04T03:41:00.000Z");
    expect(visitSummary([])).toBeNull();
    expect(visitSummary([{ day: "2026-10-03", stamps: [a] }])).toBe("1 stamp, 1 visit");
    expect(visitSummary([{ day: "2026-10-03", stamps: [a, a] }, { day: "2026-10-05", stamps: [a] }])).toBe("3 stamps over 2 visits");
  });
  it("describes current proximity as verification eligibility rather than a posting gate", () => {
    const f = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
    expect(standing({ inside: true, distanceM: 10 }, f)).toEqual({ text: "Visit can be verified", canVerify: true });
    expect(standing({ inside: false, distanceM: 1815 }, f)).toEqual({ text: "1.8 km away", canVerify: false });
    expect(standing({ inside: false, distanceM: null }, f)).toEqual({ text: null, canVerify: false });
    expect(standing({ inside: null, distanceM: null }, f)).toEqual({ text: null, canVerify: false });
  });
  it("gives each stamp a line using visit time, then caption, song or photo count", () => {
    expect(stampLine(stamp("a", "2026-10-04T03:41:00.000Z", "good pastrami"))).toBe("11:41 PM  ·  good pastrami");
    expect(stampLine({ ...stamp("a", "2026-10-04T03:41:00.000Z"), song: { title: "Heroes", artist: "Bowie", artUrl: null, sourceId: null } })).toBe("11:41 PM  ·  Heroes, Bowie");
    expect(stampLine({ ...stamp("a", "2026-10-04T03:41:00.000Z"), photos: [{ id: "x", url: "u", position: 0, x: null, y: null, rotation: null }] })).toBe("11:41 PM  ·  1 photo");
    expect(stampLine(stamp("a", "2026-10-04T03:41:00.000Z"))).toBe("11:41 PM");
  });
});

describe("PlacePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHere = { lat: 1, lng: 2 };
  });

  it("shows the place, verification eligibility, visits, and a Stamp button", async () => {
    const a = stamp("a", "2026-10-04T03:41:00.000Z", "good pastrami", true);
    mockQuery = { data: { place, stamps: [a], visits: [{ day: "2026-10-03", stamps: [a] }], inside: true, distanceM: 12 } };
    await render(<PlacePage />);
    expect(screen.getByText("Katz's")).toBeTruthy();
    expect(screen.getByText("East Village · 205 E Houston St")).toBeTruthy();
    expect(screen.getByText("Visit can be verified")).toBeTruthy();
    expect(screen.getByText("1 STAMP, 1 VISIT")).toBeTruthy();
    expect(screen.getByText("03 OCT 2026")).toBeTruthy();
    expect(screen.getByText("Nostos verified")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Stamp this place" }));
    expect(mockPush).toHaveBeenCalledWith("/stamp/new");
    await fireEvent.press(screen.getByRole("button", { name: /Stamp, 11:41 PM/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/stamp/[id]", params: { id: "a" } });
  });

  it("far away still offers stamping, with explicit unverified/Past copy", async () => {
    mockQuery = { data: { place, stamps: [], visits: [], inside: false, distanceM: 1815 } };
    await render(<PlacePage />);
    expect(screen.getByText("1.8 km away")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stamp this place" })).toBeTruthy();
    expect(screen.getByText(/unverified Now stamp or add a Past visit/)).toBeTruthy();
    expect(screen.getByText("You haven't stamped this place yet.")).toBeTruthy();
  });

  it("loading and failed both say something", async () => {
    mockQuery = { isPending: true };
    const a = await render(<PlacePage />);
    expect(screen.getByRole("progressbar", { name: "Loading this place" })).toBeTruthy();
    await a.unmount();
    mockQuery = { isError: true, error: new Error("x"), refetch: jest.fn() };
    await render(<PlacePage />);
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});

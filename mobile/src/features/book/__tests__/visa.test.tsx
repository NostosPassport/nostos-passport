import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";

import type { StampView } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import { pinChange } from "../pin-change";
import { VisaSpread } from "../VisaSpread";

const mockLayout = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { stamps: { layout: (...a: unknown[]) => mockLayout(...a) } }, mediaUrl: (u: string) => u, errorText: client.errorText };
});

const photos = [0, 1, 2].map((i) => ({ id: `ph${i}`, url: `https://x/${i}.jpg`, position: i, x: null, y: null, rotation: null }));
const stamp = (over: Partial<StampView> = {}): StampView => ({
  id: "s1", photoUrl: photos[0]!.url, photos, caption: "hello there", song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  page: 3, slot: 2,
  createdAt: "2026-10-08T15:00:00.000Z",
  visitedAt: "2026-10-04T03:41:00.000Z",
  verifiedAt: "2026-10-04T03:41:00.000Z",
  verified: true,
  editedAt: null,
  place: { id: "p1", slug: "velvet", name: "Velvet", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
  ...over,
});
const wrap = (s: StampView) => render(<QueryClientProvider client={testQueryClient()}><VisaSpread stamp={s} /></QueryClientProvider>);

describe("VisaSpread", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLayout.mockResolvedValue({ stamp: stamp() });
  });

  it("shows the visit date/time, place, page, memory content and verification state", async () => {
    await wrap(stamp());
    expect(screen.getByText("03 OCT 2026  ·  11:41 PM")).toBeTruthy();
    expect(screen.getByText("Velvet")).toBeTruthy();
    expect(screen.getByText("East Village  ·  page 3")).toBeTruthy();
    expect(screen.getByText("Nostos visit verified")).toBeTruthy();
    expect(screen.getByText("hello there")).toBeTruthy();
    expect(screen.getByText("David Bowie")).toBeTruthy();
    expect(screen.getByLabelText("Song: Heroes by David Bowie")).toBeTruthy();
    expect(screen.getByLabelText("Stamp, Velvet")).toBeTruthy();
  });

  it("shows subtle unverified copy for an unverified memory", async () => {
    await wrap(stamp({ verified: false, verifiedAt: null }));
    expect(screen.getByText("Visit not location verified")).toBeTruthy();
  });

  it("types the caption out: the whole caption is always there for a screen reader", async () => {
    jest.useFakeTimers();
    try {
      await wrap(stamp());
      expect(screen.getByText("hello there")).toBeTruthy();
      expect(screen.queryByText("hel", { includeHiddenElements: true })).toBeNull();
      await act(async () => jest.advanceTimersByTime(160));
      expect(screen.getByText("hello", { includeHiddenElements: true })).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(2000));
      expect(screen.getAllByText("hello there")).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows no scrapbook photos and says so when there are none, and no caption line when there is none", async () => {
    await wrap(stamp({ photos: [], photoUrl: null, caption: "", song: null }));
    expect(screen.getByText("no photos on this page")).toBeTruthy();
    expect(screen.queryByLabelText(/^Photo \d/)).toBeNull();
    expect(screen.queryByText("SOUNDTRACK")).toBeNull();
  });

  it("lists each photo and opens one full screen, with a way to step through them and to go back", async () => {
    await wrap(stamp());
    expect(screen.getAllByLabelText(/^Photo \d of 3$/)).toHaveLength(3);
    await fireEvent(screen.getByLabelText("Photo 2 of 3"), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Photo. Pinch to zoom, double tap to zoom in or out.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Next photo"));
    expect(screen.getByText("3 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Next photo").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.queryByText("3 of 3")).toBeNull();
  });

  it("saves the layout when the owner drops a photo: the dragged one on top, where it was left", async () => {
    await wrap(stamp());
    await act(async () => {
      await fireGestureHandler(getByGestureTestId("photo-pan-ph0"), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 10, translationY: 10 },
        { state: State.END, translationX: 10, translationY: 10 },
      ]);
    });
    await waitFor(() => expect(mockLayout).toHaveBeenCalledTimes(1));
    const [id, body] = mockLayout.mock.calls[0]!;
    expect(id).toBe("s1");
    expect(body.photos.map((p: { id: string }) => p.id)).toEqual(["ph1", "ph2", "ph0"]);
    expect(body.photos.map((p: { position: number }) => p.position)).toEqual([0, 1, 2]);
    for (const p of body.photos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("pinning", () => {
  it("pins at the end, unpins in place, and refuses a fifth", () => {
    expect(pinChange(["a"], "b")).toEqual({ kind: "pin", ids: ["a", "b"] });
    expect(pinChange(["a", "b", "c"], "b")).toEqual({ kind: "unpin", ids: ["a", "c"] });
    expect(pinChange(["a", "b", "c", "d"], "e")).toEqual({ kind: "full" });
    expect(pinChange(["a", "b", "c", "d"], "d")).toEqual({ kind: "unpin", ids: ["a", "b", "c"] });
    expect(pinChange([], "a")).toEqual({ kind: "pin", ids: ["a"] });
  });
});

/** Your passport as a book: the states, and opening it. */
import * as Reanimated from "react-native-reanimated";
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { StampView } from "@/api/contracts";
import { PassportBook } from "../PassportBook";
import type { PassportData } from "../use-passport";

const mockPush = jest.fn();
let mockData: PassportData;
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("../use-passport", () => ({ usePassport: () => mockData }));
jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u }));

const stamp = (id: string, page: number, slot: number, name: string): StampView => ({
  id, photoUrl: null, photos: [], caption: "", song: null, page, slot, createdAt: "2026-10-03T00:00:00.000Z", editedAt: null,
  place: { id: `p-${id}`, slug: id, name, neighborhood: "East Village", neighborhoodId: null },
  author: { handle: "ava", displayName: "Ava", avatarUrl: null, verified: false }, mine: true, likes: { count: 0, viewerLiked: false }, hidden: false, removed: false,
});
const ready = (over: Partial<PassportData> = {}): PassportData => ({
  status: "ready", handle: "ava", displayName: "Ava Lee", avatarUrl: null, bio: "", memberSince: "2026-10-03T04:00:00.000Z", stamps: [], pins: [],
  counts: { stamps: 0, places: 0, neighborhoods: 0 }, neighborhoods: [], retry: jest.fn(), ...over,
});

describe("PassportBook", () => {
  beforeEach(() => mockPush.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it("while loading, says it is opening, and shows no book", async () => {
    mockData = ready({ status: "pending" });
    await render(<PassportBook />);
    expect(screen.getByRole("progressbar", { name: "Opening your passport" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open your passport/ })).toBeNull();
  });
  it("on a failed load, offers Try again and no book", async () => {
    mockData = ready({ status: "error" });
    await render(<PassportBook />);
    expect(screen.getByText(/Couldn't open your passport/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
  it("starts closed: the cover is one button and the three counts sit under it", async () => {
    mockData = ready({ counts: { stamps: 7, places: 5, neighborhoods: 2 } });
    await render(<PassportBook />);
    expect(screen.getByRole("button", { name: /Open your passport, Ava Lee\. 7 stamps, 5 places, 2 neighborhoods\./ })).toBeTruthy();
    expect(screen.getByLabelText("7 stamps, 5 places, 2 neighborhoods")).toBeTruthy();
  });
  it("opens to the bearer page, with a close button and a next button, and says the first page is empty when it is", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    expect(screen.getByText("NOSTOS PASSPORT")).toBeTruthy();
    expect(screen.getByLabelText("Close the passport")).toBeTruthy();
    expect(screen.getByText("Bearer page")).toBeTruthy();
    expect(screen.getByText("Your first page is empty. Go to a place and stamp it.")).toBeTruthy();
  });
  it("turns to the stamp pages with the next button, and a stamp opens its page", async () => {
    mockData = ready({ stamps: [stamp("s1", 1, 1, "Katz's"), stamp("s2", 1, 2, "Cafe")], counts: { stamps: 2, places: 2, neighborhoods: 1 } });
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    await fireEvent.press(screen.getByLabelText("Next page"));
    expect(screen.getByText("Pages 1 and 2")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Stamp, Katz's, page 1, slot 1" })[0]!);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/stamp/[id]", params: { id: "s1" } });
  });

  it.each([false, true])("four stamps: page 2 appears on the final spread and opens its stamp with Reduce Motion=%s", async (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    mockData = ready({
      stamps: [stamp("s1", 1, 1, "First"), stamp("s2", 1, 2, "Second"), stamp("s3", 1, 3, "Third"), stamp("s4", 2, 1, "Fourth")],
      counts: { stamps: 4, places: 4, neighborhoods: 1 },
    });
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    expect(screen.getByLabelText("Nostos. The longing to return home.")).toBeVisible();
    expect(screen.getByText("NOSTOS PASSPORT")).toBeVisible();
    await fireEvent.press(screen.getByLabelText("Next page"));
    expect(screen.getByLabelText("Next page").props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText("Page 1")).toBeVisible();
    expect(screen.getByLabelText("Page 2")).toBeVisible();
    const fourth = screen.getByRole("button", { name: "Stamp, Fourth, page 2, slot 1" });
    expect(fourth).toBeVisible();
    await fireEvent.press(fourth);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/stamp/[id]", params: { id: "s4" } });
  });
  it("closes the book from the first spread", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    await fireEvent.press(screen.getByLabelText("Close the passport"));
    expect(screen.getByRole("button", { name: /Open your passport/ })).toBeTruthy();
  });
  it("disables Next on the last spread", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    await fireEvent.press(screen.getByLabelText("Next page"));
    expect(screen.getByLabelText("Next page").props.accessibilityState?.disabled).toBe(true);
  });
});

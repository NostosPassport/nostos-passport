import { fireEvent, render, screen } from "@testing-library/react-native";

import type { NeighborhoodIndexResponse, StampView } from "@/api/contracts";
import { firstPageByNeighborhood, indexRows, ringGeometry, spreadForPage } from "../index-data";
import { IndexList } from "../IndexList";
import { PassportBook } from "../PassportBook";
import type { PassportData } from "../use-passport";

let mockData: PassportData;
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../use-passport", () => ({ usePassport: () => mockData }));
jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u }));

const stamp = (id: string, page: number | null, hood: string | null): StampView => ({
  id, photoUrl: null, photos: [], caption: "", song: null, page, slot: page === null ? null : 1, createdAt: "2026-10-03T00:00:00.000Z", editedAt: null,
  place: { id: `p-${id}`, slug: id, name: `Place ${id}`, neighborhood: "Somewhere", neighborhoodId: hood },
  author: { handle: "ava", displayName: "Ava", avatarUrl: null, verified: false }, mine: true, likes: { count: 0, viewerLiked: false }, hidden: false, removed: false,
});
const hood = (id: string, name: string, visited: number, total: number, complete = false): NeighborhoodIndexResponse["neighborhoods"][number] => ({
  neighborhoodId: id, name, borough: "Manhattan", visited, total, complete, completedAt: complete ? "2026-10-03T00:00:00.000Z" : null, percent: Math.round((visited / total) * 100),
});

describe("index data", () => {
  it("finds the earliest page of each neighborhood and ignores hidden stamps and places with no neighborhood", () => {
    const m = firstPageByNeighborhood([stamp("a", 5, "n1"), stamp("b", 2, "n1"), stamp("c", 4, "n2"), stamp("d", null, "n3"), stamp("e", 1, null)]);
    expect(m.get("n1")).toBe(2);
    expect(m.get("n2")).toBe(4);
    expect(m.has("n3")).toBe(false);
    expect(m.size).toBe(2);
  });
  it("builds rows with a spoken label, the page to jump to, and none for a neighborhood not started", () => {
    const rows = indexRows([hood("n1", "East Village", 4, 12), hood("n2", "Chelsea", 0, 9), hood("n3", "Soho", 3, 3, true)], [stamp("a", 2, "n1"), stamp("b", 6, "n3")]);
    expect(rows[0]).toMatchObject({ page: 2, label: "East Village, Manhattan. 4 of 12 places. First stamp on page 2." });
    expect(rows[1]).toMatchObject({ page: null, label: "Chelsea, Manhattan. 0 of 9 places. Not started." });
    expect(rows[2]!.label).toBe("Soho, Manhattan. Complete. 3 of 3 places. First stamp on page 6.");
  });
  it("turns to the spread a page is on", () => {
    expect([1, 2, 3, 4, 9].map(spreadForPage)).toEqual([1, 1, 2, 2, 5]);
  });
  it("draws a ring as a share of the circumference, never more than all of it", () => {
    const full = ringGeometry(12, 12, 10);
    expect(full.filled).toBeCloseTo(full.circumference);
    expect(ringGeometry(3, 12, 10).fraction).toBe(0.25);
    expect(ringGeometry(30, 12, 10).fraction).toBe(1);
    expect(ringGeometry(0, 0, 10).fraction).toBe(0);
    expect(ringGeometry(-2, 12, 10).fraction).toBe(0);
  });
});

describe("IndexList", () => {
  it("lists neighborhoods with their progress, marks a finished one, and jumps to the page of a started one", async () => {
    const onJump = jest.fn();
    const rows = indexRows([hood("n1", "East Village", 4, 12), hood("n2", "Chelsea", 0, 9), hood("n3", "Soho", 3, 3, true)], [stamp("a", 2, "n1"), stamp("b", 6, "n3")]);
    await render(<IndexList rows={rows} onJump={onJump} onClose={jest.fn()} />);
    expect(screen.getByText("4/12")).toBeTruthy();
    expect(screen.getByText("COMPLETE")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: /^East Village/ }));
    expect(onJump).toHaveBeenCalledWith(2);
    await fireEvent.press(screen.getByRole("button", { name: /^Chelsea/ }));
    expect(onJump).toHaveBeenCalledTimes(1); // not started: nowhere to turn to
    expect(screen.getByRole("button", { name: /^Chelsea/ }).props.accessibilityState?.disabled).toBe(true);
  });
  it("says what the index is for when there is nothing in it, and closes", async () => {
    const onClose = jest.fn();
    await render(<IndexList rows={[]} onJump={jest.fn()} onClose={onClose} />);
    expect(screen.getByText(/No neighborhoods yet/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close the index"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the index in the book", () => {
  it("opens from the book, jumps to a neighborhood's first page, and the book is on that spread", async () => {
    const stamps = Array.from({ length: 10 }, (_, i) => stamp(`s${i}`, Math.floor(i / 3) + 1, i >= 6 ? "n1" : "n2")); // n1 first appears on page 3
    mockData = {
      status: "ready", handle: "ava", displayName: "Ava Lee", avatarUrl: null, bio: "", memberSince: "2026-10-03T04:00:00.000Z", stamps, pins: [],
      counts: { stamps: 10, places: 10, neighborhoods: 2 }, neighborhoods: [hood("n1", "East Village", 4, 12), hood("n2", "Chelsea", 6, 9)], retry: jest.fn(),
    };
    await render(<PassportBook />);
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    await fireEvent.press(screen.getByLabelText("Index"));
    expect(screen.getByText("Index")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: /^East Village/ }));
    expect(screen.getByText("Pages 3 and 4")).toBeTruthy();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";
import { Dimensions } from "react-native";
import type { StampView } from "@/api/contracts";
import { PassportBook } from "../PassportBook";
import type { PassportData } from "../use-passport";

let mockReduced = false;
jest.mock("react-native-reanimated", () => ({ ...jest.requireActual("react-native-reanimated/mock"), useSharedValue: (value: unknown) => jest.requireActual("react").useState(() => ({ value }))[0], useReducedMotion: () => mockReduced }));
const mockPush = jest.fn();
let mockFocus: () => void;
let mockData: PassportData;
let mockView: { open: boolean; onTap: () => void; onReady: (i: unknown) => void; onError: (m: string) => void; onOpenProgress: (p: number) => void; onOpenSettled: (o: boolean) => void };
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, useFocusEffect: (cb: () => void) => { mockFocus = cb; } }));
jest.mock("../use-passport", () => ({ usePassport: () => mockData }));
jest.mock("../../lab3d/Passport3DView", () => {
  const { Pressable } = jest.requireActual("react-native");
  return { Passport3DView: (props: typeof mockView) => { mockView = props; return <Pressable accessibilityRole="button" accessibilityLabel="Open your passport" onPress={props.onTap} />; } };
});
jest.mock("../first-run", () => ({ useFirstRun: () => ({ show: false, dismiss: jest.fn() }) }));

const stamp = (id: string, page: number, slot: number, name: string): StampView => ({
  id, photoUrl: null, photos: [], caption: "", song: null, page, slot,
  createdAt: "2026-10-08T20:00:00.000Z", visitedAt: "2026-10-03T00:00:00.000Z", verifiedAt: null, verified: false, editedAt: null,
  place: { id: `p-${id}`, slug: id, name, area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
});
const ready = (over: Partial<PassportData> = {}): PassportData => ({
  status: "ready", handle: "ava", displayName: "Ava Lee", avatarUrl: null, bio: "", memberSince: "2026-10-03T04:00:00.000Z", stamps: [],
  counts: { stamps: 7, places: 5 }, retry: jest.fn(), ...over,
});
const COUNTS = "7 stamps, 5 places";
const tapPage = async (x: number) => { await act(() => fireGestureHandler(getByGestureTestId("single-flip-tap"), [{ state: State.BEGAN, x, y: 15 }, { state: State.ACTIVE, x, y: 15 }, { state: State.END, x, y: 15 }])); };

describe("tapping the 3D passport: the cover opens, then the reader takes over", () => {
  beforeEach(() => { mockPush.mockClear(); mockReduced = false; Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } }); });

  it("with a live model: a tap starts the 3D opening and the reader waits until the cover is nearly flat", async () => {
    mockData = ready();
    await render(<PassportBook />);
    expect(mockView.open).toBe(false);
    await act(() => mockView.onReady({}));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    expect(mockView.open).toBe(true);
    expect(screen.queryByLabelText("Close passport")).toBeNull();
    await act(() => mockView.onOpenProgress(0.5));
    expect(screen.queryByLabelText("Close passport")).toBeNull();
    await act(() => mockView.onOpenProgress(0.9));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
    expect(screen.getByText("NOSTOS PASSPORT")).toBeVisible();
  });

  it("the reader still appears if only the final settled signal arrives", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await act(() => mockView.onReady({}));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    await act(() => mockView.onOpenSettled(true));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
  });

  it("Close brings the cover back: the 3D passport is told to close and the home counts return", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await act(() => mockView.onReady({}));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    await act(() => mockView.onOpenProgress(0.95));
    await fireEvent.press(screen.getByLabelText("Close passport"));
    expect(mockView.open).toBe(false);
    expect(screen.queryByLabelText("Close passport")).toBeNull();
    expect(screen.getByLabelText(COUNTS)).toBeVisible();
    await act(() => mockView.onOpenSettled(false));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    expect(mockView.open).toBe(true);
    await act(() => mockView.onOpenProgress(0.9));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
  });

  it("without a live model a tap goes straight to the pages", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
    expect(mockView.open).toBe(false);
  });

  it("a model that errors after loading falls back to the instant reader", async () => {
    mockData = ready();
    await render(<PassportBook />);
    await act(() => mockView.onReady({}));
    await act(() => mockView.onError("gpu"));
    await fireEvent.press(screen.getByLabelText("Open stamp pages"));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
  });

  it("Reduce Motion: the model reports one jump to open and the reader is there at once", async () => {
    mockReduced = true;
    mockData = ready();
    await render(<PassportBook />);
    await act(() => mockView.onReady({}));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    await act(() => mockView.onOpenProgress(1));
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
  });

  it("opening a stamp keeps the 3D passport open behind it, and coming back restores the reader on the same page", async () => {
    mockData = ready({ stamps: [stamp("s1", 1, 1, "First"), stamp("s2", 1, 2, "Second"), stamp("s3", 1, 3, "Third"), stamp("s4", 2, 1, "Fourth")], counts: { stamps: 4, places: 4 } });
    await render(<PassportBook />);
    await act(() => mockView.onReady({}));
    await fireEvent.press(screen.getByLabelText("Open your passport"));
    await act(() => mockView.onOpenProgress(0.9));
    await tapPage(300);
    await tapPage(300);
    await fireEvent.press(screen.getByRole("button", { name: "Stamp, Fourth, page 2, slot 1" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/stamp/[id]", params: { id: "s4" } });
    expect(mockView.open).toBe(true);
    await act(() => mockFocus());
    expect(screen.getByLabelText("Passport pages").props.accessibilityValue.now).toBe(3);
    expect(screen.getByLabelText("Close passport")).toBeTruthy();
  });
});

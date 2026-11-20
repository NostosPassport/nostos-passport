/** Core stamp detail and song-picker screen states. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { router } from "expo-router";
import { ActionSheetIOS, Alert } from "react-native";

import { api } from "@/api";

import { songDraft } from "@/features/stamps/song-draft";
import { ApiError } from "@/api/client";
import type { StampView } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import StampDetail from "@/app/(app)/stamp/[id]";
import SongPicker from "@/app/(app)/stamp/song";

type Query = { data?: unknown; isPending?: boolean; isError?: boolean; isFetching?: boolean; error?: unknown; refetch?: () => void; [k: string]: unknown };
let mockStamp: Query;
let mockSongs: Query;
let mockLocalId = "s1";
let mockSongQueries: string[] = [];

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockLocalId }),
  useFocusEffect: jest.fn(),
}));
jest.mock("@/api/queries", () => ({
  useStamp: () => mockStamp,
  useSongSearch: (query: string) => { mockSongQueries.push(query); return mockSongs; },
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { stamps: { remove: jest.fn() } }, mediaUrl: (u: string) => u, ApiError: client.ApiError, errorText: client.errorText };
});

const stamp: StampView = {
  id: "s1",
  photoUrl: null,
  photos: [],
  page: 1,
  slot: 1,
  caption: "hello there",
  song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  createdAt: "2026-10-08T20:00:00.000Z",
  visitedAt: "2026-09-24T02:00:00.000Z",
  verifiedAt: "2026-09-24T02:00:00.000Z",
  verified: true,
  editedAt: null,
  place: { id: "p1", slug: "velvet", name: "Velvet", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
};
const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const quiet = () => jest.spyOn(console, "error").mockImplementation(() => undefined);

describe("Stamp detail", () => {
  beforeEach(() => {
    mockLocalId = "s1";
    jest.clearAllMocks();
  });

  it("loading, gone, failed and loaded all show something", async () => {
    mockStamp = { isPending: true };
    const first = await wrap(<StampDetail />);
    expect(first.toJSON()).not.toBeNull();
    await first.unmount();

    mockStamp = { isError: true, error: new ApiError(404, "not_found", "Stamp not found"), refetch: jest.fn() };
    const gone = await wrap(<StampDetail />);
    expect(screen.getByText("This memory isn't available")).toBeTruthy();
    await gone.unmount();

    mockStamp = { isError: true, error: new ApiError(0, "timeout", "Nostos isn't responding."), refetch: jest.fn() };
    const failed = await wrap(<StampDetail />);
    expect(screen.getByText("Nostos isn't responding.")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    await failed.unmount();

    mockStamp = { data: { stamp } };
    await wrap(<StampDetail />);
    expect(screen.getByText("Velvet")).toBeTruthy();
    expect(screen.getByText("hello there")).toBeTruthy();
    expect(screen.getByText("David Bowie")).toBeTruthy();
    expect(screen.getByText("EAST VILLAGE")).toBeTruthy();
    expect(screen.getByText("LOCATION VERIFIED BY NOSTOS")).toBeTruthy();
  });

  it("keeps a way back while loading, gone or failed", async () => {
    for (const q of [
      { isPending: true },
      { isError: true, error: new ApiError(404, "not_found", "Stamp not found"), refetch: jest.fn() },
      { isError: true, error: new ApiError(0, "timeout", "Nostos isn't responding."), refetch: jest.fn() },
    ]) {
      mockStamp = q;
      const r = await wrap(<StampDetail />);
      await fireEvent.press(screen.getByRole("button", { name: "Back" }));
      await r.unmount();
    }
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
    expect(router.back).toHaveBeenCalled();
  });

  it("labels photo pages and leaves out an unknown memory number", async () => {
    const photo = (id: string, position: number) => ({ id, url: `u-${id}`, position, x: null, y: null, rotation: null });
    mockStamp = { data: { stamp: { ...stamp, page: null, slot: null, photos: [photo("a", 0), photo("b", 1)] } } };
    await wrap(<StampDetail />);
    expect(screen.getByLabelText("Photo 1 of 2")).toBeTruthy();
    expect(screen.getByLabelText("Photo 2 of 2")).toBeTruthy();
    expect(screen.queryByText(/NO\. 001/)).toBeNull();
    expect(screen.getByRole("button", { name: "More options" })).toBeTruthy();
  });

  it("delete says passport, and shows progress while it runs", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(1));
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    (api.stamps.remove as jest.Mock).mockReturnValue(new Promise(() => undefined));
    mockStamp = { data: { stamp } };
    await wrap(<StampDetail />);
    await fireEvent.press(screen.getByRole("button", { name: "More options" }));
    expect(sheet.mock.calls[0]?.[0].options).toEqual(["Edit memory", "Delete from passport", "Cancel"]);
    expect(alert.mock.calls[0]?.[0]).toBe("Delete from your passport?");
    expect(await screen.findByRole("progressbar", { name: "Deleting this memory" })).toBeTruthy();
    expect(api.stamps.remove).toHaveBeenCalledTimes(1);
    sheet.mockRestore();
    alert.mockRestore();
  });

  it("shows unverified only as fine-print metadata", async () => {
    mockStamp = { data: { stamp: { ...stamp, verified: false, verifiedAt: null } } };
    await wrap(<StampDetail />);
    expect(screen.queryByText("LOCATION VERIFIED BY NOSTOS")).toBeNull();
    expect(screen.getByText("VISIT NOT LOCATION VERIFIED")).toBeTruthy();
  });

  it("unavailable owner data does not leak memory content", async () => {
    mockStamp = { isError: true, error: new ApiError(404, "not_found", "Stamp not found"), refetch: jest.fn() };
    await wrap(<StampDetail />);
    expect(screen.getByText("This memory isn't available")).toBeTruthy();
    expect(screen.queryByText(/Velvet|hello there/)).toBeNull();
  });
});

describe("Song picker", () => {
  beforeEach(() => {
    quiet();
    jest.useFakeTimers();
    mockSongQueries = [];
    songDraft.clear();
    jest.clearAllMocks();
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  const searchFor = async (text: string) => {
    await fireEvent.changeText(screen.getByLabelText("Song or artist"), text);
    await act(async () => jest.advanceTimersByTime(350));
  };

  it("starts with an in-content search field, and Cancel leaves without picking anything", async () => {
    mockSongs = { isPending: true, fetchStatus: "idle" };
    const a = await wrap(<SongPicker />);
    expect(screen.getByText("SONG OR ARTIST")).toBeTruthy();
    expect(screen.getByLabelText("Song or artist")).toBeTruthy();
    expect(screen.queryByText("No song")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(songDraft.take()).toBeUndefined();
    expect(router.back).toHaveBeenCalledTimes(1);
    await a.unmount();
  });

  it("keeps the first pick when two rows are tapped quickly", async () => {
    mockSongs = { data: { songs: [
      { title: "Heroes", artist: "David Bowie", album: null, artUrl: null, sourceId: "1" },
      { title: "Changes", artist: "David Bowie", album: null, artUrl: null, sourceId: "2" },
    ] } };
    await wrap(<SongPicker />);
    await searchFor("Bowie");
    await fireEvent.press(screen.getByLabelText("Heroes by David Bowie"));
    await fireEvent.press(screen.getByLabelText("Changes by David Bowie"));
    expect(songDraft.take()?.song?.title).toBe("Heroes");
  });

  it("debounces typing and shows a searching state without results or an empty message", async () => {
    mockSongs = { isPending: true, fetchStatus: "fetching" };
    await wrap(<SongPicker />);
    await fireEvent.changeText(screen.getByLabelText("Song or artist"), "  Heroes  ");
    await act(async () => jest.advanceTimersByTime(349));
    expect(screen.getByText("Start typing to search Apple Music.")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockSongQueries.at(-1)).toBe("Heroes");
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByText(/Nothing found/)).toBeNull();
  });

  it("shows search results and hands the selected metadata back to the composer", async () => {
    const song = { title: "Heroes", artist: "David Bowie", album: "Heroes", artUrl: null, sourceId: "1" };
    mockSongs = { data: { songs: [song] } };
    await wrap(<SongPicker />);
    await searchFor("Heroes");
    expect(screen.getByText("Song info from Apple Music. Nostos doesn't play music.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Heroes by David Bowie"));
    expect(songDraft.take()).toEqual({ song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" } });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("shows the searched text when there are no results", async () => {
    mockSongs = { data: { songs: [] }, isPending: false };
    await wrap(<SongPicker />);
    await searchFor("zz");
    expect(screen.getByText("Nothing found for “zz”.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("shows upstream failure, retries the search and displays recovered results", async () => {
    const refetch = jest.fn();
    mockSongs = { isError: true, error: new ApiError(503, "song_search_unavailable", "Song search is unavailable."), refetch };
    const view = await wrap(<SongPicker />);
    await searchFor("Heroes");
    expect(screen.getByText("Couldn't search for songs right now.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalledTimes(1);
    mockSongs = { data: { songs: [{ title: "Heroes", artist: "David Bowie", album: null, artUrl: null, sourceId: "1" }] } };
    await view.rerender(<QueryClientProvider client={testQueryClient()}><SongPicker /></QueryClientProvider>);
    expect(screen.getByLabelText("Heroes by David Bowie")).toBeTruthy();
    expect(screen.queryByText("Couldn't search for songs right now.")).toBeNull();
  });
});

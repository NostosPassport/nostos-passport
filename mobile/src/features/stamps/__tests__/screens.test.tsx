/** Core stamp detail and song-picker screen states. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { router } from "expo-router";

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
  qk: jest.requireActual("@/api/keys").qk,
  useStamp: () => mockStamp,
  usePins: () => ({ data: { stamps: [] } }),
  useSongSearch: (query: string) => { mockSongQueries.push(query); return mockSongs; },
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { pins: { set: jest.fn() }, stamps: { remove: jest.fn() } }, mediaUrl: (u: string) => u, ApiError: client.ApiError, errorText: client.errorText };
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
    expect(screen.getByText("VISIT VERIFIED")).toBeTruthy();
    expect(screen.getByText(/confirmed this device was near the venue/)).toBeTruthy();
  });

  it("shows unverified only as fine-print metadata", async () => {
    mockStamp = { data: { stamp: { ...stamp, verified: false, verifiedAt: null } } };
    await wrap(<StampDetail />);
    expect(screen.queryByText("VISIT VERIFIED")).toBeNull();
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

  it("starts with an in-content search field and can clear the selected song", async () => {
    mockSongs = { isPending: true, fetchStatus: "idle" };
    const a = await wrap(<SongPicker />);
    expect(screen.getByText("SONG OR ARTIST")).toBeTruthy();
    expect(screen.getByLabelText("Song or artist")).toBeTruthy();
    expect(screen.getByText("No song")).toBeTruthy();
    await fireEvent.press(screen.getByText("No song"));
    expect(songDraft.take()).toEqual({ song: null });
    expect(router.back).toHaveBeenCalledTimes(1);
    await a.unmount();
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

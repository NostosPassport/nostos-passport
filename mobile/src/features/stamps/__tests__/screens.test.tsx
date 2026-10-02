/**
 * No screen renders blank: every state of the feed, a stamp, the song picker and the composer shows something a
 * person can read or act on (a skeleton, a message, an error with Try again), never an empty view.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { router } from "expo-router";

import { songDraft } from "@/features/stamps/song-draft";
import { ApiError } from "@/api/client";
import type { StampView } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import Home from "@/app/(app)/(tabs)/index";
import StampDetail from "@/app/(app)/stamp/[id]";
import SongPicker from "@/app/(app)/stamp/song";

type Query = { data?: unknown; isPending?: boolean; isError?: boolean; isFetching?: boolean; error?: unknown; refetch?: () => void; [k: string]: unknown };
let mockAuth = "signedIn";
let mockFeed: Query;
let mockStamp: Query;
let mockSongs: Query;
let mockLocalId = "s1";
let mockSearchChange: ((event: { nativeEvent: { text: string } }) => void) | undefined;
let mockSongQueries: string[] = [];

jest.mock("@shopify/flash-list", () => ({ FlashList: jest.requireActual("react-native").FlatList }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: ({ options }: { options?: { headerSearchBarOptions?: { onChangeText?: typeof mockSearchChange } } }) => {
    mockSearchChange = options?.headerSearchBarOptions?.onChangeText;
    return null;
  } },
  useLocalSearchParams: () => ({ id: mockLocalId }),
  useFocusEffect: jest.fn(),
}));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: mockAuth }) }));
jest.mock("@/auth/account-state", () => ({ useAccountState: () => ({ state: mockAuth === "signedIn" ? "ready" : "guest", retry: jest.fn(), retrying: false }) }));
jest.mock("@/api/queries", () => ({
  qk: jest.requireActual("@/api/keys").qk,
  useFeed: () => mockFeed,
  useStamp: () => mockStamp,
  usePins: () => ({ data: { stamps: [] } }),
  useSongSearch: (query: string) => { mockSongQueries.push(query); return mockSongs; },
  useMe: () => ({ data: { user: { handle: "me" } } }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: {}, mediaUrl: (u: string) => u, ApiError: client.ApiError, errorText: client.errorText };
});
jest.mock("@/features/moderation/content-actions", () => ({
  ...jest.requireActual("@/features/moderation/content-actions"),
  useStampActions: () => () => [],
}));
jest.mock("@/features/moderation/flagged-store", () => ({ useFlaggedIds: () => new Set<string>() }));

const stamp: StampView = {
  id: "s1", photoUrl: null, photos: [], page: 1, slot: 1, caption: "hello there", song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  createdAt: "2026-09-24T02:00:00.000Z", editedAt: null, place: { id: "p1", slug: "velvet", name: "Velvet", neighborhood: "East Village", neighborhoodId: null },
  author: { handle: "sam", displayName: "Sam", avatarUrl: null, verified: false }, mine: false, likes: { count: 2, viewerLiked: false }, hidden: false, removed: false,
};
const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const quiet = () => jest.spyOn(console, "error").mockImplementation(() => undefined);

describe("Home feed", () => {
  beforeEach(() => (mockAuth = "signedIn"));

  it("loading: a skeleton, not nothing", async () => {
    mockFeed = { isPending: true };
    await wrap(<Home />);
    expect(screen.toJSON()).not.toBeNull();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });

  it("empty: says what the feed is and how to fill it", async () => {
    mockFeed = { isPending: false, data: { pages: [{ stamps: [], nextBefore: null }] }, hasNextPage: false };
    await wrap(<Home />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    expect(screen.getByText("Find people")).toBeTruthy();
  });

  it("failed: the server's reason and Try again", async () => {
    mockFeed = { isPending: false, isError: true, error: new ApiError(0, "offline", "You're offline."), refetch: jest.fn() };
    await wrap(<Home />);
    expect(screen.getByText("You're offline.")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("with stamps: shows who, where, the caption and the song", async () => {
    mockFeed = { isPending: false, data: { pages: [{ stamps: [stamp], nextBefore: null }] }, hasNextPage: false };
    await wrap(<Home />);
    expect(screen.getByText("hello there")).toBeTruthy();
    expect(screen.getByText("Heroes")).toBeTruthy();
    expect(screen.getByText(/Velvet/)).toBeTruthy();
    expect(screen.getByLabelText("Like, 2 likes")).toBeTruthy();
  });

  it("guest: a way in, never a blank feed", async () => {
    mockAuth = "guest";
    mockFeed = { isPending: true };
    await wrap(<Home />);
    expect(screen.getByText("A passport for New York")).toBeTruthy();
    expect(screen.getByText("Find people")).toBeTruthy();
  });
});

describe("Stamp detail", () => {
  beforeEach(() => {
    mockAuth = "signedIn";
    mockLocalId = "s1";
  });

  it("loading, gone, failed and loaded all show something", async () => {
    mockStamp = { isPending: true };
    const first = await wrap(<StampDetail />);
    expect(first.toJSON()).not.toBeNull();
    await first.unmount();

    mockStamp = { isError: true, error: new ApiError(404, "not_found", "Stamp not found"), refetch: jest.fn() };
    const gone = await wrap(<StampDetail />);
    expect(screen.getByText("This stamp isn't available")).toBeTruthy();
    await gone.unmount();

    mockStamp = { isError: true, error: new ApiError(0, "timeout", "Nostos isn't responding."), refetch: jest.fn() };
    const failed = await wrap(<StampDetail />);
    expect(screen.getByText("Nostos isn't responding.")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    await failed.unmount();

    mockStamp = { data: { stamp } };
    await wrap(<StampDetail />);
    expect(screen.getByText("hello there")).toBeTruthy();
    expect(screen.getByText("David Bowie")).toBeTruthy();
    expect(screen.getByText(/@sam · at Velvet/)).toBeTruthy();
  });

  it("a private account's stamp (404 to you) reads as unavailable, with no author, place or caption leaked", async () => {
    mockStamp = { isError: true, error: new ApiError(404, "not_found", "Stamp not found"), refetch: jest.fn() };
    await wrap(<StampDetail />);
    expect(screen.queryByText(/Sam|sam|Velvet|hello there/)).toBeNull();
    expect(screen.queryByText("Anonymous")).toBeNull();
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
    expect(mockSearchChange).toBeDefined();
    await act(async () => mockSearchChange!({ nativeEvent: { text } }));
    await act(async () => jest.advanceTimersByTime(350));
  };

  it("starts with a typing prompt and can clear the selected song", async () => {
    mockSongs = { isPending: true, fetchStatus: "idle" };
    const a = await wrap(<SongPicker />);
    expect(screen.getByText("Type a song or an artist.")).toBeTruthy();
    expect(screen.getByText("No song")).toBeTruthy();
    await fireEvent.press(screen.getByText("No song"));
    expect(songDraft.take()).toEqual({ song: null });
    expect(router.back).toHaveBeenCalledTimes(1);
    await a.unmount();
  });
  it("debounces typing and shows a searching state without results or an empty message", async () => {
    mockSongs = { isPending: true, fetchStatus: "fetching" };
    await wrap(<SongPicker />);
    await act(async () => mockSearchChange?.({ nativeEvent: { text: "  Heroes  " } }));
    await act(async () => jest.advanceTimersByTime(349));
    expect(screen.getByText("Type a song or an artist.")).toBeTruthy();
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

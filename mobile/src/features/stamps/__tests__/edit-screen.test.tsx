/** Edit memory: shared date rules, honest photo saving, and loading/error states. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { StampView } from "@/api/contracts";
import EditStamp from "@/app/(app)/stamp/edit";
import { testQueryClient } from "@/test/query-client";

type Query = { data?: unknown; isPending?: boolean; isError?: boolean; isFetching?: boolean; error?: unknown; refetch?: () => void };
let mockStamp: Query;
const mockEdit = jest.fn();
let mockHeader: { right?: () => { element: React.ReactElement }[] } = {};

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: ({ options }: { options: { unstable_headerRightItems?: () => { element: React.ReactElement }[] } }) => { mockHeader = { right: options.unstable_headerRightItems }; return null; } },
  useLocalSearchParams: () => ({ id: "s1" }),
  useFocusEffect: jest.fn(),
  usePreventRemove: () => () => undefined,
}));
jest.mock("@/api/queries", () => ({ useStamp: () => mockStamp }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { stamps: { edit: (...a: unknown[]) => mockEdit(...a), removePhoto: jest.fn(), layout: jest.fn() }, upload: jest.fn() }, mediaUrl: (u: string) => u, errorText: client.errorText };
});

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const stamp = (over: Partial<StampView> = {}): StampView => ({
  id: "s1", photoUrl: null, photos: [], page: 1, slot: 1, caption: "hello", song: null,
  createdAt: daysAgo(10), visitedAt: daysAgo(10), verifiedAt: null, verified: false, editedAt: null,
  place: { id: "p1", slug: "velvet", name: "Velvet", area: null, city: null, region: null, country: null, countryCode: null, timeZone: "America/New_York" },
  ...over,
} as StampView);
const wrap = async () => render(<QueryClientProvider client={testQueryClient()}><EditStamp /></QueryClientProvider>);
const saveButton = async () => {
  const items = mockHeader.right?.() ?? [];
  const view = await render(items[0]!.element);
  return view;
};

describe("Edit memory", () => {
  beforeEach(() => { jest.clearAllMocks(); mockHeader = {}; });

  it("shows a loading state and a retryable error", async () => {
    mockStamp = { isPending: true };
    const view = await wrap();
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
    const refetch = jest.fn();
    mockStamp = { isError: true, error: new Error("x"), refetch };
    await view.rerender(<QueryClientProvider client={testQueryClient()}><EditStamp /></QueryClientProvider>);
    await fireEvent.press(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("labels the date and only flags it once complete, with a specific message", async () => {
    mockStamp = { data: { stamp: stamp() } };
    await wrap();
    const field = screen.getByLabelText("Visit date");
    await fireEvent.changeText(field, "01/0");
    expect(screen.queryByText(/Enter the date|is in the future|Pick a date/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Visit date"), "01/01/2020");
    expect(screen.getByText("Pick a date within the last year.")).toBeTruthy();
  });

  it("lets an old stamp save a caption change without touching its date", async () => {
    mockStamp = { data: { stamp: stamp({ visitedAt: daysAgo(400) }) } };
    mockEdit.mockResolvedValue({ stamp: stamp({ caption: "new words" }) });
    await wrap();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "new words");
    await saveButton();
    const save = screen.getAllByRole("button", { name: "Save" }).at(-1)!;
    expect(save.props.accessibilityState.disabled).toBe(false);
    await act(async () => void fireEvent.press(save));
    await waitFor(() => expect(mockEdit).toHaveBeenCalledWith("s1", { caption: "new words" }));
  });

  it("says photo changes save right away", async () => {
    mockStamp = { data: { stamp: stamp() } };
    await wrap();
    expect(screen.getByText("Photo changes save right away. Save applies the date, words and song.")).toBeTruthy();
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AddTo from "@/app/(app)/add-to";
import { nextMembers } from "@/features/books/books";
import { testQueryClient } from "@/test/query-client";

const mockRouter = { dismiss: jest.fn() };
const mockPush = jest.fn();
const mockApi = { setInPassport: jest.fn(), get: jest.fn(), update: jest.fn() };
let mockParams: { ids?: string } = { ids: "s1" };
let mockBooks: { isPending?: boolean; isError?: boolean; data?: unknown } = {};
const mockPassportStamps = [{ id: "s1", page: 1 }, { id: "s2", page: null }];

jest.mock("expo-router", () => ({
  router: { dismiss: (...a: unknown[]) => mockRouter.dismiss(...a) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/lib/nav", () => ({ nav: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), reset: jest.fn() } }));
jest.mock("@/api", () => ({
  api: {
    books: { setInPassport: (...a: unknown[]) => mockApi.setInPassport(...a) },
    collections: { get: (...a: unknown[]) => mockApi.get(...a), update: (...a: unknown[]) => mockApi.update(...a) },
  },
}));
jest.mock("@/api/queries", () => ({
  useCollections: () => ({ isPending: false, isError: false, refetch: jest.fn(), data: { collections: [{ id: "c1", name: "Date nights", color: "plum", stampCount: 2 }] } }),
  useStampBooks: () => ({ isPending: false, isError: false, refetch: jest.fn(), ...mockBooks }),
}));
jest.mock("@/features/book/use-passport", () => ({ usePassport: () => ({ stamps: mockPassportStamps }) }));

const wrap = async () => render(<QueryClientProvider client={testQueryClient()}><AddTo /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { ids: "s1" };
  mockBooks = { data: { inPassport: true, collectionIds: [] } };
  mockApi.get.mockResolvedValue({ collection: { stamps: [{ id: "a" }, { id: "b" }] } });
  mockApi.update.mockResolvedValue({ collection: { stamps: [] } });
  mockApi.setInPassport.mockResolvedValue({ inPassport: false, collectionIds: [] });
});

describe("nextMembers", () => {
  it("appends only missing stamps, removes only present ones, and reports no change as null", () => {
    expect(nextMembers(["a", "b"], ["b", "c", "c"], true)).toEqual(["a", "b", "c"]);
    expect(nextMembers(["a", "b"], ["a"], true)).toBeNull();
    expect(nextMembers(["a", "b", "c"], ["b"], false)).toEqual(["a", "c"]);
    expect(nextMembers(["a"], ["z"], false)).toBeNull();
  });
});

describe("Add to… sheet", () => {
  it("shows which books hold one stamp and toggles them", async () => {
    await wrap();
    expect(screen.getByRole("checkbox", { name: "Main passport" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole("checkbox", { name: "Date nights" }).props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(screen.getByRole("checkbox", { name: "Date nights" }));
    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith("c1", { stampIds: ["a", "b", "s1"] }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Date nights" }).props.accessibilityState).toMatchObject({ checked: true }));

    await fireEvent.press(screen.getByRole("checkbox", { name: "Main passport" }));
    await waitFor(() => expect(mockApi.setInPassport).toHaveBeenCalledWith("s1", false));
  });

  it("adds several selected stamps to a book at once", async () => {
    mockParams = { ids: "s1,s2" };
    await wrap();
    expect(screen.getByText(/2 stamps\./)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Add to Date nights" }));
    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith("c1", { stampIds: ["a", "b", "s1", "s2"] }));
    await fireEvent.press(screen.getByRole("button", { name: "Add to Main passport" }));
    await waitFor(() => expect(mockApi.setInPassport).toHaveBeenCalledTimes(2));
    expect(mockApi.setInPassport).toHaveBeenCalledWith("s2", true);
  });

  it("starts a new collection with the stamps", async () => {
    mockParams = { ids: "s1,s2" };
    await wrap();
    await fireEvent.press(screen.getByRole("button", { name: "New collection with these 2 stamps" }));
    expect(mockRouter.dismiss).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/collections/new", params: { stampIds: "s1,s2" } });
  });

  it("says so when the books can't load, and when a change fails", async () => {
    mockBooks = { isError: true };
    const { unmount } = await wrap();
    expect(screen.getByText("Couldn't load your books.")).toBeTruthy();
    unmount();

    mockBooks = { data: { inPassport: true, collectionIds: [] } };
    mockApi.get.mockRejectedValue(new Error("offline"));
    await wrap();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Date nights" }));
    expect(await screen.findByText(/Couldn't update that book/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Date nights" }).props.accessibilityState).toMatchObject({ checked: false });
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Alert, Clipboard, Share } from "react-native";

import type { StampView } from "@/api/contracts";
import ShareCollectionScreen from "@/app/(app)/collections/[id]/share";
import EditCollectionScreen from "@/app/(app)/collections/[id]/edit";
import NewCollectionScreen from "@/app/(app)/collections/new";
import { nav } from "@/lib/nav";
import { testQueryClient } from "@/test/query-client";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn() };
const mockApi = {
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  enableShare: jest.fn(),
  disableShare: jest.fn(),
};
let mockCollection: { isPending?: boolean; data?: unknown } = {};
let mockShare: { data?: unknown } = {};
let mockStamps: StampView[] = [];

type MockItem = { element: unknown };
type MockOptions = { unstable_headerLeftItems?: () => MockItem[]; unstable_headerRightItems?: () => MockItem[] };

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: new Proxy({}, { get: (_t, key: string) => (...a: unknown[]) => (mockRouter as Record<string, (...a: unknown[]) => unknown>)[key]?.(...a) }),
    useLocalSearchParams: () => ({ id: "c1" }),
    // Render the header items so tests can press Cancel / Create / Save.
    Stack: {
      Screen: ({ options }: { options?: MockOptions }) =>
        React.createElement(React.Fragment, null, options?.unstable_headerLeftItems?.()[0]?.element ?? null, options?.unstable_headerRightItems?.()[0]?.element ?? null),
    },
  };
});
jest.mock("@/api", () => ({
  api: {
    collections: {
      create: (...a: unknown[]) => mockApi.create(...a),
      update: (...a: unknown[]) => mockApi.update(...a),
      remove: (...a: unknown[]) => mockApi.remove(...a),
      enableShare: (...a: unknown[]) => mockApi.enableShare(...a),
      disableShare: (...a: unknown[]) => mockApi.disableShare(...a),
    },
  },
  errorText: (_e: unknown, fallback: string) => fallback,
}));
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { handle: "ava" } }, isPending: false, isError: false, refetch: jest.fn() }),
  useUserStamps: () => ({ data: { pages: [{ stamps: mockStamps, nextAfter: null }] }, isPending: false, isError: false, hasNextPage: false, refetch: jest.fn() }),
  useCollection: () => ({ refetch: jest.fn(), ...mockCollection }),
  useCollectionShare: () => ({ refetch: jest.fn(), ...mockShare }),
}));

const stamp = (id: string, name: string) =>
  ({ id, visitedAt: "2026-10-19T20:00:00.000Z", place: { id: `p-${id}`, slug: id, name, area: "West Village", city: "New York", region: null, country: null, countryCode: null, timeZone: "America/New_York" } }) as unknown as StampView;

const wrap = async (ui: ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  nav.reset();
  mockStamps = [stamp("s1", "Don Angie"), stamp("s2", "Employees Only")];
  mockCollection = { data: { collection: { id: "c1", name: "Date Nights", color: "blue", stamps: [mockStamps[0]] } } };
  mockShare = {};
});

describe("Create collection", () => {
  it("puts Create in the header, enabled once there is a name", async () => {
    await wrap(<NewCollectionScreen />);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create collection" })).toBeNull();
    expect(screen.getByText("Add a name to create.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Collection name"), "Date Nights");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("closes the sheet, then opens the new collection", async () => {
    mockApi.create.mockResolvedValue({ collection: { id: "new-1" } });
    await wrap(<NewCollectionScreen />);
    await fireEvent.changeText(screen.getByLabelText("Collection name"), "Date Nights");
    await fireEvent.press(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/collections/[id]", params: { id: "new-1" } }));
    expect(mockRouter.dismiss).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("offers cover colours as a radio group", async () => {
    await wrap(<NewCollectionScreen />);
    expect(screen.getByRole("radio", { name: "Blue cover" })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "Green cover" }));
    expect(screen.getByRole("radio", { name: "Green cover" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Blue cover" })).not.toBeChecked();
  });
});

describe("Edit collection", () => {
  const confirmDelete = () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    return alert;
  };

  it("returns to the existing list after a delete, not to the deleted collection", async () => {
    mockApi.remove.mockResolvedValue({ deleted: true });
    confirmDelete();
    await wrap(<EditCollectionScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete collection" }));
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: "/gallery", params: { tab: "collections" } }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("disables Save while a delete runs, and says when the delete failed", async () => {
    let fail: (e: Error) => void = () => undefined;
    mockApi.remove.mockReturnValue(new Promise((_r, reject) => { fail = reject; }));
    confirmDelete();
    await wrap(<EditCollectionScreen />);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await fireEvent.press(screen.getByRole("button", { name: "Delete collection" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    await act(async () => fail(new Error("offline")));
    expect(await screen.findByText("Couldn't delete this collection. Try again.")).toBeTruthy();
  });

  it("shows the collection's own stamps straight away", async () => {
    mockStamps = [];
    await wrap(<EditCollectionScreen />);
    expect(screen.getByText("Don Angie")).toBeTruthy();
  });
});

describe("Share collection", () => {
  beforeEach(() => {
    mockShare = { data: { share: { enabled: true, url: "https://nostos.example/c/abc" } } };
  });

  it("copies the link in one tap", async () => {
    const setString = jest.spyOn(Clipboard, "setString").mockImplementation(() => undefined);
    await wrap(<ShareCollectionScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Copy link" }));
    expect(setString).toHaveBeenCalledWith("https://nostos.example/c/abc");
  });

  it("opens one share sheet however fast Share is tapped", async () => {
    const share = jest.spyOn(Share, "share").mockReturnValue(new Promise(() => undefined));
    await wrap(<ShareCollectionScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Share link" }));
    await fireEvent.press(screen.getByRole("button", { name: "Share link" }));
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("asks again before retrying a failed disable", async () => {
    mockApi.disableShare.mockRejectedValue(new Error("offline"));
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    await wrap(<ShareCollectionScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Disable shared link" }));
    await screen.findByText("Couldn't update this shared link.");
    expect(alert).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(alert).toHaveBeenCalledTimes(2);
  });
});

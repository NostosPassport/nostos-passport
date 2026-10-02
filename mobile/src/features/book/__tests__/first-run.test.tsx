import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { BrandMark } from "@/components/brand/brand-mark";
import { FIRST_RUN_COPY, FIRST_RUN_KEY, hasSeenFirstRun, markFirstRunSeen } from "../first-run";
import { PassportBook } from "../PassportBook";
import type { PassportData } from "../use-passport";

let mockData: PassportData;
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../use-passport", () => ({ usePassport: () => mockData }));
jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u }));

const ready = (): PassportData => ({
  status: "ready", handle: "ava", displayName: "Ava Lee", avatarUrl: null, bio: "", memberSince: "2026-10-03T04:00:00.000Z", stamps: [], pins: [],
  counts: { stamps: 0, places: 0, neighborhoods: 0 }, neighborhoods: [], retry: jest.fn(),
});

describe("first run", () => {
  beforeEach(() => {
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockClear();
    mockData = ready();
  });

  it("remembers on the phone only that the hint was seen", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    expect(await hasSeenFirstRun()).toBe(false);
    await markFirstRunSeen();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(FIRST_RUN_KEY, "1");
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("1");
    expect(await hasSeenFirstRun()).toBe(true);
  });
  it("doesn't nag if the store can't be read", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("locked"));
    expect(await hasSeenFirstRun()).toBe(true);
  });
  it("shows once on the closed passport, then goes away when dismissed and stays away", async () => {
    await render(<PassportBook />);
    await waitFor(() => expect(screen.getByText(FIRST_RUN_COPY.title)).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: FIRST_RUN_COPY.button }));
    expect(screen.queryByText(FIRST_RUN_COPY.title)).toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(FIRST_RUN_KEY, "1");
  });
  it("is not shown at all if it has been seen", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue("1");
    await render(<PassportBook />);
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());
    expect(screen.queryByText(FIRST_RUN_COPY.title)).toBeNull();
  });
  it("counts as seen when the cover is opened", async () => {
    await render(<PassportBook />);
    await waitFor(() => expect(screen.getByText(FIRST_RUN_COPY.title)).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: /Open your passport/ }));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(FIRST_RUN_KEY, "1");
  });
});

describe("brand mark", () => {
  it("is named Nostos for a screen reader", async () => {
    await render(<BrandMark />);
    expect(screen.getByLabelText("Nostos")).toBeTruthy();
  });
});

import { OfficialInfoRequest } from "@/api/contracts";
import { changedFields } from "../use-update-info";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({}) }));
jest.mock("expo-image", () => ({ Image: () => null }));

const initial = { name: "Velvet", address: "1 Ave A", officialCover: "10", dressCode: "" };

describe("owner details form", () => {
  it("sends only changed fields, trimmed, in a body the contract accepts", () => {
    const body = changedFields(initial, { ...initial, officialCover: " 15 ", dressCode: "No sneakers" });
    expect(body).toEqual({ officialCover: "15", dressCode: "No sneakers" });
    expect(OfficialInfoRequest.safeParse(body).success).toBe(true);
  });
  it("sends nothing when nothing changed", () => {
    expect(changedFields(initial, { ...initial, name: "Velvet " })).toEqual({});
  });
  it("can clear the official cover", () => {
    expect(changedFields(initial, { ...initial, officialCover: "" })).toEqual({ officialCover: "" });
  });
});

describe("promo status", () => {
  // Imported lazily: the screen module pulls in native components.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { promoStatus } = require("@/app/(app)/owner/[venueId]") as typeof import("@/app/(app)/owner/[venueId]");
  const now = "2026-09-24T20:00:00.000Z";
  it("reads scheduled, live, ended and cancelled from the server's times", () => {
    expect(promoStatus({ startsAt: "2026-09-25T20:00:00.000Z", endsAt: "2026-09-25T23:00:00.000Z" }, now)).toBe("scheduled");
    expect(promoStatus({ startsAt: "2026-09-24T19:00:00.000Z", endsAt: "2026-09-24T23:00:00.000Z" }, now)).toBe("live");
    expect(promoStatus({ startsAt: "2026-09-23T19:00:00.000Z", endsAt: "2026-09-23T23:00:00.000Z" }, now)).toBe("ended");
    // The API cancels a future promo by collapsing it to a 1 ms window.
    expect(promoStatus({ startsAt: "2026-09-24T19:59:59.999Z", endsAt: "2026-09-24T20:00:00.000Z" }, now)).toBe("cancelled");
  });
});

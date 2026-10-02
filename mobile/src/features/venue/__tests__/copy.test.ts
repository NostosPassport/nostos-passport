import { consensusMeta, friendsLine } from "../live-section";
import { accuracyCopy } from "../official-section";

jest.mock("expo-image", () => ({ Image: () => null }));

const now = "2026-09-24T03:00:00.000Z";

describe("venue copy", () => {
  it("describes consensus freshness from the server's times", () => {
    expect(consensusMeta({ status: "ok", value: "PACKED", reportCount: 6, userCount: 5, newestAt: "2026-09-24T02:56:00.000Z", totalWeight: 3 }, now)).toBe(
      "6 reports · updated 4 min ago",
    );
    expect(consensusMeta({ status: "insufficient", reportCount: 1, userCount: 1, newestAt: "2026-09-24T02:30:00.000Z" }, now)).toBe("1 report · updated 30 min ago");
    expect(consensusMeta({ status: "insufficient", reportCount: 0, userCount: 0, newestAt: null }, now)).toBe("No reports in the last hour");
  });

  it("names friends going", () => {
    expect(friendsLine(["Maya"])).toBe("Maya is going");
    expect(friendsLine(["Maya", "Sam"])).toBe("Maya and Sam are going");
    expect(friendsLine(["Maya", "Sam", "Ali"])).toBe("Maya, Sam and 1 other are going");
    expect(friendsLine(["Maya", "Sam", "Ali", "Jo"])).toBe("Maya, Sam and 2 others are going");
  });

  it("explains the accuracy score for each API state", () => {
    expect(accuracyCopy({ status: "ok", scorePct: 82, qualifyingWindows: 11, matchingWindows: 9, windows: [] })).toEqual({
      title: "Cover accuracy 82%",
      detail: "The posted cover matched what people reported in 9 of 11 busy hours.",
    });
    expect(accuracyCopy({ status: "insufficient", qualifyingWindows: 2, matchingWindows: 2, windows: [] }).title).toBe("Not enough data yet");
    expect(accuracyCopy({ status: "no_official_cover", qualifyingWindows: 0, matchingWindows: 0, windows: [] }).title).toBe("No official cover posted");
  });
});

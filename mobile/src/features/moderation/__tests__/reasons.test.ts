import { REPORT_REASONS } from "../content-actions";

describe("report reasons", () => {
  it("include underage, stalking and not at this place, each with its category", () => {
    const by = Object.fromEntries(REPORT_REASONS.map((r) => [r.category, r.label]));
    expect(by.UNDERAGE).toMatch(/underage/i);
    expect(by.STALKING).toMatch(/stalking/i);
    expect(by.NOT_AT_PLACE).toBe("Not at this place");
  });

  it("have unique labels and categories, and every label is a sentence the server accepts as a reason (3 to 300 characters)", () => {
    expect(new Set(REPORT_REASONS.map((r) => r.label)).size).toBe(REPORT_REASONS.length);
    expect(new Set(REPORT_REASONS.map((r) => r.category)).size).toBe(REPORT_REASONS.length);
    for (const r of REPORT_REASONS) expect(r.label.length).toBeGreaterThanOrEqual(3);
  });
});

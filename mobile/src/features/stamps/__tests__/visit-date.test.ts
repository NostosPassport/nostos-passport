import { act, renderHook } from "@testing-library/react-native";

import { checkVisitDate, formatVisitDateInput, parseVisitDate, useVisitDateField, VISIT_DATE_MESSAGES, visitDateText } from "../visit-date";

const NOW = new Date(2026, 10, 20, 9, 0, 0).getTime();

describe("visit dates", () => {
  it("formats, prints and parses MM/DD/YYYY", () => {
    expect(formatVisitDateInput("09202026")).toBe("09/20/2026");
    expect(visitDateText(new Date(2026, 0, 5))).toBe("01/05/2026");
    expect(parseVisitDate("02/30/2026")).toBeNull();
    expect(parseVisitDate("09/20/2026")?.getDate()).toBe(20);
  });

  it("gives a specific message for each rule", () => {
    expect(checkVisitDate("09/2", NOW)).toMatchObject({ ok: false, problem: "incomplete" });
    expect(checkVisitDate("13/40/2026", NOW)).toMatchObject({ ok: false, message: VISIT_DATE_MESSAGES.invalid });
    expect(checkVisitDate("12/25/2026", NOW)).toMatchObject({ ok: false, message: VISIT_DATE_MESSAGES.future });
    expect(checkVisitDate("01/01/2020", NOW)).toMatchObject({ ok: false, message: VISIT_DATE_MESSAGES.tooOld });
    expect(checkVisitDate("11/20/2026", NOW).ok).toBe(true);
    expect(checkVisitDate("11/20/2025", NOW).ok).toBe(true);
  });

  it("only shows an error once the date is complete or the field is left", async () => {
    const { result } = await renderHook(() => useVisitDateField("11/20/2026", NOW));
    expect(result.current.error).toBeNull();
    await act(async () => result.current.setText("11/20/202"));
    expect(result.current.check.ok).toBe(false);
    expect(result.current.error).toBeNull();
    await act(async () => result.current.onBlur());
    expect(result.current.error).toBe(VISIT_DATE_MESSAGES.incomplete);
    await act(async () => result.current.setText("12/25/202"));
    expect(result.current.error).toBeNull();
    await act(async () => result.current.setText("12/25/2026"));
    expect(result.current.error).toBe(VISIT_DATE_MESSAGES.future);
  });
});

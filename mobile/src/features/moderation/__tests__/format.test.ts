import { actionWord, reputationText } from "../format";

describe("moderation copy", () => {
  it("names actions and reputation", () => {
    expect(actionWord("AUTO_HIDE")).toBe("Auto-hidden");
    expect(actionWord("SUSPEND")).toBe("Suspended");
    expect(reputationText(0.5)).toBe("trust 100%");
    expect(reputationText(1.5)).toBe("trust 300%");
  });
});

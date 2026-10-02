import { actionWord, prettyPreview, reputationText } from "../format";

describe("moderation copy", () => {
  it("puts report previews in words", () => {
    expect(prettyPreview("vibe: PACKED")).toBe("Vibe: Packed");
    expect(prettyPreview("line: TEN_TO_30")).toBe("Line: 10–30 min");
    expect(prettyPreview("line: NONE")).toBe("Line: No line");
    expect(prettyPreview("cover: cover 20 USD")).toBe("Cover: $20");
    expect(prettyPreview("cover: cover 12.5 USD")).toBe("Cover: $12.50");
    expect(prettyPreview("cover: cover 0 USD")).toBe("Cover: Free");
    expect(prettyPreview("Great crowd")).toBe("Great crowd");
  });
  it("names actions and reputation", () => {
    expect(actionWord("AUTO_HIDE")).toBe("Auto-hidden");
    expect(reputationText(0.5)).toBe("trust 100%");
    expect(reputationText(1.5)).toBe("trust 300%");
  });
});

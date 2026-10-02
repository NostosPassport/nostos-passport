import { describe, expect, it } from "vitest";
import { containsObjectionable } from "@/lib/content-filter";
import { assertCleanText } from "@/server/errors";

describe("objectionable content filter", () => {
  it("catches slurs and explicit terms", () => {
    for (const t of ["what a faggot", "total retard", "Kike", "nice pussy", "porn night", "coons", "whores"]) expect(containsObjectionable(t), t).toBe(true);
  });
  it("sees through leetspeak, accents, spacing, punctuation and letter stretching", () => {
    for (const t of ["n1gg3r", "f@gg0t", "r3t@rd", "f a g", "f.a.g.g.o.t", "faaaggggot", "what a w h o r e", "s l u t", "ćunt"]) expect(containsObjectionable(t), t).toBe(true);
  });
  it("catches unambiguous slurs inside run-together handles", () => {
    for (const t of ["xxniggerxx", "the_faggot_king", "Wetback99", "ilovecumshots", "big_n1gga_energy"]) expect(containsObjectionable(t), t).toBe(true);
  });
  it("does not flag innocent words that contain a short term (Scunthorpe problem)", () => {
    for (const t of [
      "Great cocktails tonight", "spicy margaritas", "a raccoon by the bins", "Scunthorpe United fans",
      "fire retardant curtains", "cocktail hour", "cumin in the fries", "Dickens themed trivia", "the grape soda", "Therapist night out",
      "Shitake mushrooms", "this place is fucking packed", "Pakistani food nearby", "cocoon lounge",
      // regressions from review: letter-collapsing and cross-word substrings used to flag these
      "pros and cons", "con artist", "Nigerian food spot", "zucchini gazpacho", "mini garden bar", "drag heads welcome",
      "wet backyard patio", "Cock & Bull", "cum laude", "someone tried to rape my friend here, be careful",
    ]) expect(containsObjectionable(t), t).toBe(false);
  });
  it("handles empty input", () => {
    expect(containsObjectionable("")).toBe(false);
    expect(containsObjectionable(null)).toBe(false);
  });
  it("assertCleanText throws a clear 400 naming the field", () => {
    expect(() => assertCleanText({ caption: "fine", comment: "you retard" })).toThrow(/Your comment contains language we don't allow/);
    try {
      assertCleanText({ handle: "sl_ut" });
    } catch (e) {
      expect(e).toMatchObject({ status: 400, code: "objectionable_content" });
    }
    expect(() => assertCleanText({ comment: "Packed, 20 min line" })).not.toThrow();
  });
});

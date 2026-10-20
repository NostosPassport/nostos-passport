import { describe, expect, it } from "vitest";
import { resolveCategoryStamp, photoClipPath, layoutCategoryName, safeStampPhotoUrl } from "../../../shared/category-stamp-artwork";

describe("category ink stamp design v1", () => {
  it("uses specific primary type rather than generic tags", () => {
    expect(resolveCategoryStamp({id:"one",category:"restaurant",primaryType:"sushi_restaurant",cuisines:["Italian"]})?.cuisine).toBe("japanese");
  });
  it("chooses a documented priority independent of input tag order", () => {
    const v={id:"one",category:"restaurant",primaryType:"restaurant"};
    expect(resolveCategoryStamp({...v,cuisines:["Indian","Italian"]})).toEqual(resolveCategoryStamp({...v,cuisines:["Italian","Indian"]}));
  });
  it("bar and club primary types take precedence over food tags", () => {
    expect(resolveCategoryStamp({id:"bar",category:"restaurant",primaryType:"night_club",cuisines:["Italian"]})?.kind).toBe("bar");
    expect(resolveCategoryStamp({id:"bar",category:"bar",primaryType:"cocktail_bar",cuisines:["Thai"]})?.icon).toBe("glass");
  });
  it("unknown cuisines get neutral restaurant ink; unsupported places retain legacy", () => {
    expect(resolveCategoryStamp({id:"x",category:"restaurant",cuisines:[]})?.cuisine).toBe("restaurant");
    expect(resolveCategoryStamp({id:"park",category:null,cuisines:[]})).toBeNull();
  });
  it("design is stable across users and photos (neither enters the input)", () => {
    const v={id:"same",category:"restaurant",cuisines:["Japanese"]};
    expect(resolveCategoryStamp(v)).toEqual(resolveCategoryStamp({...v}));
  });
  it("fits names without changing geometry or deleting accents", () => {
    for(const name of ["Umi","An Extraordinarily Long Restaurant Name Near Washington Square", "Épicerie Française","日本料理店 東京"]) {
      const result=layoutCategoryName(name,"restaurant");
      expect(result.lines.length).toBeLessThanOrEqual(3);
      expect(result.fontSize).toBeGreaterThanOrEqual(10);
      if(!result.truncated) expect(result.lines.join(" ").replace(/ /g,"")).toBe(name.replace(/ /g,""));
    }
  });
  it("clip paths are valid and URLs reject non-photo injection", () => {
    expect(photoClipPath(10,10,80).startsWith("M")).toBe(true);
    expect(safeStampPhotoUrl("javascript:alert(1)")).toBeNull();
    expect(safeStampPhotoUrl("https://example.com/f.jpg")).not.toBeNull();
    expect(safeStampPhotoUrl("/api/uploads/abc")).toBe("/api/uploads/abc");
  });
});

import { describe, expect, it } from "vitest";
import { resolveCategoryStamp, inkTextWidth, fitCategoryLocality, categoryNameLineWidth, CATEGORY_STAMP_GEOMETRY, categoryStampDateLabel, photoClipPath, layoutCategoryName, safeStampPhotoUrl } from "../../../shared/category-stamp-artwork";
import { designFromArtwork } from "../../../shared/category-stamp-design";

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
  it("hotels get the hotel stamp with the key icon; food and drink inside hotels keep their own", () => {
    const hotel=resolveCategoryStamp({id:"h",category:"hotel",primaryType:"hotel",cuisines:[]});
    expect(hotel).toMatchObject({kind:"hotel",cuisine:"hotel",label:"HOTEL",icon:"key"});
    expect(resolveCategoryStamp({id:"h",category:null,primaryType:"boutique",cuisines:[]})).toBeNull();
    expect(resolveCategoryStamp({id:"h",category:null,primaryType:"resort_hotel",cuisines:[]})?.kind).toBe("hotel");
    expect(resolveCategoryStamp({id:"r",category:"restaurant",primaryType:"hotel",cuisines:["Italian"]})?.kind).toBe("restaurant");
    expect(designFromArtwork(hotel!,{name:"Public Hotel",locality:"Lower East Side"})).toMatchObject({template:"hotel",label:"HOTEL",icon:"key"});
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
  it("uses fixed dimensions for the approved restaurant and bar references", () => {
    expect(CATEGORY_STAMP_GEOMETRY.restaurant.photo).toEqual({x:22,y:21,s:110});
    expect(CATEGORY_STAMP_GEOMETRY.bar.photo).toEqual({x:43,y:40,s:74});
    expect(CATEGORY_STAMP_GEOMETRY.bar.photo.s).toBeGreaterThan(68);
    expect(CATEGORY_STAMP_GEOMETRY.bar.photo.y + CATEGORY_STAMP_GEOMETRY.bar.photo.s).toBeLessThan(CATEGORY_STAMP_GEOMETRY.bar.dateY);
    expect(resolveCategoryStamp({id:"o",category:"restaurant",primaryType:"italian_restaurant"})?.color).toBe("#143B2B");
    expect(resolveCategoryStamp({id:"b",category:"bar",primaryType:"cocktail_bar"})?.color).toBe("#7C1030");
    expect(categoryStampDateLabel("2026-10-20T12:00:00-04:00")).toBe("20 OCT 2026");
    expect(categoryStampDateLabel("2026-10-20T23:30:00-04:00", "Europe/Rome")).toBe("21 OCT 2026");
  });
  it("categorizes French, American, Spanish and Lebanese without name inference", () => {
    for(const [kind,tag] of [["french","french_restaurant"],["american","american_restaurant"],["spanish","spanish_restaurant"],["lebanese","lebanese_restaurant"]] as const){
      expect(resolveCategoryStamp({id:"v",category:"restaurant",primaryType:tag,cuisines:[]})?.cuisine).toBe(kind);
    }
    expect(resolveCategoryStamp({id:"v",category:"restaurant",primaryType:"fine_dining_restaurant",cuisines:[]})?.cuisine).toBe("restaurant");
  });
  it("fits wide and multilingual glyphs without relying on character count", () => {
    expect(inkTextWidth("WWWW",12)).toBeGreaterThan(inkTextWidth("iiii",12));
    for(const name of ["WMWMWM & GRAND", "Épicerie Française", "東京和食店", "THISISAWORDSOWIDEITNEVERHASSPACES"]){
      for(const kind of ["bar","restaurant"] as const){
        const layout=layoutCategoryName(name,kind);
        expect(layout.lines.length).toBeLessThanOrEqual(kind==="bar"?2:3);
        expect(layout.lines.every(line=>inkTextWidth(line,layout.fontSize)<=(kind==="bar"?85:102)+0.01)).toBe(true);
      }
    }
  });
  it("keeps WEST VILLAGE untruncated and constrains actual requested SVG advances", () => {
    const line=fitCategoryLocality("WEST VILLAGE","bar");
    const g=CATEGORY_STAMP_GEOMETRY.bar;
    const halfChord=Math.sqrt(71**2-(g.localityY-80)**2);
    expect(line.text).toBe("WEST VILLAGE");
    expect(line.width).toBeLessThan(halfChord*2);
    const long=fitCategoryLocality("A VERY LONG UNBROKEN NEIGHBORHOOD NAME","bar");
    expect(long.text.endsWith("…")).toBe(true);
    expect(long.width).toBeLessThanOrEqual(60);
    expect(categoryNameLineWidth("WWWWWWWW","bar",13,0,2)).toBeLessThanOrEqual(54);
  });
  it("keeps the circles' three metadata lines inside reserved coordinates", () => {
    expect(CATEGORY_STAMP_GEOMETRY.bar.dateY).toBeLessThan(CATEGORY_STAMP_GEOMETRY.bar.categoryY);
    expect(CATEGORY_STAMP_GEOMETRY.bar.categoryY).toBeLessThan(CATEGORY_STAMP_GEOMETRY.bar.localityY);
    expect(CATEGORY_STAMP_GEOMETRY.bar.photo.y + CATEGORY_STAMP_GEOMETRY.bar.photo.s).toBeLessThan(CATEGORY_STAMP_GEOMETRY.bar.dateY);
  });
  it("clip paths are valid and URLs reject non-photo injection", () => {
    expect(photoClipPath(10,10,80).startsWith("M")).toBe(true);
    expect(safeStampPhotoUrl("javascript:alert(1)")).toBeNull();
    expect(safeStampPhotoUrl("https://example.com/f.jpg")).not.toBeNull();
    expect(safeStampPhotoUrl("/api/uploads/abc")).toBe("/api/uploads/abc");
  });
});

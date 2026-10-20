import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveCategoryStamp } from "../../../shared/category-stamp-artwork";
import { CategoryStampSvg } from "../../src/app/c/[token]/CategoryStampSvg";

const italian = resolveCategoryStamp({id:"italian",category:"restaurant",primaryType:"italian_restaurant"})!;
const bar = resolveCategoryStamp({id:"night",category:"bar",primaryType:"cocktail_bar"})!;
function one(artwork:typeof italian, name:string, photoUrl:string|null=null) {
 return createElement(CategoryStampSvg,{artwork,name,locality:"NEW YORK",visitedAt:"2026-10-20T12:00:00-04:00",photoUrl});
}
describe("transparent category SVGs",()=>{
 it("never paints a white or faux-paper backing",()=>{
   const html=renderToStaticMarkup(createElement("div",null,one(italian,"Osteria"),one(bar,"Midnight Social")));
   expect(html).not.toContain('fill="#FFFFFF"');
   expect(html).not.toContain('fill="#fff"');
   expect(html).not.toContain('fill="#F3F4F2"');
   expect(html).toContain('fill="none"');
   expect(html).toContain('stroke=');
 });
 it("uses independent clip IDs for repeated stamps and a real clipped photo",()=>{
   const markup=renderToStaticMarkup(createElement("div",null,
     one(italian,"Osteria","https://example.com/one.jpg"),
     one(italian,"Osteria","https://example.com/two.jpg"),
     one(bar,"Midnight Social")));
   const ids=[...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(match=>match[1]);
   expect(ids).toHaveLength(3);
   expect(new Set(ids).size).toBe(3);
   expect(markup).toContain('preserveAspectRatio="xMidYMid slice"');
 });
 it("reserves non-overlapping bar date, category and locality lines",()=>{
   const html=renderToStaticMarkup(one(bar,"Midnight Social"));
   expect(html).toContain("BAR / CLUB");
   expect(html).toContain("NEW YORK");
   expect(html).toContain("20 OCT 2026");
   expect(html).toContain('y="124"');
   expect(html).toContain('y="136"');
   expect(html).toContain('y="146"');
 });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveCategoryStamp } from "../../../shared/category-stamp-artwork";
import { REFERENCE } from "../../../shared/category-stamp-sheets";
import { CategoryStampSvg } from "../../src/app/c/[token]/CategoryStampSvg";

const italian = resolveCategoryStamp({id:"italian",category:"restaurant",primaryType:"italian_restaurant"})!;
const bar = resolveCategoryStamp({id:"night",category:"bar",primaryType:"cocktail_bar"})!;
const AT = "2026-10-20T12:00:00-04:00";
function one(artwork:typeof italian, name:string, photoUrl:string|null=null, locality="NEW YORK") {
 return createElement(CategoryStampSvg,{artwork,name,locality,visitedAt:AT,photoUrl});
}
describe("category stamp SVGs",()=>{
 it("never paints a backing: the only fills are ink text, the icon, the mark and the ink mask",()=>{
   const html=renderToStaticMarkup(createElement("div",null,one(italian,"Osteria"),one(bar,"Midnight Social")));
   // white and black appear only as luminance-mask colours inside <mask>, never as a painted fill
   const outsideMasks=html.replace(/<mask[\s\S]*?<\/mask>/g,"");
   expect(outsideMasks).not.toMatch(/fill="(white|#fff|#FFFFFF|#000|#000000)"/i);
   expect(outsideMasks).not.toMatch(/<rect/);
   expect(html).toContain('fill="none"');
   expect(html).toContain('stroke=');
 });
 it("uses independent clip, mask and arc IDs for repeated stamps and a real clipped photo",()=>{
   const markup=renderToStaticMarkup(createElement("div",null,
     one(italian,"Osteria","https://example.com/one.jpg"),
     one(italian,"Osteria","https://example.com/two.jpg"),
     one(bar,"Midnight Social")));
   const ids=[...markup.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
   expect(ids.length).toBeGreaterThanOrEqual(2+2+4);
   expect(new Set(ids).size).toBe(ids.length);
   expect(markup).toContain('preserveAspectRatio="xMidYMid slice"');
 });
 it("keeps WEST VILLAGE and the full name in text or the accessible label, with arcs for the circular template",()=>{
   const html=renderToStaticMarkup(createElement("div",null,
     one(bar,"An Exceptionally Long Cocktail Lounge","https://example.com/p.jpg","West Village"),
     one(italian,"Café de l'Étoile",null,"West Village")));
   expect(html).toContain("WEST VILLAGE");
   expect(html).toContain("<textPath");
   expect(html).toContain('aria-label="An Exceptionally Long Cocktail Lounge, BAR / CLUB, West Village, 20 OCT 2026"');
   expect(html).not.toContain('lengthAdjust="spacingAndGlyphs"'); // Latin names are measured, never squeezed
 });
 it("draws all four reference templates from design input",()=>{
   const html=REFERENCE.map(c=>renderToStaticMarkup(createElement(CategoryStampSvg,{design:c.design,visitedAt:c.visitedAt}))).join("");
   for(const word of ["OSTERIA","JOHN F.","THE ASTER HOUSE","MIDNIGHT SOCIAL"]) expect(html.toUpperCase()).toContain(word.toUpperCase());
   expect(html).toContain("$$$");
   expect(html).toContain("19 OCT 2026");
 });
});

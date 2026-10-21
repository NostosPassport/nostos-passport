import { focusBookSize, focusPageCount, focusPageSize, focusSpreadCount, pageTapTarget, singlePageTapTarget, isModelTap, stampHitRect } from "../focus-interaction";
describe("passport focus interaction", () => {
 it("counts occupied spreads and compact pages from the same stamp pages",()=>{
  expect(focusSpreadCount([])).toBe(1);expect(focusSpreadCount([1,1,1,2])).toBe(2);expect(focusSpreadCount([null,5])).toBe(4);
  expect(focusPageCount([])).toBe(1);expect(focusPageCount([1,1,1,2])).toBe(3);expect(focusPageCount([null,5])).toBe(6);
 });
 it("right/left spread taps move exactly one spread and hold at both boundaries", () => {
  expect(pageTapTarget(240,100,200,300,1,4,false,[])).toBe(2);
  expect(pageTapTarget(60,100,200,300,2,4,false,[])).toBe(1);
  expect(pageTapTarget(60,100,200,300,0,4,false,[])).toBe(0);
  expect(pageTapTarget(240,100,200,300,3,4,false,[])).toBe(3);
 });
 it("compact page taps use the page halves and preserve stamp precedence", () => {
  expect(singlePageTapTarget(160,100,200,300,1,4,false,[])).toBe(2);
  expect(singlePageTapTarget(40,100,200,300,2,4,false,[])).toBe(1);
  expect(singlePageTapTarget(40,100,200,300,0,4,false,[])).toBe(0);
  expect(singlePageTapTarget(160,100,200,300,3,4,false,[])).toBe(3);
  expect(singlePageTapTarget(160,100,200,300,1,4,false,[{left:140,right:180,top:80,bottom:140}])).toBe(1);
 });
 it("blocks animation taps, off-page taps, and stamp targets", () => {
  expect(pageTapTarget(240,100,200,300,1,4,true,[])).toBe(1);
  expect(pageTapTarget(-1,100,200,300,1,4,false,[])).toBe(1);
  expect(pageTapTarget(401,100,200,300,1,4,false,[])).toBe(1);
  expect(pageTapTarget(240,310,200,300,1,4,false,[])).toBe(1);
  expect(pageTapTarget(240,100,200,300,1,4,false,[{left:220,right:280,top:80,bottom:140}])).toBe(1);
  expect(singlePageTapTarget(160,100,200,300,1,4,true,[])).toBe(1);
  expect(singlePageTapTarget(201,100,200,300,1,4,false,[])).toBe(1);
 });
 it("distinguishes a tap from rotation, including a drag that returns to its starting point", () => {
  expect(isModelTap(5,190,false)).toBe(true);
  expect(isModelTap(15,190,false)).toBe(false);
  expect(isModelTap(0,600,false)).toBe(false);
  expect(isModelTap(0,100,true)).toBe(false);
 });
 it("maximizes two-page and one-page readers within their safe areas", () => {
  for(const [w,h] of [[320,600],[393,750],[852,330]]) {
   const b=focusBookSize(w,h);expect(b.pageWidth*2).toBeLessThanOrEqual(w-16);
   expect(b.pageHeight).toBeLessThanOrEqual(h-64);expect(b.pageHeight/b.pageWidth).toBeCloseTo(1.42,1);
   expect(b.pageWidth).toBeGreaterThan(100);
   const p=focusPageSize(w,h);expect(p.pageWidth).toBeLessThanOrEqual(w-16);
   expect(p.pageHeight).toBeLessThanOrEqual(h-64);expect(p.pageHeight/p.pageWidth).toBeCloseTo(1.42,1);
   expect(p.pageWidth).toBeGreaterThanOrEqual(b.pageWidth);
  }
 });
 it("stamp precedence covers the rotated touch box",()=>{
  const r=stampHitRect({cx:100,cy:100,size:80,rotation:20},200);
  expect(r.left).toBeLessThan(260);expect(r.right).toBeGreaterThan(340);
 });
});

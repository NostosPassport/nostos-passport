import { bookStyle, size, space } from "@/theme";
import { BOOK_ASPECT } from "./dimensions";
import type { Placement } from "./slots";
export const FOCUS_TOP_SPACE=size.hitTarget+space.sm;
export const FOCUS_BOTTOM_SPACE=space.xs;
export type HitRect = {left:number;right:number;top:number;bottom:number};
export function pageTapTarget(x:number,y:number,pw:number,ph:number,spread:number,total:number,busy:boolean,stamps:readonly HitRect[]):number {
 "worklet";
 if(busy || x<0 || x>pw*2 || y<0 || y>ph || stamps.some(r=>x>=r.left && x<=r.right && y>=r.top && y<=r.bottom)) return spread;
 return Math.max(0,Math.min(total-1,spread+(x<pw?-1:1)));
}
export function singlePageTapTarget(x:number,y:number,pw:number,ph:number,page:number,total:number,busy:boolean,stamps:readonly HitRect[]):number {
 "worklet";
 if(busy || x<0 || x>pw || y<0 || y>ph || stamps.some(r=>x>=r.left && x<=r.right && y>=r.top && y<=r.bottom)) return page;
 return Math.max(0,Math.min(total-1,page+(x<pw/2?-1:1)));
}
export function isModelTap(maxTravel:number,elapsedMs:number,cancelled:boolean):boolean {
 return !cancelled && maxTravel<=8 && elapsedMs>=0 && elapsedMs<=300;
}
export function focusBookSize(width:number,height:number) {
 const gutter=space.xs+bookStyle.maxEdgeLines*(bookStyle.edgeLine+bookStyle.edgeGap);
 const pageWidth=Math.max(1,Math.floor(Math.min((width-gutter*2)/2,(height-FOCUS_TOP_SPACE-FOCUS_BOTTOM_SPACE)/BOOK_ASPECT)));
 return {pageWidth,pageHeight:Math.floor(pageWidth*BOOK_ASPECT)};
}
export function focusPageSize(width:number,height:number) {
 const gutter=space.xs+bookStyle.maxEdgeLines*(bookStyle.edgeLine+bookStyle.edgeGap);
 const pageWidth=Math.max(1,Math.floor(Math.min(width-gutter*2,(height-FOCUS_TOP_SPACE-FOCUS_BOTTOM_SPACE)/BOOK_ASPECT)));
 return {pageWidth,pageHeight:Math.floor(pageWidth*BOOK_ASPECT)};
}
export function stampHitRect(p:Placement,offsetX:number):HitRect {
 const r=Math.abs(p.rotation)*Math.PI/180;
 const half=p.size/2*(Math.abs(Math.cos(r))+Math.abs(Math.sin(r)));
 return {left:offsetX+p.cx-half,right:offsetX+p.cx+half,top:p.cy-half,bottom:p.cy+half};
}
export function focusSpreadCount(pages:readonly (number|null)[]):number {
 return 1+Math.ceil(Math.max(0,...pages.map(p=>p??0))/2);
}
export function focusPageCount(pages:readonly (number|null)[]):number {
 return 1+Math.max(0,...pages.map(p=>p??0));
}

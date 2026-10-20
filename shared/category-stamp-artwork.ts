/** Versioned, pure stamp classification and SVG geometry shared by backend, Expo and web. */
export const CATEGORY_STAMP_VERSION = "category-ink/1" as const;
export type CategoryStampKind = "restaurant" | "bar";
export type CuisineIcon = "restaurant" | "pasta" | "taco" | "sushi" | "noodles" | "curry" | "pizza" | "bread" | "fish" | "leaf" | "bowl" | "grill" | "glass" | "music";
export type CategoryStampArtwork = { version: typeof CATEGORY_STAMP_VERSION; kind: CategoryStampKind; cuisine: string; label: string; color: string; icon: CuisineIcon };
export type CategoryVenue = { id: string; category?: string | null; primaryType?: string | null; cuisines?: readonly string[] | null };
const CATALOG: Record<string, { label: string; color: string; icon: CuisineIcon }> = {
  italian: {label:"Italian",color:"#143B2B",icon:"pasta"}, mexican: {label:"Mexican",color:"#A75435",icon:"taco"},
  japanese: {label:"Japanese",color:"#396D78",icon:"sushi"}, korean: {label:"Korean",color:"#895060",icon:"grill"},
  chinese: {label:"Chinese",color:"#9B4642",icon:"noodles"}, indian: {label:"Indian",color:"#79508A",icon:"curry"},
  thai: {label:"Thai",color:"#518065",icon:"bowl"}, vietnamese: {label:"Vietnamese",color:"#4D7966",icon:"bowl"},
  greek: {label:"Greek",color:"#3B6E9B",icon:"bowl"}, mediterranean: {label:"Mediterranean",color:"#3D7995",icon:"bowl"},
  middle_eastern: {label:"Middle Eastern",color:"#927243",icon:"bowl"}, seafood: {label:"Seafood",color:"#42728F",icon:"fish"},
  pizza: {label:"Pizza",color:"#AF4B39",icon:"pizza"}, bakery: {label:"Bakery",color:"#97754C",icon:"bread"},
  cafe: {label:"Café",color:"#765D4B",icon:"bowl"}, vegetarian: {label:"Vegetarian",color:"#4B7458",icon:"leaf"},
  steakhouse: {label:"Steakhouse",color:"#7C5249",icon:"grill"}, restaurant: {label:"Restaurant",color:"#4A514F",icon:"restaurant"},
};
const BAR_TYPES = new Set(["bar","bar_and_grill","beer_garden","brewpub","cocktail_bar","gastropub","hookah_bar","irish_pub","lounge_bar","pub","snack_bar","sports_bar","wine_bar","night_club","nightclub","dance_club"]);
const PRIMARY: Record<string,string> = {
 italian_restaurant:"italian",pasta_restaurant:"italian",pizza_restaurant:"pizza",mexican_restaurant:"mexican",taco_restaurant:"mexican",burrito_restaurant:"mexican",tex_mex_restaurant:"mexican",
 japanese_restaurant:"japanese",sushi_restaurant:"japanese",ramen_restaurant:"japanese",japanese_izakaya_restaurant:"japanese",
 korean_restaurant:"korean",korean_barbecue_restaurant:"korean",chinese_restaurant:"chinese",chinese_noodle_restaurant:"chinese",dim_sum_restaurant:"chinese",dumpling_restaurant:"chinese",
 indian_restaurant:"indian",north_indian_restaurant:"indian",south_indian_restaurant:"indian",thai_restaurant:"thai",vietnamese_restaurant:"vietnamese",
 greek_restaurant:"greek",mediterranean_restaurant:"mediterranean",middle_eastern_restaurant:"middle_eastern",falafel_restaurant:"middle_eastern",
 seafood_restaurant:"seafood",fish_and_chips_restaurant:"seafood",oyster_bar_restaurant:"seafood",bakery:"bakery",cafe:"cafe",coffee_shop:"cafe",
 vegetarian_restaurant:"vegetarian",vegan_restaurant:"vegetarian",steak_house:"steakhouse",
};
const ALIAS: Record<string,string> = {sushi:"japanese",ramen:"japanese",izakaya:"japanese",tacos:"mexican",tex_mex:"mexican",north_indian:"indian",south_indian:"indian",dim_sum:"chinese",chinese_noodles:"chinese",korean_barbecue:"korean",oyster_bar:"seafood",fish_and_chips:"seafood",coffee:"cafe",coffee_shop:"cafe",café:"cafe"};
const PRIORITY=["pizza","japanese","mexican","italian","korean","chinese","indian","thai","vietnamese","greek","mediterranean","middle_eastern","seafood","steakhouse","bakery","cafe","vegetarian"];
const norm=(s:string)=>s.trim().toLowerCase().replace(/[\s-]+/g,"_");
function cuisineKey(value:string):string|null { const t=norm(value);const k=PRIMARY[t]??ALIAS[t]??(CATALOG[t]?t:null);return k&&k!=="restaurant"&&CATALOG[k]?k:null; }
/** No random seed: venue category and stored Google cuisine tags determine the design. */
export function resolveCategoryStamp(venue:CategoryVenue):CategoryStampArtwork|null {
 if(!venue?.id?.trim())return null;
 const primary=norm(venue.primaryType??"");
 if(venue.category==="bar"||BAR_TYPES.has(primary)){
   const club=["night_club","nightclub","dance_club"].includes(primary);
   return {version:CATEGORY_STAMP_VERSION,kind:"bar",cuisine:club?"nightclub":"bar",label:club?"NIGHTCLUB":"BAR · CLUB",color:club?"#7C1030":"#7C1030",icon:club?"music":"glass"};
 }
 const tags=(venue.cuisines??[]).map(cuisineKey).filter((v):v is string=>!!v);
 if(venue.category!=="restaurant"&&!primary.includes("restaurant")&&primary!=="steak_house"&&!tags.length)return null;
 const chosen=cuisineKey(primary)??PRIORITY.find(k=>tags.includes(k))??"restaurant";
 const v=CATALOG[chosen]!;
 return {version:CATEGORY_STAMP_VERSION,kind:"restaurant",cuisine:chosen,label:v.label.toUpperCase(),color:v.color,icon:v.icon};
}
/** Twenty-four unit, independently editable SVG paths. */
export const CUISINE_PATHS:Record<CuisineIcon,string>={
 restaurant:"M4 10 Q12 4 20 10 M5 11 L7 19 H17 L19 11 M8 14 H16",
 pasta:"M3 12 Q12 23 21 12 M5 14 H19 M7 7 Q10 3 13 8 T19 7",
 taco:"M3 17 Q4 5 12 6 Q20 6 21 17 Z M6 12 Q12 8 18 12",
 sushi:"M4 10 Q12 4 20 10 L20 17 Q12 21 4 17 Z M9 12 Q12 9 15 12 Q15 16 12 17 Q9 16 9 12",
 noodles:"M4 14 Q12 22 20 14 M5 14 H19 M8 6 V12 M12 5 V12 M16 6 V12",
 curry:"M3 12 Q12 23 21 12 M5 12 H19 M8 7 Q10 3 12 7 M14 7 Q16 3 18 7",
 pizza:"M5 4 L20 12 L5 20 Z M7 8 Q10 12 7 16 M12 11 L13 11 M9 14 H10",
 bread:"M5 18 V11 Q2 5 9 5 Q12 2 15 5 Q21 5 19 11 V18 Z M9 8 V15 M14 8 V15",
 fish:"M3 12 Q11 3 18 12 Q11 21 3 12 Z M18 12 L22 8 V16 Z M7 11 H8",
 leaf:"M5 19 Q2 5 20 4 Q20 18 5 19 Z M6 18 L17 8",
 bowl:"M3 13 Q12 23 21 13 M5 13 H19 M7 8 Q9 5 11 8 M13 8 Q15 5 17 8",
 grill:"M4 8 H20 V13 H4 Z M7 15 V20 M17 15 V20 M8 10 V12 M12 10 V12 M16 10 V12",
 glass:"M5 5 H19 L17 14 Q12 19 7 14 Z M12 17 V21 M8 21 H16",
 music:"M10 5 V18 Q4 15 4 20 Q4 23 9 21 Q11 20 11 17 V8 L20 6 V16 Q14 13 14 19 Q14 22 19 20 Q21 19 21 16 V3 Z",
};
/** Lightly uneven square boundary; no shredded edge, shadow, or photo distress. */
export function photoClipPath(x:number,y:number,s:number):string{
 const n=(v:number)=>Number(v.toFixed(2));
 const pts=[[x+1,y],[x+s*.31,y+.6],[x+s*.68,y],[x+s-1,y+1],[x+s,y+s*.33],[x+s-.5,y+s*.69],[x+s-1,y+s-1],[x+s*.63,y+s],[x+s*.3,y+s-.5],[x+1,y+s-1],[x,y+s*.66],[x+.4,y+s*.33]];
 return pts.map((p,i)=>(i?"L":"M")+n(p[0]!) +" "+n(p[1]!)).join(" ")+" Z";
}
export function safeStampPhotoUrl(value:string|null|undefined):string|null{
 if(!value||value.length>2048||/[\u0000-\u001f<>\"]/.test(value))return null;
 if(value.startsWith("/api/uploads/")&&!value.startsWith("//"))return value;
 try{const u=new URL(value);return u.protocol==="https:"||(u.protocol==="http:"&&(["127.0.0.1","localhost"].includes(u.hostname)||/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)))?value:null;}catch{return null;}
}
export type StampNameLayout={lines:string[];fontSize:number;truncated:boolean};
/** Fixed reserved title area and bounded font sizes. Full name always remains accessible. */
export function layoutCategoryName(name:string,kind:CategoryStampKind):StampNameLayout{
 const clean=(name||"").trim().replace(/\s+/gu," ");const width=kind==="bar"?128:118;const maxLines=kind==="bar"?2:3;
 for(const size of (kind==="bar"?[13,12,11,10]:[17,16,15,14,13,12,11,10])){
   const cap=Math.max(5,Math.floor(width/(size*.56)));const lines:string[]=[];let line="";
   for(const word of clean.split(" ")){
     let chars=Array.from(word);const parts:string[]=[];
     while(chars.length>cap)parts.push(chars.splice(0,cap).join(""));parts.push(chars.join(""));
     for(const part of parts){if(!part)continue;if(!line)line=part;else if(Array.from(line+" "+part).length<=cap)line+=" "+part;else{lines.push(line);line=part;}}
   }
   if(line)lines.push(line);
   if(lines.length<=maxLines)return{lines:lines.length?lines:["UNNAMED"],fontSize:size,truncated:false};
 }
 const chars=Array.from(clean);const cap=kind==="bar"?19:21;
 return{lines:Array.from({length:maxLines},(_,i)=>chars.slice(i*cap,(i+1)*cap-(i===maxLines-1?1:0)).join("")+(i===maxLines-1?"…":"")),fontSize:10,truncated:true};
}

/** Fixed SVG measurement system shared by Expo and web. Coordinates follow the approved square-photo study. */
export const CATEGORY_STAMP_GEOMETRY = {
  restaurant: {
    viewBox: "0 0 260 154",
    photo: {x: 22, y: 21, s: 110},
    titleCenterX: 194,
    titleBaselines: {one: 56, two: [43, 63], three: [35, 51, 67]},
    iconX: 180, iconY: 76, captionX: 194, cuisineY: 112, localityY: 130, dateY: 143,
  },
  bar: {
    viewBox: "0 0 160 160",
    photo: {x: 41, y: 43, s: 78},
    titleArc: "M30 56 A56 56 0 0 1 130 56",
    titleArcSize: 14,
    iconX: 122, iconY: 83, localityY: 145, dateY: 134,
  },
} as const;
/** Date labels are about the New York visit day, never the rendering device's timezone. */
export function categoryStampDateLabel(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", day: "2-digit", month: "short", year: "numeric",
  }).formatToParts(new Date(value));
  const part=(kind: string) => parts.find(p=>p.type===kind)?.value ?? "";
  return `${part("day")} ${part("month").toUpperCase()} ${part("year")}`;
}

"use client";
import { useEffect, useState } from "react";
import { resolveCategoryStamp } from "@/lib/category-stamp-artwork";
import { CategoryStampSvg } from "@/app/c/[token]/CategoryStampSvg";

const examples=[
 {id:"italian",name:"Osteria della Piazza",category:"restaurant",primaryType:"italian_restaurant",cuisines:["Italian"]},
 {id:"bar",name:"Midnight Social",category:"bar",primaryType:"cocktail_bar",cuisines:[]},
 {id:"long",name:"The Extraordinary Restaurant At Washington Square",category:"restaurant",primaryType:"french_restaurant",cuisines:["French"]},
 {id:"long-bar",name:"An Exceptionally Long Cocktail Lounge",category:"bar",primaryType:"cocktail_bar",cuisines:[]},
 {id:"accent",name:"L'Épicérie Française",category:"restaurant",primaryType:"french_restaurant",cuisines:["French"]},
 {id:"unicode",name:"東京の小さな食堂",category:"restaurant",primaryType:"japanese_restaurant",cuisines:["Japanese"]},
 {id:"unknown",name:"A New Neighborhood Place",category:"restaurant",primaryType:"restaurant",cuisines:[]},
 {id:"american",name:"Corner Diner",category:"restaurant",primaryType:"american_restaurant",cuisines:["American"]},
 {id:"spanish",name:"La Mesa",category:"restaurant",primaryType:"spanish_restaurant",cuisines:["Spanish"]},
 {id:"lebanese",name:"Zaatar",category:"restaurant",primaryType:"lebanese_restaurant",cuisines:["Lebanese"]},
] as const;

export function StampTemplatePreview(){
 const [blob,setBlob]=useState<string|null>(null);
 const [viewSize,setViewSize]=useState<"phone"|"120"|"large">("phone");
 const [paper,setPaper]=useState<"ivory"|"blue"|"white">("ivory");
 useEffect(()=>()=>{if(blob)URL.revokeObjectURL(blob);},[blob]);
 const bg=paper==="ivory"?"#F7F4EE":paper==="blue"?"#D8E5F5":"#FFFFFF";
 return <main style={{minHeight:"100vh",padding:"28px",background:bg,color:"#202626",fontFamily:"system-ui"}}>
  <h1 style={{fontFamily:"Georgia,serif",fontSize:32}}>Nostos · transparent category stamps</h1>
  <p>Production web SVG renderer, development-only. Photo uploads stay in this browser; no server upload is performed.</p>
  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
   <label>Local photo: <input type="file" accept="image/*" onChange={e=>setBlob(e.target.files?.[0]?URL.createObjectURL(e.target.files[0]):null)}/></label>
   <label>Stamp scale: <select value={viewSize} onChange={e=>setViewSize(e.target.value as typeof viewSize)}><option value="phone">Phone half-page (~72px)</option><option value="120">120px comparison</option><option value="large">Enlarged inspection</option></select></label>
   <label>Page paper <select value={paper} onChange={e=>setPaper(e.target.value as typeof paper)}>
    <option value="ivory">Ivory</option><option value="blue">Blue</option><option value="white">White</option>
   </select></label>
  </div>
  <p style={{maxWidth:680,fontSize:13}}>A phone spread fits two small pages: a 180px page makes a 72px stamp at the production 40% slot size. A 120px isolated preview is not evidence that small date/locality lettering can be read on an iPhone.</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:22,marginTop:28}}>
  {examples.map(v=>{const art=resolveCategoryStamp(v);return <section key={v.id} style={{background:bg,padding:10,border:"1px dashed #a2a5a6",minHeight:230}}>
   <div style={{height:185,display:"grid",placeItems:"center"}}>
    <div style={{width:viewSize==="phone"?72:viewSize==="120"?120:art?.kind==="bar"?190:250,height:viewSize==="phone"?72:viewSize==="120"?120:art?.kind==="bar"?190:160}}>
     {art?<CategoryStampSvg artwork={art} name={v.name} locality={v.id==="bar"||v.id==="long-bar"?"West Village":"NEW YORK"} visitedAt="2026-10-20T12:00:00-04:00" localPreviewPhotoUrl={v.id==="unknown"?null:blob}/>:null}
    </div>
   </div>
   <p style={{fontSize:12}}>{v.name} · {art?.label??"legacy"}{v.id==="unknown"?" · no photo":""}</p>
  </section>})}
  </div>
 </main>;
}

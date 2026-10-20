"use client";
import { useEffect, useMemo, useState } from "react";
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
 const [file,setFile]=useState<File|null>(null);
 const blob=useMemo(()=>file?URL.createObjectURL(file):null,[file]);
 const [passport,setPassport]=useState(true);
 const [paper,setPaper]=useState<"ivory"|"blue"|"white">("ivory");
 useEffect(()=>()=>{if(blob)URL.revokeObjectURL(blob);},[blob]);
 const bg=paper==="ivory"?"#F7F4EE":paper==="blue"?"#D8E5F5":"#FFFFFF";
 return <main style={{minHeight:"100vh",padding:"28px",background:bg,color:"#202626",fontFamily:"system-ui"}}>
  <h1 style={{fontFamily:"Georgia,serif",fontSize:32}}>Nostos · transparent category stamps</h1>
  <p>Production web SVG renderer, development-only. Photo uploads stay in this browser; no server upload is performed.</p>
  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
   <label>Local photo: <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
   <label><input type="checkbox" checked={passport} onChange={e=>setPassport(e.target.checked)}/> Real passport-size (120px width)</label>
   <label>Page paper <select value={paper} onChange={e=>setPaper(e.target.value as typeof paper)}>
    <option value="ivory">Ivory</option><option value="blue">Blue</option><option value="white">White</option>
   </select></label>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:22,marginTop:28}}>
  {examples.map(v=>{const art=resolveCategoryStamp(v);return <section key={v.id} style={{background:bg,padding:10,border:"1px dashed #a2a5a6",minHeight:230}}>
   <div style={{height:185,display:"grid",placeItems:"center"}}>
    <div style={{width:passport?120:art?.kind==="bar"?190:250,height:passport?120:art?.kind==="bar"?190:160}}>
     {art?<CategoryStampSvg artwork={art} name={v.name} locality="NEW YORK" visitedAt="2026-10-20T12:00:00-04:00" localPreviewPhotoUrl={blob}/>:null}
    </div>
   </div>
   <p style={{fontSize:12}}>{v.name} · {art?.label??"legacy"}</p>
  </section>})}
  </div>
 </main>;
}

import { notFound } from "next/navigation";
import { resolveCategoryStamp } from "@/lib/category-stamp-artwork";
import { CategoryStampSvg } from "@/app/c/[token]/CategoryStampSvg";

/** Dev-only smoke preview using the *production web* renderer, never fake SVG cards. */
export default function StampTemplatePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const venues = [
    {id:"italian",name:"Via Rosso",category:"restaurant",primaryType:"italian_restaurant",cuisines:["Italian"]},
    {id:"mexican",name:"Casa Sol",category:"restaurant",primaryType:"taco_restaurant",cuisines:["Mexican"]},
    {id:"japanese",name:"Kumo Counter",category:"restaurant",primaryType:"sushi_restaurant",cuisines:["Sushi"]},
    {id:"indian",name:"Masala Club",category:"restaurant",primaryType:"north_indian_restaurant",cuisines:["North Indian"]},
    {id:"unknown",name:"Restaurant With No Cuisine Data",category:"restaurant",primaryType:"restaurant",cuisines:[]},
    {id:"bar",name:"Velvet Hour",category:"bar",primaryType:"cocktail_bar",cuisines:["Italian"]},
    {id:"club",name:"Afterglow Nightclub",category:"bar",primaryType:"night_club",cuisines:[]},
    {id:"long",name:"The Extraordinary Little Restaurant Around the Corner",category:"restaurant",primaryType:"italian_restaurant",cuisines:["Italian"]},
    {id:"multilingual",name:"東京の小さな食堂",category:"restaurant",primaryType:"japanese_restaurant",cuisines:["Japanese"]},
  ] as const;
  return <main style={{background:"#f5f4f1",minHeight:"100vh",padding:32,color:"#1f2524",fontFamily:"system-ui"}}>
    <h1>Nostos · category ink stamp review</h1><p>Development-only preview. No stock/user photos are substituted. Reference mockup is awaiting upload.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
      {venues.map(v=>{const art=resolveCategoryStamp(v);return <section key={v.id} style={{background:"white",padding:12,border:"1px solid #ddd"}}>
        <div style={{height:230,display:"grid",placeItems:"center"}}>{art?<CategoryStampSvg artwork={art} name={v.name} locality="NEW YORK" visitedAt="2026-10-20T12:00:00-04:00"/>:null}</div>
        <p style={{fontSize:13}}>{v.name} · {art?.label??"legacy"} · {art?.version??""}</p>
      </section>})}
    </div>
  </main>;
}

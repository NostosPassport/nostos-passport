import { notFound } from "next/navigation";
import { StampTemplatePreview } from "./StampTemplatePreview";
import { StampSheets } from "./StampSheets";
/** Development-only: uses the same renderers as shared collection pages. `?sheet=reference|long|photos` renders a screenshot sheet. */
export default async function Page({ searchParams }: { searchParams: Promise<{ sheet?: string; bg?: string }> }){
 if(process.env.NODE_ENV!=="development")notFound();
 const q=await searchParams;
 if(q.sheet)return <StampSheets sheet={q.sheet} bg={q.bg??""}/>;
 return <StampTemplatePreview/>;
}

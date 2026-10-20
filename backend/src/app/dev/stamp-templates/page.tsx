import { notFound } from "next/navigation";
import { StampTemplatePreview } from "./StampTemplatePreview";
/** Development-only: uses the same renderer as shared collection pages. */
export default function Page(){
 if(process.env.NODE_ENV!=="development")notFound();
 return <StampTemplatePreview/>;
}

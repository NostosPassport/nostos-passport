import { Redirect } from "expo-router";

/** Collections now live on the gallery's second page. This route stays so older links still land somewhere. */
export default function CollectionsScreen() {
  return <Redirect href={{ pathname: "/gallery", params: { tab: "collections" } }} />;
}

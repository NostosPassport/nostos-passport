import { notFound } from "next/navigation";
import { venueBySlug } from "@/server/queries";

// Existence check lives above the page's loading boundary so unknown venues get a real 404 status.
// It's a single indexed lookup, memoized per request and shared with generateMetadata.
export default async function VenueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  if (!(await venueBySlug((await params).slug))) notFound();
  return children;
}

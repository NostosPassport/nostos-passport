import { notFound } from "next/navigation";
import { userByHandle } from "@/server/queries";

// Real 404 for unknown handles, above the loading boundary.
export default async function ProfileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ handle: string }> }) {
  if (!(await userByHandle((await params).handle))) notFound();
  return children;
}

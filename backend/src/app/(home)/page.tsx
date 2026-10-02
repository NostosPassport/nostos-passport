import { prisma } from "@/lib/db";
import { NavMenu } from "@/components/NavMenu";
import { MapApp } from "@/components/map/MapApp";
import { getCurrentActor } from "@/server/current";
import { listVenuesForMap } from "@/server/services/venues";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getCurrentActor();
  const venues = await listVenuesForMap(prisma, actor);
  return <MapApp initialVenues={venues} signedIn={Boolean(actor)} nav={<NavMenu actor={actor} />} />;
}

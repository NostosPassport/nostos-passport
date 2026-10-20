import { router } from "expo-router";
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";

import { useMe, useUserStamps } from "@/api/queries";
import { LandingScene } from "@/features/book/LandingScene";
import { BOOK_ASPECT } from "@/features/book/dimensions";
import { landingDraft } from "@/features/stamps/landing-draft";

export default function Landed() {
  const landed = landingDraft.peek();
  const { width, height } = useWindowDimensions();
  const me = useMe();
  const stamps = useUserStamps(me.data?.user.handle ?? "", !!landed && !!me.data);

  useEffect(() => {
    if (!landed) router.dismissAll();
  }, [landed]);
  if (!landed) return null;

  const pageWidth = Math.floor(Math.min(width * 0.7, (height * 0.5) / BOOK_ASPECT));
  const others = (stamps.data?.pages ?? []).flatMap((p) => p.stamps).filter((s) => s.page === landed.stamp.page && s.id !== landed.stamp.id);
  return (
    <LandingScene
      stamp={landed.stamp}
      others={others}
      pageWidth={pageWidth}
      pageHeight={Math.floor(pageWidth * BOOK_ASPECT)}
      onDone={() => {
        landingDraft.clear();
        router.dismissAll();
      }}
    />
  );
}

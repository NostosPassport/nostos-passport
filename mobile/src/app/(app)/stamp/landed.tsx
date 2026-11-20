import { router, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { useMe, useUserStamps } from "@/api/queries";
import { LandingScene } from "@/features/book/LandingScene";
import { BOOK_ASPECT } from "@/features/book/dimensions";
import { landingDraft } from "@/features/stamps/landing-draft";
import { colors } from "@/theme";

/** If the fade-in never reports its end, start anyway after this long. */
const TRANSITION_FALLBACK_MS = 600;
/** Wait at most this long for the page's other stamps, so the landing never stalls on a slow network. */
const NEIGHBOURS_WAIT_MS = 1200;

export default function Landed() {
  const landed = landingDraft.peek();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const me = useMe();
  const stamps = useUserStamps(me.data?.user.handle ?? "", !!landed && !!me.data);
  const [transitioned, setTransitioned] = useState(false);
  const [stopWaiting, setStopWaiting] = useState(false);

  useEffect(() => {
    if (!landed) router.dismissAll();
  }, [landed]);

  // Start the landing once the fade transition has finished, so the hover and stamp aren't lost under it (P-108).
  useEffect(() => {
    const done = () => setTransitioned(true);
    const unsubscribe = navigation.addListener("transitionEnd", done);
    const fallback = setTimeout(done, TRANSITION_FALLBACK_MS);
    const cap = setTimeout(() => setStopWaiting(true), NEIGHBOURS_WAIT_MS);
    return () => { unsubscribe(); clearTimeout(fallback); clearTimeout(cap); };
  }, [navigation]);

  if (!landed) return null;

  // Cached pages (even while they refetch) are drawn right away; only a cold cache waits, briefly, so the
  // neighbouring stamps are on the page before the new one lands instead of popping in during the animation.
  const neighboursReady = !stamps.isPending || stopWaiting;
  if (!transitioned || !neighboursReady) return <View style={styles.wait} accessibilityElementsHidden />;

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

const styles = StyleSheet.create({ wait: { flex: 1, backgroundColor: colors.background } });

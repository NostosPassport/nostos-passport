import { router } from "expo-router";
import { useEffect, useMemo, useReducer, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { bookMotion, size, space } from "@/theme";
import { BearerPage } from "./BearerPage";
import { type Phase, type PhaseEvent, isOpenish, nextPhase, spreadLabel, stageTransform } from "./book-state";
import { Counts, Cover } from "./Cover";
import { bookSize, openScale } from "./dimensions";
import { FlipBook } from "./FlipBook";
import { InsideCover } from "./InsideCover";
import { OpeningCover } from "./OpeningCover";
import { PageView } from "./PageView";
import { type PageFace, groupByPage, pageCountFor, spreadCountFor } from "./spreads";
import { usePassport } from "./use-passport";

/**
 * Your passport as a book: the cover, which opens on a tap to the bearer page, then spreads of stamps you turn with a finger
 * or a tap on the edge. Everything here is yours alone to see.
 */
export function PassportBook() {
  const data = usePassport();
  const { width: sw, height: sh } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [phase, send] = useReducer((p: Phase, e: PhaseEvent) => nextPhase(p, e), "closed" as Phase);
  const [spread, setSpread] = useState(0);

  const book = useMemo(() => bookSize(sw, sh), [sw, sh]);
  const fit = useMemo(() => openScale(sw, book, space.md), [sw, book]);
  const open = useSharedValue(0);
  useEffect(() => {
    const target = isOpenish(phase) ? 1 : 0;
    open.value = reduced ? withTiming(target, { duration: bookMotion.durations.crossfade }) : withSpring(target, bookMotion.coverOpen);
  }, [phase, reduced, open]);
  const stage = useAnimatedStyle(() => {
    const t = stageTransform(open.value, book.pageWidth, fit);
    return { transform: [{ translateX: t.translateX }, { scale: t.scale }] };
  });

  const byPage = useMemo(() => groupByPage(data.stamps), [data.stamps]);
  const pinnedIds = useMemo(() => data.pins.map((s) => s.id), [data.pins]);
  const pages = pageCountFor(data.counts.stamps);
  const spreads = spreadCountFor(data.counts.stamps);
  const bearer = { displayName: data.displayName, handle: data.handle, memberSince: data.memberSince, bio: data.bio };

  if (data.status === "error") {
    return (
      <View style={styles.center}>
        <InlineError message="Couldn't open your passport. Your connection may be down." onRetry={data.retry} />
      </View>
    );
  }
  if (data.status === "pending") {
    return (
      <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLabel="Opening your passport">
        <Skeleton width={book.width} height={book.height} />
      </View>
    );
  }

  const bearerFace = <BearerPage width={book.pageWidth} height={book.pageHeight} bearer={bearer} avatarUrl={data.avatarUrl} />;
  const renderFace = (face: PageFace, side: "left" | "right") => {
    if (face.kind === "inside-cover") return <InsideCover width={book.pageWidth} height={book.pageHeight} />;
    if (face.kind === "bearer") return bearerFace;
    return (
      <PageView
        page={face.page}
        side={side}
        width={book.pageWidth}
        height={book.pageHeight}
        stamps={byPage.get(face.page) ?? []}
        pinnedIds={pinnedIds}
        onStampPress={(s) => router.push({ pathname: "/stamp/[id]", params: { id: s.id } })}
      />
    );
  };

  const cover = (
    <Cover width={book.width} height={book.height} counts={data.counts} name={data.displayName} showCounts={false} onOpen={() => send("tapCover")} />
  );
  const go = (to: number) => setSpread(Math.max(0, Math.min(spreads - 1, to)));

  return (
    <View style={styles.root}>
      <View style={styles.stageWrap}>
        <Animated.View style={[{ width: book.pageWidth * 2, height: book.pageHeight }, stage]}>
          {phase === "open" ? (
            <FlipBook pageWidth={book.pageWidth} pageHeight={book.pageHeight} total={spreads} spread={spread} onSpreadChange={setSpread} onCloseBook={() => { setSpread(0); send("closeBook"); }} renderFace={renderFace} />
          ) : (
            <View style={[styles.rightHalf, { left: book.pageWidth, width: book.width, height: book.height }]}>
              <OpeningCover
                width={book.width}
                height={book.height}
                open={phase === "opening"}
                initialOpen={phase === "closing"}
                outside={cover}
                page={bearerFace}
                onSettled={() => send("coverSettled")}
              />
            </View>
          )}
        </Animated.View>
      </View>
      <View style={styles.footer}>
        {phase === "closed" ? (
          <Counts counts={data.counts} />
        ) : phase === "open" ? (
          <View style={styles.pager}>
            <Pressable onPress={() => (spread === 0 ? send("closeBook") : go(spread - 1))} accessibilityRole="button" accessibilityLabel={spread === 0 ? "Close the passport" : "Previous page"} hitSlop={space.sm} style={styles.pagerButton}>
              <Icon name={spread === 0 ? "xmark" : "chevron.left"} color="accent" size={size.icon} />
            </Pressable>
            <Text variant="typewriterSmall" color="dimBrass" accessibilityLiveRegion="polite">
              {spreadLabel(spread, pages)}
            </Text>
            <Pressable onPress={() => go(spread + 1)} disabled={spread >= spreads - 1} accessibilityRole="button" accessibilityLabel="Next page" accessibilityState={{ disabled: spread >= spreads - 1 }} hitSlop={space.sm} style={styles.pagerButton}>
              <Icon name="chevron.right" color={spread >= spreads - 1 ? "textTertiary" : "accent"} size={size.icon} />
            </Pressable>
          </View>
        ) : null}
        {data.counts.stamps === 0 && phase === "open" ? (
          <Text variant="callout" color="textSecondary" align="center">
            Your first page is empty. Go to a place and stamp it.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  stageWrap: { alignItems: "center", justifyContent: "center" },
  rightHalf: { position: "absolute", top: 0 },
  footer: { minHeight: size.hitTarget, alignItems: "center", gap: space.sm },
  pager: { flexDirection: "row", alignItems: "center", gap: space.xl },
  pagerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});

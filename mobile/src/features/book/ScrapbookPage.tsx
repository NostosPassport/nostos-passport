/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { mediaUrl } from "@/api";
import type { StampPhotoView } from "@/api/contracts";
import { Text } from "@/components/ui/text";
import { bookMotion, bookStyle, colors, radius, shadows, space } from "@/theme";
import { PageStock } from "./PageStock";
import { type PhotoSpot, bringToFront, layoutRequest, photoShare, resolveLayout } from "./scrapbook";
import { clampCenter } from "./zoom";

type Item = { id: string; photo: StampPhotoView; spot: PhotoSpot };

type Props = {
  stampId: string;
  photos: readonly StampPhotoView[];
  width: number;
  height: number;
  /** Only the owner can rearrange. */
  editable: boolean;
  /** Called with the body to save when a photo is dropped. */
  onLayout: (body: ReturnType<typeof layoutRequest>) => void;
  onOpenPhoto: (index: number) => void;
};

/**
 * The right-hand page: up to six photos stuck down at an angle. The owner drags them about; the one being dragged comes to the top,
 * and where they end up is saved. Tap a photo to see it full screen.
 */
export function ScrapbookPage({ stampId, photos, width, height, editable, onLayout, onOpenPhoto }: Props) {
  // What is on the page: the server's layout, unless the owner has just moved something (kept until the server's layout changes).
  const key = photos.map((p) => `${p.id}:${p.position}:${p.x}:${p.y}:${p.rotation}`).join("|");
  const [local, setLocal] = useState<{ key: string; items: Item[] } | null>(null);
  const items: Item[] = local && local.key === key ? local.items : resolveLayout(photos, stampId).map((r) => ({ id: r.photo.id, photo: r.photo, spot: r.spot }));

  const photoSize = Math.round(width * photoShare(items.length));
  const drop = (id: string, spot: PhotoSpot) => {
    const moved = items.map((it) => (it.id === id ? { ...it, spot } : it));
    const next = bringToFront(moved, id);
    setLocal({ key, items: next });
    onLayout(layoutRequest(next));
  };

  return (
    <PageStock width={width} height={height} spine="left">
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="typewriterSmall" color="boneFaint" align="center">
            no photos on this page
          </Text>
        </View>
      ) : null}
      {items.map((it, i) => (
        <ScrapPhoto key={it.id} item={it} index={i} size={photoSize} pageW={width} pageH={height} editable={editable} onDrop={drop} onOpen={() => onOpenPhoto(photos.findIndex((p) => p.id === it.id))} total={items.length} />
      ))}
    </PageStock>
  );
}

function ScrapPhoto({ item, index, size, pageW, pageH, editable, onDrop, onOpen, total }: { item: Item; index: number; size: number; pageW: number; pageH: number; editable: boolean; onDrop: (id: string, spot: PhotoSpot) => void; onOpen: () => void; total: number }) {
  const cx = useSharedValue(item.spot.x * pageW);
  const cy = useSharedValue(item.spot.y * pageH);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    cx.value = item.spot.x * pageW;
    cy.value = item.spot.y * pageH;
  }, [item.spot.x, item.spot.y, pageW, pageH, cx, cy]);
  const rotation = item.spot.rotation;

  const drop = (x: number, y: number) => onDrop(item.id, { x: x / pageW, y: y / pageH, rotation });
  const pan = Gesture.Pan()
    .withTestId(`photo-pan-${item.id}`)
    .enabled(editable)
    .onBegin(() => {
      sx.value = cx.value;
      sy.value = cy.value;
      lift.value = withSpring(1, bookMotion.snap);
    })
    .onUpdate((e) => {
      const c = clampCenter(sx.value + e.translationX, sy.value + e.translationY, size, pageW, pageH);
      cx.value = c.cx;
      cy.value = c.cy;
    })
    .onEnd(() => {
      scheduleOnRN(drop, cx.value, cy.value);
    })
    .onFinalize(() => {
      lift.value = withSpring(0, bookMotion.snap);
    });
  const tap = Gesture.Tap()
    .withTestId(`photo-tap-${item.id}`)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(onOpen);
    });
  const style = useAnimatedStyle(() => ({
    left: cx.value - size / 2,
    top: cy.value - size / 2,
    transform: [{ rotate: `${rotation}deg` }, { scale: 1 + lift.value * 0.06 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[styles.photo, { width: size, height: size, zIndex: index }, style]}
        accessible
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo ${index + 1} of ${total}`}
        accessibilityHint={editable ? "Opens it full screen. Drag to move it on the page." : "Opens it full screen"}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={onOpen}
      >
        <Image source={{ uri: mediaUrl(item.photo.url), cacheKey: item.photo.id }} style={styles.fill} contentFit="cover" transition={150} accessible={false} />
        <View pointerEvents="none" style={styles.pin} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  photo: { position: "absolute", padding: space.xxs, borderRadius: radius.chip / 4, backgroundColor: colors.elevated, borderWidth: bookStyle.pageLine, borderColor: colors.dimBrass, ...shadows.contact },
  fill: { flex: 1 },
  pin: { position: "absolute", top: -space.xxs, alignSelf: "center", width: space.xs, height: space.xs, borderRadius: space.xxs, backgroundColor: colors.brass },
});

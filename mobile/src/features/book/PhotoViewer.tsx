import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { mediaUrl } from "@/api";
import type { StampPhotoView } from "@/api/contracts";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { bookMotion, colors, size, space } from "@/theme";
import { clampPan, clampScale, doubleTapScale } from "./zoom";

type Props = { photos: readonly StampPhotoView[]; index: number | null; onClose: () => void };

/** A photo full screen: pinch to zoom up to four times, drag when zoomed, double tap to zoom in and out. Several photos: step through them. */
export function PhotoViewer({ photos, index, onClose }: Props) {
  const [current, setCurrent] = useState<number | null>(null);
  const shown = index === null ? null : (current ?? index);
  const close = () => {
    setCurrent(null);
    onClose();
  };
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        {shown !== null && photos[shown] ? <ZoomableImage key={photos[shown]!.id} uri={mediaUrl(photos[shown]!.url)} /> : null}
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={space.sm} style={styles.close}>
          <Icon name="xmark" color="accent" size={size.icon} />
        </Pressable>
        {shown !== null && photos.length > 1 ? (
          <View style={styles.pager}>
            <Pressable onPress={() => setCurrent(Math.max(0, shown - 1))} disabled={shown === 0} accessibilityRole="button" accessibilityLabel="Previous photo" hitSlop={space.sm} style={styles.pagerButton}>
              <Icon name="chevron.left" color={shown === 0 ? "textTertiary" : "accent"} size={size.icon} />
            </Pressable>
            <Text variant="typewriterSmall" color="dimBrass" accessibilityLiveRegion="polite">
              {shown + 1} of {photos.length}
            </Text>
            <Pressable onPress={() => setCurrent(Math.min(photos.length - 1, shown + 1))} disabled={shown === photos.length - 1} accessibilityRole="button" accessibilityLabel="Next photo" hitSlop={space.sm} style={styles.pagerButton}>
              <Icon name="chevron.right" color={shown === photos.length - 1 ? "textTertiary" : "accent"} size={size.icon} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function ZoomableImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .withTestId("viewer-pinch")
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clampScale(startScale.value * e.scale);
    })
    .onEnd(() => {
      const p = clampPan(tx.value, ty.value, scale.value, width, height);
      tx.value = withSpring(p.tx, bookMotion.snap);
      ty.value = withSpring(p.ty, bookMotion.snap);
    });
  const pan = Gesture.Pan()
    .withTestId("viewer-pan")
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const p = clampPan(startX.value + e.translationX, startY.value + e.translationY, scale.value, width, height);
      tx.value = p.tx;
      ty.value = p.ty;
    });
  const double = Gesture.Tap()
    .withTestId("viewer-double-tap")
    .numberOfTaps(2)
    .onEnd(() => {
      const next = doubleTapScale(scale.value);
      scale.value = withSpring(next, bookMotion.snap);
      if (next === 1) {
        tx.value = withSpring(0, bookMotion.snap);
        ty.value = withSpring(0, bookMotion.snap);
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, double)}>
      <Animated.View style={[styles.fill, style]} accessible accessibilityLabel="Photo. Pinch to zoom, double tap to zoom in or out.">
        <Image source={{ uri }} style={styles.fill} contentFit="contain" accessible={false} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  fill: { flex: 1 },
  close: { position: "absolute", top: space.xxxl + space.md, right: space.md, minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  pager: { position: "absolute", bottom: space.xxxl, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.xl },
  pagerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});

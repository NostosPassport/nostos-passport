/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { bookMotion, bookStyle, colors, radius, screenPadding, shadows, size, space } from "@/theme";
import { type SheetModel, sheetShouldClose } from "./map-model";

const HEIGHT = size.heroHeight;

/** The bottom sheet for the pin you tapped: its name, where it is, whether you've stamped it, and how far you are. Swipe it down to close. */
export function PlaceSheet({ model, onClose, onStamp, onOpenPlace }: { model: SheetModel | null; onClose: () => void; onStamp: () => void; onOpenPlace?: () => void }) {
  const y = useSharedValue<number>(HEIGHT);
  const startY = useSharedValue(0);
  useEffect(() => {
    y.value = withSpring(model ? 0 : HEIGHT, bookMotion.snap);
  }, [model, y]);

  const drag = Gesture.Pan()
    .withTestId("sheet-pan")
    .onBegin(() => {
      startY.value = y.value;
    })
    .onUpdate((e) => {
      y.value = Math.max(0, startY.value + e.translationY);
    })
    .onEnd((e) => {
      if (sheetShouldClose(e.translationY, e.velocityY, HEIGHT)) scheduleOnRN(onClose);
      else y.value = withSpring(0, bookMotion.snap);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!model) return null;
  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.sheet, style]} accessibilityViewIsModal={false}>
        <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View style={styles.headRow}>
          <View style={styles.names}>
            <Text variant="title2" color="brass" numberOfLines={2} accessibilityRole="header">
              {model.title}
            </Text>
            {model.subtitle ? (
              <Text variant="typewriterSmall" color="textSecondary">
                {model.subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={space.sm} style={styles.close}>
            <Icon name="xmark" color="dimBrass" size={size.iconSmall} />
          </Pressable>
        </View>
        <Text variant="typewriter" color="textPrimary">
          {model.status}
        </Text>
        {model.distance ? (
          <Text variant="typewriterSmall" color="dimBrass">
            {model.distance}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {model.canStamp ? <Button title="Stamp here" icon="seal.fill" block={false} onPress={onStamp} /> : null}
          {onOpenPlace ? <Button title="Place page" variant="secondary" block={false} onPress={onOpenPlace} /> : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, minHeight: HEIGHT, padding: screenPadding, paddingBottom: space.xxxl, gap: space.xs,
    backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderTopWidth: bookStyle.pageLine, borderColor: colors.dimBrass, ...shadows.soft,
  },
  grabber: { alignSelf: "center", width: size.avatarLarge / 2, height: space.xxs, borderRadius: radius.pill, backgroundColor: colors.boneFaint },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  names: { flex: 1, gap: space.xxs },
  close: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
});

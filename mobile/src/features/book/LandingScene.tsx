import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { mediaUrl } from "@/api";
import type { StampView } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/haptics";
import { localityKey, localityLabel } from "@/lib/place";
import { colors, radius, shadows, size, space } from "@/theme";
import { LANDING, landingFrame } from "./landing";
import { landingCopy, photoPins } from "./landing-copy";
import { PageView } from "./PageView";
import { slotPlacement } from "./slots";
import { StampMark } from "./StampMark";

type Props = {
  stamp: StampView;
  others: StampView[];
  pageWidth: number;
  pageHeight: number;
  onDone: () => void;
};

export function LandingScene({ stamp, others, pageWidth: pw, pageHeight: ph, onDone }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const page = stamp.page ?? 1;
  const slot = stamp.slot ?? 1;
  const place = slotPlacement(stamp.id, slot, pw, ph);
  const copy = landingCopy(stamp.page);
  const pins = photoPins(stamp.photos.length, pw, stamp.id);

  useEffect(() => {
    t.value = withTiming(LANDING.total, { duration: LANDING.total, easing: Easing.linear });
    const knock = setTimeout(() => haptics.success(), reduced ? 0 : LANDING.impact);
    return () => clearTimeout(knock);
  }, [t, reduced]);

  const page$ = useAnimatedStyle(() => {
    const f = landingFrame(t.value, reduced);
    return { transform: [{ translateX: f.shakeX }, { translateY: f.shakeY }] };
  });
  const stamp$ = useAnimatedStyle(() => {
    const f = landingFrame(t.value, reduced);
    return { opacity: f.opacity, transform: [{ rotate: `${place.rotation}deg` }, { scale: f.scale }] };
  });
  const glow$ = useAnimatedStyle(() => ({ opacity: landingFrame(t.value, reduced).glow }));
  const ink$ = useAnimatedStyle(() => {
    const f = landingFrame(t.value, reduced);
    return { opacity: reduced ? 0 : (1 - f.inkSpread) * 0.6, transform: [{ scale: 0.8 + f.inkSpread * 0.5 }] };
  });
  const pin$ = useAnimatedStyle(() => ({ opacity: t.value > LANDING.impact + LANDING.ink ? 1 : 0 }));

  const spot = { position: "absolute" as const, left: place.cx - place.size / 2, top: place.cy - place.size / 2, width: place.size, height: place.size };
  return (
    <View style={styles.root}>
      <Animated.View style={[{ width: pw, height: ph }, page$]}>
        <PageView page={page} side={page % 2 === 1 ? "left" : "right"} width={pw} height={ph} stamps={others} />
        <Animated.View pointerEvents="none" style={[spot, styles.glow, { borderRadius: place.size / 2 }, glow$]} />
        <Animated.View pointerEvents="none" style={[spot, styles.ink, { borderRadius: place.size / 2 }, ink$]} />
        <Animated.View style={[spot, stamp$]} accessible accessibilityLabel={`New stamp, ${stamp.place.name}, page ${page}, slot ${slot}`}>
          <StampMark input={{ placeId: stamp.place.id, placeName: stamp.place.name, localityKey: localityKey(stamp.place), localityName: localityLabel(stamp.place) }} size={place.size} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.pins, pin$]}>
          {pins.map((p, i) => (
            <View key={i} style={[styles.photo, { left: p.cx - p.size / 2, width: p.size, height: p.size, transform: [{ rotate: `${p.rotation}deg` }] }]}>
              <Image source={{ uri: mediaUrl(stamp.photos[i]!.url) }} style={styles.fill} contentFit="cover" accessible={false} />
              <View style={styles.pin} />
            </View>
          ))}
        </Animated.View>
      </Animated.View>
      <View style={styles.words} accessibilityLiveRegion="polite">
        <Text variant="title2" color="brass" align="center">{copy}</Text>
      </View>
      <View style={styles.done}>
        <Button title="Done" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xl, backgroundColor: colors.background },
  glow: { backgroundColor: colors.brassGlow, ...shadows.glow },
  ink: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brass, backgroundColor: colors.brassGlowSoft },
  pins: { position: "absolute", left: 0, right: 0, bottom: space.xl, height: space.xxxl * 2 },
  photo: { position: "absolute", top: 0, borderRadius: radius.chip / 4, overflow: "hidden", backgroundColor: colors.elevated, ...shadows.contact },
  fill: { width: "100%", height: "100%" },
  pin: { position: "absolute", top: space.xxs, alignSelf: "center", width: space.xs, height: space.xs, borderRadius: space.xxs, backgroundColor: colors.brass },
  words: { alignItems: "center", gap: space.xs, paddingHorizontal: space.lg },
  done: { width: size.heroHeight },
});

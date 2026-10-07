/**
 * The 3D passport: a GLView and a finger. All loop logic is in `LabLoop` (paused unless focused, active and visible;
 * capped frame rate; disposed on unmount). The GL surface is sized for a capped pixel ratio and scaled up by the compositor.
 */
import { GLView } from "expo-gl";
import { memo, useEffect, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";

import { colors } from "@/theme";
import { pixelRatioFor } from "./frame-cap";
import { LabLoop, type LoopProps } from "./lab-loop";

function Passport3DViewBase(props: LoopProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [loop] = useState(() => new LabLoop(props));
  const dpr = PixelRatio.get();
  const scale = dpr / pixelRatioFor(dpr, props.lowPower);

  useEffect(() => {
    loop.update(props);
  });
  useEffect(() => () => loop.dispose(), [loop]);

  return (
    <View
      style={styles.fill}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      {...loop.pan.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Open your passport"
      accessibilityHint="Tap to read. Drag to rotate the 3D cover."
      onAccessibilityTap={props.onTap}
    >
      {box.width > 0 ? (
        <GLView
          key={props.lowPower ? "low-power" : "full"}
          style={{ width: box.width / scale, height: box.height / scale, transform: [{ scale }] }}
          onContextCreate={(gl) => void loop.attach(gl)}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

export const Passport3DView = memo(Passport3DViewBase);

const styles = StyleSheet.create({ fill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, overflow: "hidden" } });

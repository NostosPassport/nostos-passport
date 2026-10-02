import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type SymbolName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors, dimmedOpacity, hairlineWidth, radius, size, space } from "@/theme";
import { cooldownLine, type ReportKind } from "./cooldowns";
import { outsideMessage, type ReportBarState } from "./report-bar-state";

type Props = {
  state: ReportBarState;
  /** The server's latest cooldown sentence for this venue, if any. */
  notice: { kind: ReportKind; message: string } | null;
  onReport: (kind: Exclude<ReportKind, "PHOTO">) => void;
  onCamera: () => void;
  onSignIn: () => void;
  onEnableLocation: () => void;
  onOpenSettings: () => void;
};

const ACTIONS: { kind: Exclude<ReportKind, "PHOTO">; label: string; icon: SymbolName }[] = [
  { kind: "VIBE", label: "Vibe", icon: "waveform" },
  { kind: "LINE", label: "Line", icon: "person.3.sequence.fill" },
  { kind: "COVER", label: "Cover", icon: "dollarsign.circle.fill" },
];

/** Floating bar at the bottom of the venue screen: Vibe, Line, Cover and the camera. */
export function ReportBar({ state, notice, onReport, onCamera, onSignIn, onEnableLocation, onOpenSettings }: Props) {
  if (state.kind === "hidden") return null;

  if (state.kind === "signin" || state.kind === "needs-location" || state.kind === "location-denied") {
    const cta =
      state.kind === "signin"
        ? { text: "Sign in to post what it's like here", action: onSignIn, icon: "person.crop.circle" as SymbolName }
        : state.kind === "needs-location"
          ? { text: "Share your location to post", action: onEnableLocation, icon: "location.fill" as SymbolName }
          : { text: "Turn on location in Settings to post", action: onOpenSettings, icon: "gearshape.fill" as SymbolName };
    return (
      <Surface>
        <Pressable onPress={cta.action} accessibilityRole="button" accessibilityLabel={cta.text} style={styles.cta} testID="report-bar-cta">
          <Icon name={cta.icon} color="accent" size={size.icon} />
          <Text variant="headline" style={styles.flex} numberOfLines={2}>
            {cta.text}
          </Text>
          <Icon name="chevron.right" color="textTertiary" size={size.iconSmall} />
        </Pressable>
      </Surface>
    );
  }

  const outside = state.kind === "outside";
  const message = outside ? outsideMessage(state.distanceM) : notice ? cooldownLine(notice.kind) : null;
  return (
    <Surface>
      {message && (
        <View style={styles.message} testID="report-bar-message">
          <Icon name={outside ? "location.slash" : "clock"} color={outside ? "textSecondary" : "warning"} size={size.iconTiny} />
          <Text variant="footnote" color={outside ? "textSecondary" : "textPrimary"} style={styles.flex}>
            {message}
          </Text>
        </View>
      )}
      <View style={[styles.row, outside && styles.dimmed]} testID="report-bar-actions">
        {ACTIONS.map((a) => {
          const coolingDown = !outside && notice?.kind === a.kind;
          return (
            <Pressable
              key={a.kind}
              onPress={() => onReport(a.kind)}
              disabled={outside}
              accessibilityRole="button"
              accessibilityLabel={`Report ${a.label.toLowerCase()}`}
              accessibilityState={{ disabled: outside }}
              accessibilityHint={outside ? outsideMessage(state.distanceM) : coolingDown && notice ? cooldownLine(notice.kind) : undefined}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Icon name={coolingDown ? "clock" : a.icon} color={coolingDown ? "warning" : "textPrimary"} size={size.icon} />
              <Text variant="caption" weight="semibold" color="textSecondary">
                {a.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onCamera}
          disabled={outside}
          accessibilityRole="button"
          accessibilityLabel="Post a photo"
          accessibilityState={{ disabled: outside }}
          style={({ pressed }) => [styles.camera, pressed && { backgroundColor: colors.accentPressed }]}
        >
          <Icon name="camera.fill" color="onAccent" size={size.icon} />
        </Pressable>
      </View>
    </Surface>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.shadow}>
      <BlurView intensity={80} tint="dark" style={styles.surface}>
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.largeCard,
    shadowColor: colors.background,
    shadowOpacity: 0.6,
    shadowRadius: space.lg,
    shadowOffset: { width: 0, height: space.xs },
  },
  surface: {
    borderRadius: radius.largeCard,
    overflow: "hidden",
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.scrim,
  },
  row: { flexDirection: "row", alignItems: "center", minHeight: size.reportBarHeight, paddingHorizontal: space.xs, gap: space.xxs },
  dimmed: { opacity: dimmedOpacity },
  action: { flex: 1, minHeight: size.hitTarget + space.xs, alignItems: "center", justifyContent: "center", gap: space.xxs, borderRadius: radius.button },
  pressed: { backgroundColor: colors.pressedOverlay },
  camera: {
    width: size.hitTarget + space.xs,
    height: size.hitTarget + space.xs,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space.xxs,
  },
  message: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, paddingTop: space.sm },
  cta: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.reportBarHeight, paddingHorizontal: space.md },
  flex: { flex: 1 },
});

import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { colors, dimmedOpacity, radius, size, space, type ColorToken } from "@/theme";
import { Icon, type SymbolName } from "./icon";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "plain" | "destructive";

type Props = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: Variant;
  icon?: SymbolName;
  loading?: boolean;
  /** Stretch to the container width (default true). */
  block?: boolean;
  compact?: boolean;
};

const fg: Record<Variant, ColorToken> = {
  primary: "onAccent",
  secondary: "textPrimary",
  plain: "accent",
  destructive: "danger",
};

export function Button({ title, variant = "primary", icon, loading, block = true, compact, disabled, accessibilityLabel, ...rest }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={compact ? space.xs : undefined}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        block ? styles.block : styles.inline,
        variant === "primary" && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        variant === "secondary" && { backgroundColor: pressed ? colors.surface : colors.elevated },
        (variant === "plain" || variant === "destructive") && pressed && { backgroundColor: colors.pressedOverlay },
        disabled && !loading && { opacity: dimmedOpacity },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={colors[fg[variant]]} />
        ) : (
          <>
            {icon && <Icon name={icon} color={fg[variant]} size={size.iconSmall} />}
            <Text variant="headline" color={fg[variant]} numberOfLines={2} align="center" style={styles.title}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.buttonHeight,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  compact: { minHeight: size.hitTarget, paddingHorizontal: space.md },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingVertical: space.xs },
  title: { flexShrink: 1 },
});

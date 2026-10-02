import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { mediaUrl } from "@/api";
import { initial } from "@/lib/format";
import { avatarOverlap, colors, hairlineWidth, size as sizes, type TypeVariant } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

type Props = {
  name: string | null | undefined;
  /** Profile photo. null when there is none or the viewer may not see it (private account): show the initial. */
  uri?: string | null;
  size?: number;
  variant?: TypeVariant;
};

/** Profile photo, or the initial on an elevated circle. With no name either, a generic person symbol. */
export function Avatar({ name, uri, size = sizes.avatar, variant = "headline" }: Props) {
  const circle = [styles.circle, { width: size, height: size, borderRadius: size / 2 }];
  if (uri) {
    return <Image source={{ uri: mediaUrl(uri) }} style={circle} contentFit="cover" transition={150} accessible={false} />;
  }
  return (
    <View style={circle} accessible={false}>
      {name ? (
        <Text variant={variant} color="textSecondary" weight="semibold" maxFontSizeMultiplier={1}>
          {initial(name)}
        </Text>
      ) : (
        <Icon name="person.fill" color="textTertiary" size={size / 2} />
      )}
    </View>
  );
}

/** Up to three overlapping avatars. The row around it carries the spoken label. */
export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <View style={styles.stack} accessible={false}>
      {shown.map((n, i) => (
        <View key={`${n}-${i}`} style={[styles.ring, i > 0 && styles.overlap]}>
          <Avatar name={n} size={sizes.avatarSmall} variant="caption" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", borderWidth: hairlineWidth, borderColor: colors.hairline },
  stack: { flexDirection: "row" },
  ring: { borderRadius: sizes.avatarSmall, borderWidth: sizes.markerRing, borderColor: colors.surface },
  overlap: { marginLeft: avatarOverlap },
});

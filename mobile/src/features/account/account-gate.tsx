import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useAccountState } from "@/auth/account-state";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";

export function AccountGate({ children }: { title: string; message: string; children: ReactNode }) {
  const { state, retry, retrying } = useAccountState();
  if (state === "ready") return <>{children}</>;
  return (
    <View style={styles.root}>
      {state === "checking" && (
        <View style={styles.block} accessibilityRole="progressbar" accessibilityLabel="Checking your account">
          <Skeleton width={size.avatarLarge} height={size.avatarLarge} round />
          <Text variant="headline">Checking your account</Text>
          <Text variant="callout" color="textSecondary">One moment.</Text>
        </View>
      )}
      {state === "error" && (
        <View style={styles.block}>
          <InlineError message="Couldn't check your account. Your connection may be down." onRetry={retry} retrying={retrying} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, justifyContent: "center", paddingHorizontal: screenPadding },
  block: { alignItems: "center", gap: space.sm },
});

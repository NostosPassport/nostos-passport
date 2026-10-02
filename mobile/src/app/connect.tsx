import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { colors, screenPadding, space } from "@/theme";

/**
 * Signed in, but the account hasn't loaded yet (just signed in, or offline at launch). The app
 * waits here so the Terms check can't be skipped.
 */
export default function Connect() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { signOut } = useAuth();
  const failed = me.isError || (me.isPending && me.fetchStatus === "paused");

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
      <BrandMark />
      <View style={styles.center}>
        {failed ? (
          <InlineError
            message={me.isError ? errorText(me.error, "Couldn't load your account. Try again.") : "You're offline. Connect to the internet to continue."}
            onRetry={() => void me.refetch()}
            retrying={me.isFetching}
          />
        ) : (
          <ActivityIndicator color={colors.textSecondary} accessibilityLabel="Loading your account" />
        )}
      </View>
      {failed && <Button title="Sign out" variant="plain" onPress={() => void signOut()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding },
  center: { flex: 1, justifyContent: "center" },
});

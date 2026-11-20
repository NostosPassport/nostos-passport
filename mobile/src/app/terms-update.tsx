import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
import { qk, useMe } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { LEGAL, openWebPage } from "@/lib/links";
import { colors, fonts, screenPadding, space } from "@/theme";

export default function TermsUpdate() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();
  const version = me.data?.terms.currentVersion;

  const accept = useMutation({
    mutationFn: () => api.me.acceptTerms(version ?? ""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">Updated terms</Text>
        <Text color="textSecondary">We&apos;ve updated our Terms and Privacy policy. Review them to keep using Nostos.</Text>
        <View style={styles.links}>
          <Button title="Read the Terms" variant="secondary" onPress={() => openWebPage(LEGAL.terms)} />
          <Button title="Read the Privacy policy" variant="secondary" onPress={() => openWebPage(LEGAL.privacy)} />
        </View>
      </View>
      <View style={styles.actions}>
        {accept.error && <InlineError message={errorText(accept.error, "Couldn't save that. Try again.")} />}
        <Button title="Agree and continue" onPress={() => accept.mutate()} loading={accept.isPending} disabled={!version} />
        <Button title="Sign out" variant="plain" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  root: { flexGrow: 1, paddingHorizontal: screenPadding, justifyContent: "space-between", gap: space.xl },
  body: { gap: space.md, paddingTop: space.xl },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7 },
  links: { gap: space.sm, marginTop: space.sm },
  actions: { gap: space.sm },
});

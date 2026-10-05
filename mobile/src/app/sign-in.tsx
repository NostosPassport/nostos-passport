import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
import { useAuth } from "@/auth/auth-context";
import { InlineError } from "@/components/ui/inline-error";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";
import { colors, fonts } from "@/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const login = useMutation({
    mutationFn: () => api.auth.login({ email: email.trim(), password }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const canSubmit = email.trim().length > 0 && password.length > 0;
  const submit = () => {
    if (!canSubmit || login.isPending) return;
    if (!isEmail(email)) {
      haptics.warning();
      setEmailError("Enter a valid email address.");
      return;
    }
    login.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.content, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.wordmark}>NOSTOS</Text>
        <View style={styles.collagePlaceholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.collageInk} />
          <Text style={styles.collageGlyph}>N</Text>
          <View style={styles.collageAccentA} />
          <View style={styles.collageAccentB} />
        </View>
        <Text style={styles.headline}>Find your{`\n`}way back.</Text>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@domain.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setEmailError(null);
              }}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
            />
          </View>
          {emailError ? <InlineError message={emailError} /> : null}
          {login.error ? <InlineError message={errorText(login.error, "Couldn't sign in. Check your email and password and try again.")} /> : null}
          <Pressable onPress={submit} disabled={!canSubmit || login.isPending} style={({ pressed }) => [styles.signIn, (!canSubmit || login.isPending) && styles.disabled, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.signInText}>{login.isPending ? "Signing in…" : "Sign in  ↗"}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push("/sign-up")} style={styles.create} accessibilityRole="button">
          <Text style={styles.createText}>New here? Create a passport</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 64, lineHeight: 68, letterSpacing: -2.5, paddingHorizontal: 24 },
  collagePlaceholder: { height: 299, overflow: "hidden", backgroundColor: colors.elevated, position: "relative" },
  collageInk: { position: "absolute", width: 270, height: 270, borderRadius: 135, backgroundColor: colors.textPrimary, opacity: 0.9, left: 58, top: 18 },
  collageGlyph: { position: "absolute", color: colors.background, fontFamily: fonts.serifRegular, fontSize: 238, lineHeight: 250, left: 110, top: 12 },
  collageAccentA: { position: "absolute", width: 176, height: 54, backgroundColor: colors.accent, left: -12, bottom: 22, transform: [{ rotate: "-8deg" }] },
  collageAccentB: { position: "absolute", width: 156, height: 48, backgroundColor: colors.accent, right: -18, top: 46, transform: [{ rotate: "7deg" }] },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 62, lineHeight: 54, letterSpacing: -1.5, paddingHorizontal: 24, paddingTop: 12 },
  form: { paddingHorizontal: 24, paddingTop: 18, gap: 16 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  input: { height: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  signIn: { height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  signInText: { color: colors.onAccent, fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  create: { marginTop: "auto", minHeight: 44, alignItems: "center", justifyContent: "center" },
  createText: { color: colors.accent, fontSize: 13 },
});

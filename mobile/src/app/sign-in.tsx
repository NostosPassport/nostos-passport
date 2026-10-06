import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
import { farewellNotice, useAuth } from "@/auth/auth-context";
import { InlineError } from "@/components/ui/inline-error";
import { haptics } from "@/lib/haptics";
import { colors, fonts } from "@/theme";
import { SIGN_IN_ART_URI } from "../assets/sign-in-art";

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [farewell] = useState(() => farewellNotice.take());
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<TextInput>(null);

  const login = useMutation({
    mutationFn: () => api.auth.login({ email: identifier.trim(), password }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const canSubmit = identifier.trim().length > 0 && password.length > 0;
  const submit = () => {
    if (!canSubmit || login.isPending) return;
    Keyboard.dismiss();
    login.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 12) }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.dismissArea}>
          <Text style={styles.wordmark}>NOSTOS</Text>
          <Image
            source={{ uri: SIGN_IN_ART_URI }}
            style={styles.collage}
            resizeMode="cover"
            accessibilityLabel="Original Greek engraved-eye newspaper collage"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.headline}>Your city,{`\n`}remembered.</Text>
        </Pressable>
        <View style={styles.form}>
          {farewell ? <Text style={styles.notice}>{farewell}</Text> : null}
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL OR USERNAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Email or username"
              placeholderTextColor={colors.textSecondary}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email or username"
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
          {login.error ? <InlineError message={errorText(login.error, "Couldn't sign in. Check your email or username and password and try again.")} /> : null}
          <Pressable onPress={submit} disabled={!canSubmit || login.isPending} style={({ pressed }) => [styles.signIn, (!canSubmit || login.isPending) && styles.disabled, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.signInText}>{login.isPending ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push("/sign-up")} style={styles.create} accessibilityRole="button">
          <Text style={styles.createText}>New here? Create a passport</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  dismissArea: { flexShrink: 0 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 72, lineHeight: 76, letterSpacing: -2.8, paddingHorizontal: 24, paddingBottom: 4 },
  collage: { width: "100%", height: 299, backgroundColor: colors.elevated },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 67, lineHeight: 64, letterSpacing: -1.7, paddingHorizontal: 24, paddingTop: 12 },
  form: { paddingHorizontal: 24, paddingTop: 18, gap: 16 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  input: { height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  signIn: { height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  signInText: { color: colors.onAccent, fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  create: { marginTop: "auto", minHeight: 52, alignItems: "center", justifyContent: "center" },
  createText: { color: colors.accent, fontSize: 13 },
});

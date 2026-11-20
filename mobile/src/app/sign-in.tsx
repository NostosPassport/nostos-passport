import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, useWindowDimensions, View, type TextInputInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, errorText } from "@/api";
import { completeEmailSignIn, startEmailSignIn, type EmailChallenge } from "@/api/email-auth";
import { farewellNotice, useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { DismissKeyboard } from "@/components/ui/dismiss-keyboard";
import { InlineError } from "@/components/ui/inline-error";
import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { Field } from "@/components/ui/text-field";
import { CODE_LENGTH, CodeStep } from "@/features/account/code-step";
import { haptics } from "@/lib/haptics";
import { nav } from "@/lib/nav";
import { HANDLE_MAX, HANDLE_MIN, HANDLE_RE, isEmail } from "@/lib/validation";
import { colors, fonts, screenPadding, size, space } from "@/theme";

const SIGN_IN_ART = require("../../assets/images/nostos_art1.png");

/** The wordmark and headline are display type: they grow a little with Dynamic Type, then stop (P-022). */
const HERO_MAX_FONT_SCALE = 1.2;

function isHandle(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= HANDLE_MIN && normalized.length <= HANDLE_MAX && HANDLE_RE.test(normalized);
}

function isLoginIdentifier(value: string) {
  return isEmail(value) || isHandle(value);
}

export default function SignIn() {
  const { height: windowHeight } = useWindowDimensions();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [farewell] = useState(() => farewellNotice.take());
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const identifierRef = useRef<TextInputInstance>(null);
  const codeRef = useRef<TextInputInstance>(null);

  const requestCode = useMutation({
    mutationFn: () => startEmailSignIn(identifier.trim()),
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
      // The code field focuses itself when it first appears; after a resend it may have lost focus (P-019).
      requestAnimationFrame(() => codeRef.current?.focus());
    },
    onError: () => haptics.warning(),
  });

  const verify = useMutation({
    mutationFn: () => completeEmailSignIn(challenge!.challengeId, code),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const noAccount = requestCode.error instanceof ApiError && requestCode.error.code === "not_found";
  const enteredEmail = isEmail(identifier);
  const validIdentifier = isLoginIdentifier(identifier);

  const createAccount = () => {
    const value = identifier.trim();
    if (enteredEmail) {
      nav.push({ pathname: "/sign-up", params: { email: value } });
      return;
    }
    nav.push("/sign-up");
  };

  const submitIdentifier = () => {
    if (!validIdentifier || requestCode.isPending) return;
    requestCode.mutate();
  };

  const submitCode = () => {
    if (!challenge || code.length !== CODE_LENGTH || verify.isPending) return;
    verify.mutate();
  };

  const resendCode = () => {
    if (requestCode.isPending) return;
    verify.reset();
    requestCode.mutate();
  };

  const changeIdentifier = () => {
    setChallenge(null);
    setCode("");
    verify.reset();
    requestCode.reset();
    requestAnimationFrame(() => identifierRef.current?.focus());
  };

  // One primary button in one slot. When the account isn't found it becomes "Create a passport" (P-026).
  const primary = noAccount
    ? { title: "Create a passport", onPress: createAccount, disabled: false, loading: false }
    : challenge
      ? { title: "Sign in", onPress: submitCode, disabled: code.length !== CODE_LENGTH, loading: verify.isPending }
      : { title: "Send sign-in code", onPress: submitIdentifier, disabled: !validIdentifier, loading: requestCode.isPending };

  return (
    <View style={styles.root}>
      <ScrollView
        style={[styles.scroll, { marginTop: insets.top }]}
        contentContainerStyle={[styles.content, { paddingTop: space.xxs, paddingBottom: Math.max(insets.bottom, space.sm) }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <DismissKeyboard>
          <Text style={styles.wordmark} maxFontSizeMultiplier={HERO_MAX_FONT_SCALE} accessibilityLabel="Nostos">NOSTOS</Text>
          <Image
            source={SIGN_IN_ART}
            style={[styles.collage, { height: Math.round(Math.min(299, windowHeight * 0.3)) }]}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Original Greek engraved-eye newspaper collage"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.headline} maxFontSizeMultiplier={HERO_MAX_FONT_SCALE} accessibilityRole="header">
            Your city,{`\n`}remembered.
          </Text>
        </DismissKeyboard>

        <View style={styles.form}>
          <View style={styles.formHeading}>
            <Text style={styles.formTitle} accessibilityRole="header">Sign in</Text>
            <Text variant="footnote" color="textSecondary">Enter your email or handle. We’ll send a sign-in code to the email on your account.</Text>
          </View>

          {farewell ? <Text variant="footnote" color="textSecondary">{farewell}</Text> : null}

          <Field
            ref={identifierRef}
            label="Email or handle"
            placeholder="name@example.com or handle"
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              requestCode.reset();
              if (challenge) {
                setChallenge(null);
                setCode("");
                verify.reset();
              }
            }}
            editable={!requestCode.isPending && !verify.isPending}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType={challenge ? "next" : "go"}
            // Keep the keyboard up: the code field takes focus next, without the keyboard dropping and rising again.
            submitBehavior="submit"
            onSubmitEditing={challenge ? () => codeRef.current?.focus() : submitIdentifier}
          />

          {challenge ? (
            <CodeStep
              ref={codeRef}
              challengeId={challenge.challengeId}
              resendAfterSeconds={challenge.resendAfterSeconds}
              code={code}
              onChangeCode={(value) => {
                setCode(value);
                if (verify.error) verify.reset();
              }}
              sentTo={enteredEmail ? identifier.trim() : "the email on your account"}
              onResend={resendCode}
              resending={requestCode.isPending}
              onChangeAddress={changeIdentifier}
              changeAddressLabel="Use a different email or handle"
              invalid={!!verify.error}
              onSubmitEditing={submitCode}
            />
          ) : null}

          {noAccount ? (
            <View style={styles.newAccount}>
              <Text variant="subhead" weight="semibold">{enteredEmail ? "Looks like you’re new to Nostos." : "We couldn’t find that Nostos account."}</Text>
              <Text variant="footnote" color="textSecondary">{enteredEmail ? `Create a passport with ${identifier.trim()}.` : "Check the handle or create a new passport."}</Text>
            </View>
          ) : requestCode.error ? (
            <InlineError message={errorText(requestCode.error, "Couldn't send a sign-in code. Try again.")} />
          ) : null}

          {verify.error ? <InlineError message={errorText(verify.error, "Couldn't verify that code. Try again.")} /> : null}

          <Button title={primary.title} onPress={primary.onPress} disabled={primary.disabled} loading={primary.loading} />

          {!challenge && !noAccount ? (
            <Tappable onPress={createAccount} style={styles.secondaryAction} accessibilityRole="button">
              <Text variant="footnote" color="accent">New to Nostos? Create a passport</Text>
            </Tappable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 72, lineHeight: 76, letterSpacing: -2.8, paddingHorizontal: screenPadding, paddingBottom: space.xxs },
  collage: { width: "100%", backgroundColor: colors.elevated },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 67, lineHeight: 68, letterSpacing: -1.7, paddingHorizontal: screenPadding, paddingTop: space.sm },
  form: { paddingHorizontal: screenPadding, paddingTop: space.md, gap: space.md },
  formHeading: { gap: space.xxs },
  formTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 28, lineHeight: 31 },
  secondaryAction: { minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
  newAccount: { gap: space.xxs },
});

import { useMutation } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text as NativeText, View, type TextInputInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import { completeSignup, startSignupEmail, type EmailChallenge } from "@/api/email-auth";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { CODE_LENGTH, CodeStep } from "@/features/account/code-step";
import { checkBirthdate, formatBirthdateInput, parseBirthdate } from "@/lib/age";
import { useAnnounce } from "@/lib/a11y";
import { haptics } from "@/lib/haptics";
import { LEGAL, openWebPage } from "@/lib/links";
import { HANDLE_MAX, validateSignup, type SignupErrors, type SignupFields } from "@/lib/validation";
import { colors, fonts, maxFontSizeMultiplier, screenPadding, size } from "@/theme";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";
import { DismissKeyboard } from "@/components/ui/dismiss-keyboard";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";

/** "MM/DD/YYYY" */
const BIRTHDATE_LENGTH = 10;

export default function SignUp() {
  const keyboardUp = useKeyboardVisible();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] ?? "" : params.email ?? "";
  const [fields, setFields] = useState<SignupFields>({ email: initialEmail, handle: "", displayName: "", birthdate: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [consentError, setConsentError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState("");
  const emailRef = useRef<TextInputInstance>(null);
  const handleRef = useRef<TextInputInstance>(null);
  const displayNameRef = useRef<TextInputInstance>(null);
  const birthdateRef = useRef<TextInputInstance>(null);
  const codeRef = useRef<TextInputInstance>(null);
  useAnnounce(consentError);

  const requestCode = useMutation({
    mutationFn: (birthdate: string) => startSignupEmail(fields.email.trim(), fields.displayName.trim(), fields.handle.trim(), birthdate),
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
      requestAnimationFrame(() => codeRef.current?.focus());
    },
    onError: () => haptics.warning(),
  });

  const signup = useMutation({
    mutationFn: () =>
      completeSignup({
        challengeId: challenge!.challengeId,
        code,
        handle: fields.handle.trim().toLowerCase(),
        displayName: fields.displayName.trim(),
        acceptTerms: true,
      }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const set = (key: keyof SignupFields) => (value: string) => {
    const next = key === "handle" ? value.toLowerCase() : key === "birthdate" ? formatBirthdateInput(value) : value;
    setFields((current) => ({ ...current, [key]: next }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    // A server error describes the details as they were; editing them clears it (P-030b).
    if (requestCode.error) requestCode.reset();
    if (signup.error) signup.reset();
    if ((key === "email" || key === "birthdate") && challenge) {
      setChallenge(null);
      setCode("");
    }
    // The number pad has no Next key. A complete, real date closes it so the terms and the button come into view (P-030l).
    if (key === "birthdate" && next.length === BIRTHDATE_LENGTH && fields.birthdate.length < BIRTHDATE_LENGTH && parseBirthdate(next)) Keyboard.dismiss();
  };

  const validate = (): string | null => {
    // One problem at a time, in form order: the first field that needs attention is marked and focused, rather than
    // every empty field turning red at once (P-030h).
    const allErrors = validateSignup(fields);
    const order = [
      ["email", emailRef],
      ["handle", handleRef],
      ["displayName", displayNameRef],
      ["birthdate", birthdateRef],
    ] as const;
    const first = order.find(([key]) => allErrors[key]);
    const nextConsentError = !first && !terms ? "Agree to the Terms and Privacy policy to continue." : null;
    setErrors(first ? { [first[0]]: allErrors[first[0]] } : {});
    setConsentError(nextConsentError);
    if (first) first[1].current?.focus();
    // The checkbox can't take keyboard focus, so close the keyboard and let the message be read (P-030g).
    else if (nextConsentError) Keyboard.dismiss();
    if (first || nextConsentError) {
      haptics.warning();
      return null;
    }
    const age = checkBirthdate(fields.birthdate);
    return age.ok ? age.apiDate : null;
  };

  const resendCode = () => {
    const age = checkBirthdate(fields.birthdate);
    if (!age.ok || requestCode.isPending) return;
    signup.reset();
    requestCode.mutate(age.apiDate);
  };

  const changeEmail = () => {
    setChallenge(null);
    setCode("");
    signup.reset();
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const submit = () => {
    if (requestCode.isPending || signup.isPending) return;
    const birthdate = validate();
    if (!birthdate) return;
    if (!challenge) {
      requestCode.mutate(birthdate);
      return;
    }
    if (code.length !== CODE_LENGTH) {
      codeRef.current?.focus();
      haptics.warning();
      return;
    }
    signup.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topbar, { paddingTop: insets.top, height: insets.top + 44 }]}>
        <Tappable onPress={() => nav.back()} style={styles.hitTarget} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Tappable>
        {/* Sign-up is pushed over sign-in, so going back is the way there; replace would stack a second sign-in (P-030c). */}
        <Tappable
          onPress={() => (router.canGoBack() ? nav.back() : router.replace("/sign-in"))}
          style={styles.signInLink}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <NativeText style={styles.navLabel} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>SIGN IN</NativeText>
        </Tappable>
      </View>

      <DismissKeyboard style={styles.heading}>
        <NativeText style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier}>Your passport</NativeText>
        <Text variant="callout" color="textSecondary">For people 13 and over. Only you can see it.</Text>
      </DismissKeyboard>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <FieldGroup>
          <Field ref={emailRef} label="Email" placeholder="name@example.com" value={fields.email} onChangeText={set("email")} error={errors.email} editable={!challenge} autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => handleRef.current?.focus()} />
          <Field ref={handleRef} label="Handle" placeholder="lowercase_name" value={fields.handle} onChangeText={set("handle")} error={errors.handle} maxLength={HANDLE_MAX} autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" returnKeyType="next" onSubmitEditing={() => displayNameRef.current?.focus()} />
          <Field ref={displayNameRef} label="Name" placeholder="Your name" value={fields.displayName} onChangeText={set("displayName")} error={errors.displayName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => birthdateRef.current?.focus()} />
          <Field ref={birthdateRef} label="Birthdate" placeholder="MM/DD/YYYY" value={fields.birthdate} onChangeText={set("birthdate")} error={errors.birthdate} editable={!challenge} keyboardType="number-pad" autoComplete="birthdate-full" textContentType="none" maxLength={BIRTHDATE_LENGTH} returnKeyType={challenge ? "next" : "done"} testID="signup-birthdate" />
        </FieldGroup>

        {challenge ? (
          <CodeStep
            ref={codeRef}
            challengeId={challenge.challengeId}
            resendAfterSeconds={challenge.resendAfterSeconds}
            code={code}
            onChangeCode={(value) => {
              setCode(value);
              if (signup.error) signup.reset();
            }}
            sentTo={fields.email.trim()}
            onResend={resendCode}
            resending={requestCode.isPending}
            onChangeAddress={changeEmail}
            invalid={!!signup.error}
            onSubmitEditing={submit}
          />
        ) : null}

        <Checkbox checked={terms} onChange={(checked) => { setTerms(checked); if (checked) setConsentError(null); }} invalid={!!consentError && !terms} accessibilityLabel="I agree to the Terms and Privacy policy">
          <Text variant="callout">I agree to the Terms and Privacy policy.</Text>
        </Checkbox>
        {consentError ? <InlineError message={consentError} /> : null}

        <View style={styles.legalLinks}>
          <Button title="Terms" variant="plain" onPress={() => openWebPage(LEGAL.terms)} accessibilityRole="link" />
          <Button title="Privacy policy" variant="plain" onPress={() => openWebPage(LEGAL.privacy)} accessibilityRole="link" />
        </View>

        <View style={styles.notes}>
          <Text variant="footnote" color="textSecondary">13+ · Birthdate checked once, not kept.</Text>
          <Text variant="footnote" color="textSecondary">No tolerance for abusive content or users.</Text>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: keyboardUp ? 8 : Math.max(insets.bottom, 12) }]}>
        {/* Server errors sit right above the button that caused them, not below the fold (P-030b). */}
        {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send your verification code. Try again.")} /> : null}
        {signup.error ? <InlineError message={errorText(signup.error, "Couldn't create your account. Check the details and try again.")} /> : null}
        <Button
          title={challenge ? "Create account" : "Verify email"}
          onPress={submit}
          loading={requestCode.isPending || signup.isPending}
          disabled={challenge ? code.length !== CODE_LENGTH : false}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topbar: { paddingHorizontal: screenPadding, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11 },
  signInLink: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
  navLabel: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.35 },
  heading: { paddingHorizontal: screenPadding, gap: 4, paddingTop: 16, paddingBottom: 18 },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenPadding, paddingBottom: 24, gap: 10 },
  legalLinks: { flexDirection: "row" },
  notes: { gap: 1 },
  actions: { paddingHorizontal: screenPadding, paddingTop: 8, gap: 8, backgroundColor: colors.background },
});

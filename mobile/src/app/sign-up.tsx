import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { api, errorText } from "@/api";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormScreen } from "@/components/ui/form-screen";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { useAnnounce } from "@/lib/a11y";
import { haptics } from "@/lib/haptics";
import { LEGAL, openWebPage } from "@/lib/links";
import { MIN_PASSWORD, validateSignup, type SignupErrors, type SignupFields } from "@/lib/validation";
import { space } from "@/theme";

export default function SignUp() {
  const { signIn } = useAuth();
  const [fields, setFields] = useState<SignupFields>({ email: "", password: "", handle: "", displayName: "" });
  const [is21, setIs21] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [consentError, setConsentError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const handleRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);
  useAnnounce(consentError);

  const set = (k: keyof SignupFields) => (v: string) => {
    setFields((f) => ({ ...f, [k]: k === "handle" ? v.toLowerCase() : v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const signup = useMutation({
    mutationFn: () =>
      api.auth.signup({
        email: fields.email.trim(),
        password: fields.password,
        handle: fields.handle.trim().toLowerCase(),
        displayName: fields.displayName.trim(),
        acceptTerms: true,
        confirm21: true,
      }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const submit = () => {
    if (signup.isPending) return;
    const e = validateSignup(fields);
    setErrors(e);
    const consent = !is21 ? "Confirm you're 21 or older." : !terms ? "Agree to the Terms and Privacy policy to continue." : null;
    setConsentError(consent);
    if (e.email) emailRef.current?.focus();
    else if (e.password) passwordRef.current?.focus();
    else if (e.handle) handleRef.current?.focus();
    else if (e.displayName) displayNameRef.current?.focus();
    if (Object.keys(e).length || consent) {
      haptics.warning();
      return;
    }
    signup.mutate();
  };

  return (
    <FormScreen>
      <FieldGroup errors={[errors.email, errors.password]} footer={`Passwords need at least ${MIN_PASSWORD} characters.`}>
        <Field
          ref={emailRef}
          label="Email"
          placeholder="name@example.com"
          value={fields.email}
          onChangeText={set("email")}
          invalid={!!errors.email}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Field
          ref={passwordRef}
          label="Password"
          placeholder={`${MIN_PASSWORD}+ characters`}
          value={fields.password}
          onChangeText={set("password")}
          invalid={!!errors.password}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => handleRef.current?.focus()}
        />
      </FieldGroup>

      <FieldGroup errors={[errors.handle, errors.displayName]} footer="Your handle is shown on your photos and comments.">
        <Field
          ref={handleRef}
          label="Handle"
          placeholder="lowercase_name"
          value={fields.handle}
          onChangeText={set("handle")}
          invalid={!!errors.handle}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
          autoComplete="off"
          returnKeyType="next"
          onSubmitEditing={() => displayNameRef.current?.focus()}
        />
        <Field
          ref={displayNameRef}
          label="Name"
          placeholder="Shown on your profile"
          value={fields.displayName}
          onChangeText={set("displayName")}
          invalid={!!errors.displayName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
        />
      </FieldGroup>

      <View style={styles.consents}>
        <Checkbox checked={is21} onChange={setIs21} invalid={!!consentError && !is21} accessibilityLabel="I'm 21 or older">
          <Text variant="body">I&apos;m 21 or older</Text>
        </Checkbox>
        <Checkbox checked={terms} onChange={setTerms} invalid={!!consentError && is21 && !terms} accessibilityLabel="I agree to the Terms and Privacy policy">
          <Text variant="body">I agree to the Terms and Privacy policy</Text>
        </Checkbox>
        <Text variant="footnote" color="textTertiary">
          There&apos;s no tolerance for abusive content or users. Anyone can report a post or an account.
        </Text>
        <View style={styles.links}>
          <Button title="Terms" variant="plain" compact block={false} onPress={() => openWebPage(LEGAL.terms)} accessibilityRole="link" />
          <Button title="Privacy policy" variant="plain" compact block={false} onPress={() => openWebPage(LEGAL.privacy)} accessibilityRole="link" />
        </View>
        {consentError && (
          <Text variant="footnote" color="danger">
            {consentError}
          </Text>
        )}
      </View>

      {signup.error && <InlineError message={errorText(signup.error, "Couldn't create your account. Check the details and try again.")} />}
      <Button title="Create account" onPress={submit} loading={signup.isPending} />
      <Button title="Have an account? Sign in" variant="plain" onPress={() => router.replace("/sign-in")} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  consents: { gap: space.xs },
  links: { flexDirection: "row", marginLeft: -space.md },
});

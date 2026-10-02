import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { TextInput } from "react-native";

import { api, errorText } from "@/api";
import { useAuth } from "@/auth/auth-context";
import { FormHeader } from "@/components/brand/form-header";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { InlineError } from "@/components/ui/inline-error";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";

export default function SignIn() {
  const { signIn } = useAuth();
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
    <FormScreen>
      <FormHeader title="Welcome back" line="Your passport is where you left it." />
      <FieldGroup errors={[emailError]}>
        <Field
          label="Email"
          placeholder="name@example.com"
          value={email}
          invalid={!!emailError}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          autoFocus
        />
        <Field
          ref={passwordRef}
          label="Password"
          placeholder="Required"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </FieldGroup>
      {login.error && <InlineError message={errorText(login.error, "Couldn't sign in. Check your email and password and try again.")} />}
      <Button title="Sign in" onPress={submit} disabled={!canSubmit} loading={login.isPending} />
      <Button title="New here? Create an account" variant="plain" onPress={() => router.replace("/sign-up")} />
    </FormScreen>
  );
}

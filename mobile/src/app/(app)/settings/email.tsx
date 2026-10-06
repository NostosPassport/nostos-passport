import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";

import { errorText } from "@/api";
import { changeAccountEmail } from "@/api/account-email";
import { qk } from "@/api/keys";
import { useMe } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";

export default function ChangeEmail() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const email = emailDraft ?? me.data?.user.email ?? "";

  const save = useMutation({
    mutationFn: () => changeAccountEmail(email, password),
    onSuccess: async () => {
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
      toast.show("Email updated", "neutral");
      router.back();
    },
    onError: () => haptics.warning(),
  });

  const submit = () => {
    if (!isEmail(email)) {
      setProblem("Enter a valid email address.");
      haptics.warning();
      return;
    }
    if (!password) {
      setProblem("Enter your password to change your email.");
      haptics.warning();
      return;
    }
    setProblem(null);
    save.mutate();
  };

  const unchanged = email.trim().toLowerCase() === (me.data?.user.email ?? "").toLowerCase();

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "Email",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Save" bold onPress={submit} disabled={unchanged || save.isPending} />,
        }}
      />
      <Text variant="callout" color="textSecondary">Change the email you use to sign in. Confirm the change with your current password.</Text>
      <FieldGroup errors={[problem]}>
        <Field label="Email" value={email} onChangeText={(value) => { setEmailDraft(value); setProblem(null); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
        <Field label="Current password" value={password} onChangeText={(value) => { setPassword(value); setProblem(null); }} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="done" onSubmitEditing={submit} />
      </FieldGroup>
      {save.error ? <InlineError message={errorText(save.error, "Couldn't change your email. Try again.")} /> : null}
    </FormScreen>
  );
}

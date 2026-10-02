import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { checkBirthdate, formatBirthdateInput } from "@/lib/age";
import { haptics } from "@/lib/haptics";
import { space } from "@/theme";

/**
 * The age gate for looking around without an account. The birthdate is checked here and thrown away: it isn't sent
 * anywhere or saved, and nothing is remembered about someone who isn't old enough.
 */
export default function AgeGate() {
  const { browseAsGuest } = useAuth();
  const [birthdate, setBirthdate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [underage, setUnderage] = useState(false);

  const submit = () => {
    const check = checkBirthdate(birthdate);
    if (check.ok) {
      setMessage(null);
      browseAsGuest();
      return;
    }
    haptics.warning();
    setMessage(check.message);
    setUnderage(check.reason === "underage");
  };

  return (
    <FormScreen>
      <View style={styles.intro}>
        <Text variant="title2" accessibilityRole="header">
          Before you look around
        </Text>
        <Text variant="callout" color="textSecondary">
          Nostos is for people 21 and older. Enter your birthdate. We check it on your phone and don&apos;t keep it.
        </Text>
      </View>
      <FieldGroup errors={[message]}>
        <Field
          label="Birthdate"
          placeholder="MM/DD/YYYY"
          value={birthdate}
          onChangeText={(v) => {
            setBirthdate(formatBirthdateInput(v));
            setMessage(null);
            setUnderage(false);
          }}
          invalid={!!message}
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={submit}
          testID="age-gate-birthdate"
        />
      </FieldGroup>
      {!underage && <Button title="Continue" onPress={submit} disabled={birthdate.length < 10} />}
      <Button title={underage ? "Close" : "Cancel"} variant="plain" onPress={() => router.back()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({ intro: { gap: space.xs } });

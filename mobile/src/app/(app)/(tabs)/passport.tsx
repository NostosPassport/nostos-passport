import { StyleSheet, View } from "react-native";

import { useMe } from "@/api/queries";
import { AccountGate } from "@/features/account/account-gate";
import { ProfileScreen } from "@/features/people/profile-screen";
import { colors } from "@/theme";

/** Your passport: your own profile, with Edit profile, follow requests and settings. */
export default function Passport() {
  const me = useMe();
  return (
    <View style={styles.root}>
      <AccountGate title="Your passport" message="Sign in to collect stamps and see your passport.">
        {me.data ? <ProfileScreen handle={me.data.user.handle} own /> : null}
      </AccountGate>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });

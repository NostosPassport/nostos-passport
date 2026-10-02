import { StyleSheet, View } from "react-native";

import { errorText } from "@/api";
import { useMe } from "@/api/queries";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileScreen } from "@/features/people/profile-screen";
import { colors, screenPadding, size, space } from "@/theme";

/** Your own profile. Settings (plans, blocked users, legal, sign out, delete account) are one tap away in the header. */
export default function Profile() {
  const me = useMe();
  if (me.data) return <ProfileScreen handle={me.data.user.handle} own />;
  return (
    <View style={styles.root}>
      {me.isError ? (
        <InlineError message={errorText(me.error, "Couldn't load your profile.")} onRetry={() => void me.refetch()} retrying={me.isFetching} />
      ) : (
        <View style={styles.identity}>
          <Skeleton width={size.avatarLarge} height={size.avatarLarge} round />
          <Skeleton width="50%" height={size.iconLarge} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding, paddingTop: space.xxxl * 2 },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
});

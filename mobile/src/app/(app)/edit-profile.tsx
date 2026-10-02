import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Switch, View } from "react-native";

import { api, errorText } from "@/api";
import { AvatarResponse, type ProfileSettingsResponse } from "@/api/contracts";
import { qk, useProfileSettings } from "@/api/queries";
import { Avatar } from "@/components/ui/avatar";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { BIO_MAX, NAME_MAX, privacyNote, profileChanges, profileProblem, shouldOfferApproveAll, type ProfileValues } from "@/features/people/edit-profile";
import { confirmApproveAll, useApproveAll } from "@/features/people/use-requests";
import { pickFromLibrary } from "@/features/photos/pick";
import { prepareImage } from "@/features/photos/prepare";
import { haptics } from "@/lib/haptics";
import { useConfirmDiscard } from "@/lib/use-confirm-discard";
import { colors, radius, size, space } from "@/theme";

/** Profile photo, display name, bio (150) and the Private account toggle. */
export default function EditProfile() {
  const settings = useProfileSettings();
  const data = settings.data;
  if (!data)
    return (
      <FormScreen>
        {settings.isError ? (
          <InlineError message={errorText(settings.error, "Couldn't load your profile.")} onRetry={() => void settings.refetch()} retrying={settings.isFetching} />
        ) : (
          <SkeletonRows count={4} />
        )}
      </FormScreen>
    );
  return <EditForm data={data} />;
}

function EditForm({ data }: { data: ProfileSettingsResponse }) {
  const queryClient = useQueryClient();
  const initial: ProfileValues = { displayName: data.profile.displayName, bio: data.profile.bio, isPrivate: data.profile.isPrivate };
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const approveAll = useApproveAll();
  const change = profileChanges(initial, values);
  const dirty = Object.keys(change).length > 0;
  const problem = profileProblem(values);
  useConfirmDiscard(dirty && !saved);

  const refreshProfile = () => {
    void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
    void queryClient.invalidateQueries({ queryKey: qk.profileSettings });
    void queryClient.invalidateQueries({ queryKey: qk.user(data.profile.handle) });
  };

  const save = useMutation({
    mutationFn: () => api.me.updateProfile(change),
    onSuccess: (res) => {
      haptics.success();
      setSaved(true);
      refreshProfile();
      if (shouldOfferApproveAll(change, res.pendingRequests)) {
        // Going public doesn't approve anyone by itself.
        confirmApproveAll(res.pendingRequests, () => approveAll.mutate(), () => router.back());
        return;
      }
      requestAnimationFrame(() => router.back());
    },
    onError: () => haptics.warning(),
  });

  const photo = useMutation({
    mutationFn: async (action: "choose" | "remove") => {
      if (action === "remove") return api.me.removeAvatar();
      const picked = await pickFromLibrary();
      if (!picked) return null;
      const prepared = await prepareImage(picked.uri);
      const form = new FormData();
      // React Native's FormData takes a file descriptor object for local files.
      form.append("photo", { uri: prepared.uri, name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob);
      return api.upload("/api/me/avatar", AvatarResponse, form);
    },
    onSuccess: (res) => {
      if (!res) return;
      haptics.success();
      toast.show(res.avatarUrl ? "Photo updated" : "Photo removed", "neutral");
      refreshProfile();
    },
    onError: () => haptics.warning(),
  });

  const avatarUrl = photo.data !== undefined && photo.data !== null ? photo.data.avatarUrl : data.profile.avatarUrl;

  const choosePhoto = () => {
    const options = avatarUrl ? ["Choose photo", "Remove photo", "Cancel"] : ["Choose photo", "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: avatarUrl ? 1 : undefined, tintColor: colors.accent, userInterfaceStyle: "dark" },
      (i) => {
        if (i === 0) photo.mutate("choose");
        if (avatarUrl && i === 1) photo.mutate("remove");
      },
    );
  };

  const set = (k: "displayName" | "bio") => (t: string) => setValues((v) => ({ ...v, [k]: t }));

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Save" bold onPress={() => save.mutate()} disabled={!dirty || !!problem || save.isPending} />,
        }}
      />
      <Pressable
        onPress={choosePhoto}
        disabled={photo.isPending}
        accessibilityRole="button"
        accessibilityLabel={avatarUrl ? "Change profile photo" : "Add profile photo"}
        accessibilityState={{ busy: photo.isPending }}
        style={styles.photo}
      >
        <Avatar name={values.displayName} uri={avatarUrl} size={size.avatarLarge} variant="title" />
        <Text variant="callout" color="accent" weight="semibold">
          {photo.isPending ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
        </Text>
      </Pressable>
      {photo.error && <InlineError message={errorText(photo.error, "Couldn't update your photo. Try again.")} />}

      <FieldGroup footer={`${values.bio.trim().length}/${BIO_MAX}`} errors={[problem && dirty ? problem : null]}>
        <Field label="Name" value={values.displayName} onChangeText={set("displayName")} maxLength={NAME_MAX} autoCapitalize="words" textContentType="name" returnKeyType="next" />
        <Field
          label="Bio"
          value={values.bio}
          onChangeText={set("bio")}
          maxLength={BIO_MAX}
          placeholder="A line about you"
          multiline
          accessibilityHint={`Up to ${BIO_MAX} characters`}
        />
      </FieldGroup>

      <View style={styles.privateWrap}>
        <View style={styles.privateRow}>
          <Text variant="body" style={styles.flex}>
            Private account
          </Text>
          <Switch
            value={values.isPrivate}
            onValueChange={(isPrivate) => setValues((v) => ({ ...v, isPrivate }))}
            trackColor={{ true: colors.accent, false: colors.elevated }}
            accessibilityLabel="Private account"
            accessibilityHint={privacyNote(values.isPrivate)}
          />
        </View>
        <Text variant="footnote" color="textTertiary" style={styles.note}>
          {privacyNote(values.isPrivate)}
        </Text>
      </View>

      {save.error && <InlineError message={errorText(save.error, "Couldn't save. Check the fields and try again.")} />}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: "center", gap: space.xs, paddingTop: space.md },
  privateWrap: { gap: space.xs },
  privateRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: size.fieldHeight,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  flex: { flex: 1 },
  note: { paddingHorizontal: space.md },
});

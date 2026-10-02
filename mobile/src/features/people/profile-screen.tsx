import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Pressable, RefreshControl, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { ApiError, errorText } from "@/api";
import type { ProfileResponse } from "@/api/contracts";
import { useMe, useUserProfile, useUserStamps } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HeaderButton } from "@/components/ui/header-button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { chooseReportReason, confirmBlock, useBlock, useFlag } from "@/features/moderation/content-actions";
import { SOCIAL_ENABLED } from "@/config";
import { colors, radius, screenPadding, size, space } from "@/theme";
import { PlacesTab, StampsGrid } from "./profile-tabs";
import { followButton, useFollow } from "./use-follow";

type Tab = "stamps" | "places";
/** Ask for the next page of stamps this close to the end of the scroll view. */
const NEXT_PAGE_DISTANCE = 600;

/**
 * A passport: yours (Edit profile, requests, settings) or someone else's (Follow / Requested / Following, Report, Block).
 * A private account you don't follow arrives `access: "limited"`: handle, badge, a generic avatar and the follow button.
 */
export function ProfileScreen({ handle, modal, own }: { handle: string; modal?: boolean; own?: boolean }) {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const profile = useUserProfile(handle);
  const p = profile.data;
  const full = p?.access === "full";
  const stamps = useUserStamps(handle, full);
  const [tab, setTab] = useState<Tab>("stamps");
  const [refreshing, setRefreshing] = useState(false);
  const flag = useFlag();
  const block = useBlock();

  const requireAccount = () => {
    if (signedIn) return true;
    router.push("/sign-in");
    return false;
  };

  const openMenu = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Report account", `Block @${handle}`, "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2, tintColor: colors.accent, userInterfaceStyle: "dark" },
      (i) => {
        if (i === 2 || !requireAccount()) return;
        if (i === 0) chooseReportReason(`Report @${handle}`, (chosen) => flag.mutate({ targetType: "USER", targetId: handle, ...chosen }));
        if (i === 1) confirmBlock(handle, () => block.mutate({ handle, block: true }, { onSuccess: () => router.back() }));
      },
    );
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([profile.refetch(), full ? stamps.refetch() : null]).finally(() => setRefreshing(false));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - NEXT_PAGE_DISTANCE;
    if (nearEnd && tab === "stamps" && stamps.hasNextPage && !stamps.isFetchingNextPage && !stamps.isFetchNextPageError) void stamps.fetchNextPage();
  };

  const notFound = profile.error instanceof ApiError && profile.error.status === 404;
  const isSelf = own || p?.relationship.isSelf;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: p ? `@${p.user.handle}` : "",
          headerLeft: modal ? () => <HeaderButton label="Done" bold onPress={() => router.back()} /> : undefined,
          headerRight: () =>
            isSelf ? (
              <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={space.xs} style={styles.headerButton}>
                <Icon name="gearshape" color="accent" size={size.icon} />
              </Pressable>
            ) : p ? (
              <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="More options" hitSlop={space.xs} style={styles.headerButton}>
                <Icon name="ellipsis.circle" color="accent" size={size.icon} />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={250}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.textSecondary} />}
      >
        {p ? (
          <>
            <Header p={p} />
            {isSelf ? <OwnActions /> : <FollowAction p={p} requireAccount={requireAccount} />}

            {p.access === "limited" ? (
              <View style={styles.private}>
                <Icon name="lock.fill" color="textSecondary" size={size.icon} />
                <Text variant="headline">This account is private</Text>
                <Text variant="callout" color="textSecondary">
                  {p.relationship.follow === "requested" ? "Your request is waiting for their approval." : "Follow to see their stamps and places."}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.tabs}>
                  <SegmentedControl
                    segments={[
                      { key: "stamps", label: "Stamps" },
                      { key: "places", label: "Places" },
                    ]}
                    value={tab}
                    onChange={setTab}
                    accessibilityLabel="Passport sections"
                  />
                  {tab === "stamps" ? <StampsGrid stamps={stamps} own={!!isSelf} /> : <PlacesTab handle={p.user.handle} />}
                </View>
              </>
            )}
          </>
        ) : notFound ? (
          <View style={styles.gone}>
            <Text variant="title2">This profile isn&apos;t available</Text>
            <Text color="textSecondary">The account may have been deleted.</Text>
            <Button title="Close" variant="secondary" compact block={false} onPress={() => router.back()} />
          </View>
        ) : profile.isError ? (
          <InlineError message={errorText(profile.error, "Couldn't load this profile.")} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
        ) : (
          <View style={styles.identity}>
            <Skeleton width={size.avatarLarge} height={size.avatarLarge} round />
            <View style={styles.names}>
              <Skeleton width="60%" height={size.iconLarge} />
              <Skeleton width="40%" />
            </View>
          </View>
        )}
      </ScrollView>
      <ToastHost bottom={space.xxl} />
    </View>
  );
}

/** Photo, name, handle and badge, bio, counts. Limited: handle, badge and a generic avatar only. */
function Header({ p }: { p: ProfileResponse }) {
  const full = p.access === "full" ? p : null;
  const handle = p.user.handle;
  const spoken = [full?.user.displayName, `@${handle}`, p.user.verified ? "verified" : null].filter(Boolean).join(", ");
  const openList = (list: "followers" | "following") => router.push({ pathname: "/connections", params: { handle, list } });

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar name={full?.user.displayName ?? null} uri={full?.user.avatarUrl} size={size.avatarLarge} variant="title" />
        <View style={styles.names} accessible accessibilityLabel={spoken}>
          {full && <Text variant="title2">{full.user.displayName}</Text>}
          <View style={styles.handleRow}>
            <Text variant={full ? "subhead" : "title2"} color={full ? "textSecondary" : "textPrimary"}>
              @{handle}
            </Text>
            {p.user.verified && <VerifiedBadge accessible={false} />}
          </View>
        </View>
      </View>

      {full && (
        <View style={styles.counts}>
          <Count value={full.user.counts.stamps} label="Stamps" />
          <Count value={full.user.counts.places} label="Places" />
          {SOCIAL_ENABLED && <Count value={full.user.counts.followers} label="Followers" onPress={() => openList("followers")} />}
          {SOCIAL_ENABLED && <Count value={full.user.counts.following} label="Following" onPress={() => openList("following")} />}
        </View>
      )}
      {full && full.user.bio !== "" && <Text variant="body">{full.user.bio}</Text>}
      {full?.relationship.isSelf && full.user.isPrivate && (
        <View style={styles.privateNote}>
          <Icon name="lock.fill" color="textTertiary" size={size.iconTiny} />
          <Text variant="footnote" color="textTertiary">
            Private account
          </Text>
        </View>
      )}
    </View>
  );
}

function Count({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="headline" tabular>
        {value}
      </Text>
      <Text variant="footnote" color="textSecondary">
        {label}
      </Text>
    </>
  );
  const spoken = `${value} ${label.toLowerCase()}`;
  if (!onPress) {
    return (
      <View style={styles.count} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} hitSlop={space.xs} style={styles.count}>
      {body}
    </Pressable>
  );
}

function FollowAction({ p, requireAccount }: { p: ProfileResponse; requireAccount: () => boolean }) {
  const follow = useFollow();
  const b = followButton(p.relationship.follow, p.user.handle);
  return (
    <Button
      title={b.title}
      icon={b.icon}
      variant={b.variant}
      onPress={() => requireAccount() && follow.toggle(p.user.handle, p.relationship.follow)}
      accessibilityLabel={b.label}
      accessibilityState={{ busy: follow.isPendingFor(p.user.handle) }}
    />
  );
}

/** Your own profile: Edit profile, and entries for follow requests (with the badge count) and activity. */
function OwnActions() {
  const me = useMe();
  const pending = me.data?.social.pendingFollowRequests ?? 0;
  return (
    <View style={styles.own}>
      <Button title="Edit profile" variant="secondary" onPress={() => router.push("/edit-profile")} />
      {SOCIAL_ENABLED && <ListGroup>
        <ListRow
          icon="person.badge.plus"
          title="Follow requests"
          trailing={pending > 0 ? <CountBadge count={pending} /> : undefined}
          accessibilityLabel={pending > 0 ? `Follow requests, ${pending} waiting` : "Follow requests"}
          chevron
          onPress={() => router.push("/follow-requests")}
        />
      </ListGroup>}
    </View>
  );
}

/** A small count pill (pending requests). Neutral, not the accent: it's information, not an action. */
export function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.countBadge} accessible={false}>
      <Text variant="footnote" weight="semibold" tabular maxFontSizeMultiplier={1.3}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.xl },
  header: { gap: space.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  names: { flex: 1, gap: space.xxs, alignItems: "flex-start" },
  handleRow: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  counts: { flexDirection: "row", justifyContent: "space-between" },
  count: { alignItems: "flex-start", minHeight: size.hitTarget, justifyContent: "center" },
  privateNote: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  headerButton: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "flex-end", justifyContent: "center" },
  gone: { gap: space.sm, paddingTop: space.xxl },
  private: { gap: space.xs, alignItems: "flex-start" },
  own: { gap: space.lg },
  countBadge: { minWidth: size.markerBadge + space.xs, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: colors.elevated, alignItems: "center" },
  tabs: { gap: space.md },
});

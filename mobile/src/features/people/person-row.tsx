import { router } from "expo-router";
import type { ReactNode } from "react";

import type { PersonView } from "@/api/contracts";
import { Avatar } from "@/components/ui/avatar";
import { ListRow } from "@/components/ui/list-row";
import { VerifiedBadge } from "@/components/ui/verified-badge";

/** Spoken name for a person: "Sam Lee, @sam, verified". */
export function personLabel(p: PersonView): string {
  return [p.displayName, `@${p.handle}`, p.verified ? "verified" : null].filter(Boolean).join(", ");
}

/**
 * A person in a list (search, followers, following, requests, activity). Private accounts you don't follow arrive
 * without a name or photo: the handle and a generic avatar only.
 */
export function PersonRow({
  person,
  subtitle,
  trailing,
  actions,
  onPress,
  accessibilityHint = "Opens their profile",
}: {
  person: PersonView;
  subtitle?: string;
  /** Default: open their profile. */
  onPress?: () => void;
  accessibilityHint?: string;
  trailing?: ReactNode;
  actions?: { label: string; onPress: () => void }[];
}) {
  const title = person.displayName ?? `@${person.handle}`;
  const sub = [person.displayName ? `@${person.handle}` : null, subtitle].filter(Boolean).join(" · ");
  return (
    <ListRow
      leading={<Avatar name={person.displayName} uri={person.avatarUrl} />}
      title={title}
      titleAccessory={person.verified ? <VerifiedBadge accessible={false} /> : undefined}
      subtitle={sub || undefined}
      onPress={onPress ?? (() => router.push({ pathname: "/user/[handle]", params: { handle: person.handle } }))}
      accessibilityLabel={[personLabel(person), subtitle].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      actions={actions}
      trailing={trailing}
    />
  );
}

import { useLocalSearchParams } from "expo-router";

import { ProfileScreen } from "@/features/people/profile-screen";

export default function UserProfile() {
  const { handle, modal } = useLocalSearchParams<{ handle: string; modal?: string }>();
  return <ProfileScreen handle={handle} modal={!!modal} />;
}

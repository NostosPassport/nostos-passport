import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { CourierPrime_400Regular, CourierPrime_700Bold } from "@expo-google-fonts/courier-prime";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMe } from "@/api/queries";
import { createQueryClient, wireReactQueryToApp } from "@/api/query-client";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { HeaderButton } from "@/components/ui/header-button";
import { stackOptions } from "@/components/ui/stack-options";
import { useOfflineAnnouncer } from "@/lib/network";
import { initErrorReporting } from "@/lib/report-error";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Off unless the build sets EXPO_PUBLIC_SENTRY_ENABLED=1 and a DSN (see lib/report-error.ts).
initErrorReporting();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => wireReactQueryToApp(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  useOfflineAnnouncer();
  const { status } = useAuth();
  const me = useMe();
  // The serif and the typewriter. If they fail to load the system fonts are used and the app still opens.
  const [fontsLoaded, fontError] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold, CourierPrime_400Regular, CourierPrime_700Bold });
  const signedIn = status === "signedIn";
  const meReady = signedIn && !!me.data;
  const needsTerms = meReady && me.data?.terms.needsAcceptance === true;
  const ready = status !== "loading" && !(signedIn && me.isLoading) && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Order matters: when a guard flips, the router lands on the first available screen.
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Protected guard={status === "signedOut" || status === "loading"}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !meReady}>
        <Stack.Screen name="connect" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsTerms}>
        <Stack.Screen name="terms-update" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "guest" || (meReady && !needsTerms)}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Development builds only: every visual piece on made-up data, reachable without an account (see features/gallery). */}
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="design/index" options={{ title: "Design gallery" }} />
        <Stack.Screen name="design/[section]" options={{ title: "Design gallery" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="age-gate" options={{ title: "Age check", presentation: "modal", headerLeft: CloseButton }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in", presentation: "modal", headerLeft: CloseButton }} />
        <Stack.Screen name="sign-up" options={{ title: "Create account", presentation: "modal", headerLeft: CloseButton }} />
      </Stack.Protected>
    </Stack>
  );
}

function CloseButton() {
  return <HeaderButton label="Cancel" onPress={() => router.back()} />;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });

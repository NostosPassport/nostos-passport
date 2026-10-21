import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { CourierPrime_400Regular, CourierPrime_700Bold } from "@expo-google-fonts/courier-prime";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMe } from "@/api/queries";
import { createQueryClient, wireReactQueryToApp } from "@/api/query-client";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { stackOptions } from "@/components/ui/stack-options";
import { useOfflineAnnouncer } from "@/lib/network";
import { initErrorReporting } from "@/lib/report-error";
import { colors } from "@/theme";

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.hairline,
    notification: colors.accent,
  },
};

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
initErrorReporting();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => wireReactQueryToApp(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider value={navigationTheme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </ThemeProvider>
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
  const [fontsLoaded, fontError] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold, SourceSerif4_600SemiBold, CourierPrime_400Regular, CourierPrime_700Bold });
  const signedIn = status === "signedIn";
  const meReady = signedIn && !!me.data;
  const needsTerms = meReady && me.data?.terms.needsAcceptance === true;
  const ready = status !== "loading" && !(signedIn && me.isLoading) && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Protected guard={status === "signedOut" || status === "loading"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false, presentation: "card" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !meReady}>
        <Stack.Screen name="connect" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsTerms}>
        <Stack.Screen name="terms-update" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={meReady && !needsTerms}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="design/index" options={{ title: "Design gallery" }} />
        <Stack.Screen name="design/[section]" options={{ title: "Design gallery" }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background } });

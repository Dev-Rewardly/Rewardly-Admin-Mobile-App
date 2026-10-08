import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';

import { color } from '@/constants/design';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { initI18n } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null;

  // The session decides which screens exist at all; a signed-out admin cannot
  // be routed to a tab, and a locked one sees only the lock screen.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'locked'}>
        <Stack.Screen name="lock" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // A font that fails to load falls back to the system face; it never blocks sign-in.
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    initI18n()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready || (!fontsLoaded && !fontError)) return null;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}

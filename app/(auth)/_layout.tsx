import { Stack } from 'expo-router';

import { color } from '@/constants/design';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
    </Stack>
  );
}

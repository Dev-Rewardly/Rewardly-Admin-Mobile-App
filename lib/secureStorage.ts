// lib/secureStorage.ts
// Platform-aware secure storage.
// Native: expo-secure-store (iOS Keychain / Android Keystore)
// Web:    sessionStorage (cleared on tab close; dev / web preview only)

import { Platform } from 'react-native';

async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return sessionStorage.getItem(key);
  const { getItemAsync: nativeGet } = await import('expo-secure-store');
  return nativeGet(key);
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.setItem(key, value);
    return;
  }
  const { setItemAsync: nativeSet } = await import('expo-secure-store');
  return nativeSet(key, value);
}

async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.removeItem(key);
    return;
  }
  const { deleteItemAsync: nativeDel } = await import('expo-secure-store');
  return nativeDel(key);
}

export const secureStorage = { getItemAsync, setItemAsync, deleteItemAsync };

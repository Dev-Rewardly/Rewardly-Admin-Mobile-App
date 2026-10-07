// lib/auth/session-store.ts
// Tokens live in SecureStore only (Keychain / Keystore), never AsyncStorage.
import { secureStorage } from '@/lib/secureStorage';
import type { Tokens } from '@/lib/auth/keycloak';

const KEY = 'rwa_session';

export async function loadTokens(): Promise<Tokens | null> {
  try {
    const raw = await secureStorage.getItemAsync(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<Tokens>;
    return t.accessToken && t.refreshToken && typeof t.expiresAt === 'number' ? (t as Tokens) : null;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await secureStorage.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await secureStorage.deleteItemAsync(KEY);
}

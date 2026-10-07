// context/AuthContext.tsx
// Session state for the Admin app.
//
//   loading → signedOut | locked | signedIn
//
// `locked` means "signed in, but the app asks for biometrics / device PIN
// first": on cold start and after 60 s in the background (lock-policy.ts).
// Tokens live in SecureStore; the access token is refreshed single-flight just
// before it expires; sign-out revokes the refresh token.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import i18n from '@/lib/i18n';
import { readClaims, type AdminClaims } from '@/lib/auth/claims';
import {
  AuthError,
  refreshTokens,
  revokeRefreshToken,
  signInWithPassword,
  type Tokens,
} from '@/lib/auth/keycloak';
import { needsRefresh, shouldLock } from '@/lib/auth/lock-policy';
import { clearTokens, loadTokens, saveTokens } from '@/lib/auth/session-store';

export type AuthStatus = 'loading' | 'signedOut' | 'locked' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  claims: AdminClaims | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Unlocks via biometrics / device PIN. Resolves true when unlocked. */
  unlock: () => Promise<boolean>;
  /** A fresh access token for an API call, or null when there is no session. */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Can this device ask for biometrics or a PIN at all? When it cannot (no
 * hardware, or nothing enrolled) there is nothing to unlock with, so the lock
 * is skipped rather than trapping the admin out. REQUIREMENTS section 7 says
 * "where the OS allows"; this is that clause.
 */
async function deviceCanLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [claims, setClaims] = useState<AdminClaims | null>(null);
  const tokensRef = useRef<Tokens | null>(null);
  const refreshing = useRef<Promise<Tokens> | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const adopt = useCallback(async (tokens: Tokens) => {
    tokensRef.current = tokens;
    setClaims(readClaims(tokens.accessToken));
    await saveTokens(tokens);
  }, []);

  const endSession = useCallback(async () => {
    tokensRef.current = null;
    setClaims(null);
    setStatus('signedOut');
    await clearTokens();
  }, []);

  // Cold start: restore, refresh if needed, then lock.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let tokens = await loadTokens();
      if (tokens && needsRefresh(tokens.expiresAt, Date.now())) {
        try {
          tokens = await refreshTokens(tokens.refreshToken);
        } catch (e) {
          // A dead refresh token ends the session. A network or server failure
          // does not: the tokens may still be good once the admin is online.
          if (e instanceof AuthError && e.code === 'SESSION_EXPIRED') tokens = null;
        }
      }
      if (cancelled) return;
      if (!tokens || !readClaims(tokens.accessToken)) {
        await endSession();
        return;
      }
      await adopt(tokens);
      setStatus((await deviceCanLock()) ? 'locked' : 'signedIn');
    })();
    return () => {
      cancelled = true;
    };
  }, [adopt, endSession]);

  // Re-lock after a long stay in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async next => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      const left = backgroundedAt.current;
      backgroundedAt.current = null;
      if (shouldLock(left, Date.now()) && (await deviceCanLock())) {
        setStatus(s => (s === 'signedIn' ? 'locked' : s));
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await signInWithPassword(email, password);
      await adopt(tokens);
      setStatus('signedIn');
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    await endSession();
    if (refreshToken) await revokeRefreshToken(refreshToken);
  }, [endSession]);

  const unlock = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.t('lock.prompt'),
      });
      if (result.success) setStatus('signedIn');
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    const current = tokensRef.current;
    if (!current) return null;
    if (!needsRefresh(current.expiresAt, Date.now())) return current.accessToken;
    // One refresh in flight: Keycloak rotates refresh tokens, so two parallel
    // refreshes would invalidate each other.
    refreshing.current ??= refreshTokens(current.refreshToken).finally(() => {
      refreshing.current = null;
    });
    try {
      const fresh = await refreshing.current;
      await adopt(fresh);
      return fresh.accessToken;
    } catch (e) {
      if (e instanceof AuthError && e.code === 'SESSION_EXPIRED') await endSession();
      return null;
    }
  }, [adopt, endSession]);

  const value = useMemo(
    () => ({ status, claims, signIn, signOut, unlock, getAccessToken }),
    [status, claims, signIn, signOut, unlock, getAccessToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { ApiError, request } from '../lib/api';
import type { User } from '../types';
import { savedPushToken } from '../lib/push';

const key = 'oxgen.member.session.v1';
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, gcTime: 5 * 60000, retry: (count, error) => !(error instanceof ApiError && [401, 403].includes(error.status)) && count < 1 } } });
// Web preview uses memory only. Native session tokens live in Keychain/Keystore.
let previewToken: string | null = null;
async function readToken() { return Platform.OS === 'web' ? previewToken : SecureStore.getItemAsync(key); }
async function saveToken(value: string | null) {
  if (Platform.OS === 'web') { previewToken = value; return; }
  if (value) await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(key);
}
type Session = { token: string | null; user: User | null; loading: boolean; recoveryError: string | null; signIn: (identifier: string, password: string) => Promise<void>; signOut: (allDevices?: boolean) => Promise<void>; expire: () => Promise<void>; restore: () => Promise<void>; reloadUser: () => Promise<void> };
const Context = createContext<Session | null>(null);

function SessionProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null), [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [recoveryError, setRecoveryError] = useState<string | null>(null);
  const operation = useRef(false);
  const expire = useCallback(async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    setUser(null); setToken(null); setRecoveryError(null);
    await saveToken(null);
  }, []);
  const restore = useCallback(async () => {
    setLoading(true); setRecoveryError(null);
    try {
      const saved = await readToken();
      if (!saved) return;
      const result = await request<{ user: User; permissions: Record<string, boolean> }>('/api/auth/me', { token: saved });
      if (!['MEMBER', 'TRAINER', 'OWNER', 'RECEPTIONIST'].includes(result.user.role)) { await saveToken(null); return; }
      setToken(saved); setUser({ ...result.user, permissions: result.permissions });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await expire();
      else setRecoveryError(error instanceof Error ? error.message : 'Cannot restore your session.');
    } finally { setLoading(false); }
  }, [expire]);
  useEffect(() => { void Promise.resolve().then(restore); const sub = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active')); return () => sub.remove(); }, [restore]);
  const reloadUser = async () => { const result = await request<{ user: User; permissions: Record<string, boolean> }>('/api/auth/me', { token, fresh: true }); setUser({ ...result.user, permissions: result.permissions }); };
  const signIn = async (identifier: string, password: string) => {
    if (operation.current) return; operation.current = true;
    let created: string | undefined;
    try {
      const result = await request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: { identifier: identifier.trim(), password } });
      created = result.token;
      if (!['MEMBER', 'TRAINER', 'OWNER', 'RECEPTIONIST'].includes(result.user.role) || !created) throw new ApiError('This account cannot use the gym app.', 403);
      const profile = await request<{ user: User; permissions: Record<string, boolean> }>('/api/auth/me', { token: created });
      await saveToken(created); queryClient.clear(); setToken(created); setUser({ ...profile.user, permissions: profile.permissions }); setRecoveryError(null);
    } catch (error) { if (created) await request('/api/auth/logout', { token: created, method: 'POST', body: {} }).catch(() => {}); throw error; }
    finally { operation.current = false; }
  };
  const signOut = async (allDevices = false) => {
    if (operation.current) return; operation.current = true;
    try { const deviceToken = await savedPushToken(); await request('/api/auth/logout', { token, method: 'POST', body: { allDevices, deviceToken } }); await expire(); }
    finally { operation.current = false; }
  };
  return <Context.Provider value={{ token, user, loading, recoveryError, signIn, signOut, expire, restore, reloadUser }}>{children}</Context.Provider>;
}
export function Providers({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}><SessionProvider>{children}</SessionProvider></QueryClientProvider>; }
export function useSession() { const value = useContext(Context); if (!value) throw new Error('Session provider missing'); return value; }


import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../providers/session';
import { savedPushToken, rememberPushToken, onPushEnabled } from '../lib/push';
import { request } from '../lib/api';

export function PushEvents() {
  const { token, user } = useSession(), cache = useQueryClient();
  useEffect(() => {
    if (!token || !user || user.role !== 'MEMBER' || user.mustChangePassword || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient' || !Constants.expoConfig?.extra?.[Platform.OS === 'android' ? 'firebaseConfiguredAndroid' : 'firebaseConfiguredIos']) return;
    let alive = true, starting = false, attached = false; const dispose: (() => void)[] = [];
    const refresh = () => { if (alive) void cache.invalidateQueries({ queryKey: ['member', user.id] }); };
    // Server links are never opened directly; route only to member-owned screens.
    const open = (url?: string) => { if (!alive) return; refresh(); const route = url?.includes('payment') ? '/payments' : url?.includes('membership') ? '/membership' : url?.includes('workout') ? '/workout' : url?.includes('diet') ? '/diet' : '/updates'; router.push(route); };
    const start = () => { if (starting || attached || !alive) return; starting = true; void (async () => {
      if (!await savedPushToken()) return;
      const notifications = await import('expo-notifications'); if (!(await notifications.getPermissionsAsync()).granted || !alive) return;
      const messaging = await import('@react-native-firebase/messaging'), client = messaging.getMessaging();
      const register = async (deviceToken: string) => { if (alive) { await request('/api/v1/member/devices/token', { token, method: 'POST', body: { token: deviceToken, platform: Platform.OS } }); await rememberPushToken(deviceToken); } };
      await register(await messaging.getToken(client)); if (!alive) return;
      dispose.push(messaging.onTokenRefresh(client, value => { void register(value).catch(() => {}); }), messaging.onMessage(client, refresh), messaging.onNotificationOpenedApp(client, message => open(String(message.data?.actionUrl || ''))));
      attached = true;
      const initial = await messaging.getInitialNotification(client); if (initial) open(String(initial.data?.actionUrl || ''));
    })().catch(() => {}).finally(() => { starting = false; }); };
    dispose.push(onPushEnabled(start)); start();
    return () => { alive = false; dispose.forEach(remove => remove()); };
  }, [token, user, cache]);
  return null;
}

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { request } from './api';

let registered: { token: string; session: string } | null = null;
const listeners = new Set<() => void>();
export function onPushEnabled(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function enablePush(session: string) {
  if (!Device.isDevice || Platform.OS === 'web') throw new Error('Notifications need a physical phone and a development or release build.');
  if (!Constants.expoConfig?.extra?.[Platform.OS === 'android' ? 'firebaseConfiguredAndroid' : 'firebaseConfiguredIos']) throw new Error('Firebase phone configuration is needed before push notifications can be enabled.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('oxgen_gym_alerts', { name: 'Gym updates', importance: Notifications.AndroidImportance.HIGH });
  const permissions = await Notifications.requestPermissionsAsync(); if (!permissions.granted) throw new Error('Allow notifications in your phone settings to receive gym updates.');
  const { getMessaging, getToken, registerDeviceForRemoteMessages } = await import('@react-native-firebase/messaging'), messaging = getMessaging();
  if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
  const token = await getToken(messaging);
  await request('/api/v1/member/devices/token', { token: session, method: 'POST', body: { token, platform: Platform.OS, deviceModel: Device.modelName } });
  registered = { token, session }; await SecureStore.setItemAsync('oxgen.push.token', token); listeners.forEach(listener => listener()); return token;
}
export async function savedPushToken() { return Platform.OS === 'web' ? null : SecureStore.getItemAsync('oxgen.push.token'); }
export async function rememberPushToken(token: string) { if (Platform.OS !== 'web') await SecureStore.setItemAsync('oxgen.push.token', token); }
export async function unlinkPush(session: string, all = false) {
  if (all) await request('/api/v1/member/devices/token', { token: session, method: 'DELETE' });
  else if (registered?.session === session) await request(`/api/v1/member/devices/token?token=${encodeURIComponent(registered.token)}`, { token: session, method: 'DELETE' });
  registered = null;
}

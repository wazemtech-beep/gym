import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { ApiError, request } from './api';

export type QueuedWorkout = { id: string; body: Record<string, unknown>; error?: string };
const memory = new Map<string, string>();
const read = (key: string) => Platform.OS === 'web' ? Promise.resolve(memory.get(key) || null) : SecureStore.getItemAsync(key);
const write = async (key: string, value: string) => { if (Platform.OS === 'web') memory.set(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); };
const remove = async (key: string) => { if (Platform.OS === 'web') memory.delete(key); else await SecureStore.deleteItemAsync(key); };
let serial = Promise.resolve();
function exclusive<T>(work: () => Promise<T>): Promise<T> { const result = serial.then(work, work); serial = result.then(() => {}, () => {}); return result; }
const scope = (user: string, name: string) => `oxgen.${user.replace(/[^\w.-]/g, '')}.${name}`;
// Chunked Keychain/Keystore storage keeps sensitive offline records encrypted.
async function load<T>(key: string): Promise<T | null> {
  const index = await read(key); if (!index) return null;
  const { generation, count } = JSON.parse(index) as { generation: string; count: number };
  let content = ''; for (let i = 0; i < count; i++) { const chunk = await read(`${key}.${generation}.${i}`); if (chunk === null) throw new Error('Offline data is incomplete. Please reconnect before saving.'); content += chunk; }
  return JSON.parse(content) as T;
}
async function store(key: string, data: unknown) {
  const old = await read(key), content = JSON.stringify(data), generation = Crypto.randomUUID(), count = Math.ceil(content.length / 450);
  for (let i = 0; i < count; i++) await write(`${key}.${generation}.${i}`, content.slice(i * 450, (i + 1) * 450));
  await write(key, JSON.stringify({ generation, count }));
  if (old) { const previous = JSON.parse(old); for (let i = 0; i < previous.count; i++) await remove(`${key}.${previous.generation}.${i}`).catch(() => {}); }
}
export const readQueue = (user: string) => exclusive(async () => await load<QueuedWorkout[]>(scope(user, 'workouts')) || []);
export const queueWorkout = (user: string, entry: QueuedWorkout) => exclusive(async () => {
  const key = scope(user, 'workouts'), entries = await load<QueuedWorkout[]>(key) || [];
  if (entries.length >= 50 && !entries.some(item => item.id === entry.id)) throw new Error('Sync your pending workouts before adding more.');
  await store(key, [...entries.filter(item => item.id !== entry.id), entry]);
});
export const discardWorkout = (user: string, id: string) => exclusive(async () => { const key = scope(user, 'workouts'); await store(key, (await load<QueuedWorkout[]>(key) || []).filter(item => item.id !== id)); });
export const saveWorkoutPlan = (user: string, plan: unknown) => exclusive(() => store(scope(user, 'plan'), plan));
export const readWorkoutPlan = <T>(user: string) => exclusive(() => load<T>(scope(user, 'plan')));
export async function syncWorkouts(user: string, token: string, stillCurrent: () => boolean) {
  return exclusive(async () => {
    const key = scope(user, 'workouts'); let entries = await load<QueuedWorkout[]>(key) || [];
    for (const item of [...entries]) {
      if (!stillCurrent()) break;
      try { await request('/api/v1/member/workout/session', { token, method: 'POST', body: item.body }); entries = entries.filter(entry => entry.id !== item.id); await store(key, entries); }
      catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) throw cause;
        if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) { entries = entries.map(entry => entry.id === item.id ? { ...entry, error: cause.message } : entry); await store(key, entries); }
        else break;
      }
    }
    return entries;
  });
}

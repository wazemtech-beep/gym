import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import type { Permission, RecordType } from 'react-native-health-connect';
import type { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';
import { request } from './api';

export const healthCategories = ['STEPS', 'DISTANCE', 'ACTIVE_CALORIES', 'EXERCISE_SESSIONS'] as const;
const recordTypes: Record<(typeof healthCategories)[number], RecordType> = { STEPS: 'Steps', DISTANCE: 'Distance', ACTIVE_CALORIES: 'ActiveCaloriesBurned', EXERCISE_SESSIONS: 'ExerciseSession' };
async function client() {
  if (Platform.OS !== 'android') throw new Error('Health Connect is only available on Android phones.');
  let health: typeof import('react-native-health-connect');
  try {
    health = await import('react-native-health-connect');
  } catch {
    throw new Error('Health Connect native module is not available in Expo Go. APK build is required.');
  }
  try {
    const status = await health.getSdkStatus?.();
    if (status === 1) throw new Error('Health Connect is not installed. Install Health Connect from Play Store.');
    if (status === 2) throw new Error('Please update Health Connect from Play Store.');
  } catch (statusError) {
    if (statusError instanceof Error && statusError.message.includes('Play Store')) throw statusError;
  }
  const initialized = await health.initialize().catch(() => false);
  if (!initialized) throw new Error('Health Connect permission dialog cannot open in Expo Go. Build an APK to test real phone sensors.');
  return health;
}
function categories(permissions: { accessType: string; recordType: string }[]) { return healthCategories.filter(category => permissions.some(item => item.accessType === 'read' && item.recordType === recordTypes[category])); }
export async function connectHealth(token: string, selected: string[]) {
  const health = await client(), permissions: Permission[] = healthCategories.filter(category => selected.includes(category)).map(category => ({ accessType: 'read', recordType: recordTypes[category] }));
  await health.requestPermission(permissions);
  const granted = await health.getGrantedPermissions(), reportedPermissions = categories(granted.filter((item): item is Permission => 'recordType' in item));
  await request('/api/v1/member/fitness/connection', { token, method: 'POST', body: { platform: 'HEALTH_CONNECT', reportedPermissions, deviceModel: Device.modelName, appVersion: '1.0.0' } });
  return reportedPermissions;
}
export async function openHealthSettings() { (await client()).openHealthConnectSettings(); }
export async function syncHealth(token: string, allowReimport = false) {
  const privacy = (await request<{ data: { connection: { status: string; backendUploadConsent: boolean } } }>('/api/v1/member/fitness/privacy', { token, fresh: true })).data;
  if (privacy.connection.status === 'DISCONNECTED' || !privacy.connection.backendUploadConsent) throw new Error('Connect your phone and grant cloud storage consent before syncing.');
  const health = await client(), granted = categories((await health.getGrantedPermissions()).filter((item): item is Permission => 'recordType' in item));
  await request('/api/v1/member/fitness/connection', { token, method: 'POST', body: { reportedPermissions: granted, platform: 'HEALTH_CONNECT' } });
  if (!granted.length) throw new Error('No Health Connect read permissions are granted.');
  const now = Date.now(), today = new Date(now + 5 * 3600000).toISOString().slice(0, 10), summaries = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(Date.parse(today + 'T00:00:00Z') - offset * 86400000).toISOString().slice(0, 10), start = Date.parse(day + 'T00:00:00+05:00'), timeRangeFilter: TimeRangeFilter = { operator: 'between', startTime: new Date(start).toISOString(), endTime: new Date(Math.min(start + 86400000, now)).toISOString() };
    const steps = granted.includes('STEPS') ? await health.aggregateRecord({ recordType: 'Steps', timeRangeFilter }) : null;
    const distance = granted.includes('DISTANCE') ? await health.aggregateRecord({ recordType: 'Distance', timeRangeFilter }) : null;
    const calories = granted.includes('ACTIVE_CALORIES') ? await health.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }) : null;
    const hasSteps = !!steps?.dataOrigins.length, hasDistance = !!distance?.dataOrigins.length, hasCalories = !!calories?.dataOrigins.length;
    summaries.push({ date: day, steps: hasSteps ? steps!.COUNT_TOTAL : null, distanceKm: hasDistance ? distance!.DISTANCE.inKilometers : null, activeCalories: hasCalories ? calories!.ACTIVE_CALORIES_TOTAL.inKilocalories : null, hasData: hasSteps || hasDistance || hasCalories, source: 'HEALTH_CONNECT', coverageNote: day === today ? 'Partial day; permitted data only' : 'Permitted data only; missing metrics remain unknown' });
  }
  const sessions = [];
  if (granted.includes('EXERCISE_SESSIONS')) {
    const timeRangeFilter: TimeRangeFilter = { operator: 'between', startTime: new Date(Date.parse(today + 'T00:00:00+05:00') - 6 * 86400000).toISOString(), endTime: new Date(now).toISOString() }; let pageToken: string | undefined;
    do {
      const result = await health.readRecords('ExerciseSession', { timeRangeFilter, pageSize: 100, pageToken });
      for (const record of result.records) { if (!record.metadata?.id) continue; sessions.push({ sourceRecordId: record.metadata.id, exerciseType: String(record.exerciseType), title: record.title || null, startTime: record.startTime, endTime: record.endTime, durationMinutes: Math.round((Date.parse(record.endTime) - Date.parse(record.startTime)) / 60000), source: 'HEALTH_CONNECT' }); }
      pageToken = result.pageToken || undefined;
    } while (pageToken);
  }
  return request('/api/v1/member/fitness/sync', { token, method: 'POST', body: { batchId: Crypto.randomUUID(), summaries, sessions, deviceTimezone: 'Asia/Karachi', explicitReimportConsent: allowReimport, allowReimportDeletedRange: allowReimport } });
}

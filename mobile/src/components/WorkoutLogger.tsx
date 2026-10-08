import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { Button, Card, Field, styles } from './ui';
import { ActionNotice, Choices, Toggle } from './controls';
import { useSession } from '../providers/session';
import { useMemberAction } from '../hooks/action';
import { useMemberQuery } from '../hooks/member';
import { queueWorkout, readQueue, discardWorkout, syncWorkouts, type QueuedWorkout } from '../lib/offline';
import type { Dashboard } from '../types';
import { date } from '../theme';

export function WorkoutLogger({ dashboard }: { dashboard: Dashboard }) {
  const action = useMemberAction(), { user } = useSession(), workout = dashboard.todayWorkout;
  const [status, setStatus] = useState('COMPLETED'), [notes, setNotes] = useState(''), [duration, setDuration] = useState(''), [pending, setPending] = useState<QueuedWorkout[]>([]), [values, setValues] = useState<Record<string, { reps?: string; weight?: string; duration?: string; skipped?: boolean }>>({});
  useEffect(() => { let active = true; if (user) void readQueue(user.id).then(rows => { if (active) setPending(rows); }).catch(() => {}); return () => { active = false; }; }, [user]);
  const update = (key: string, value: object) => setValues(previous => ({ ...previous, [key]: { ...previous[key], ...value } }));
  async function save() {
    await action.run(async () => {
      if (!workout || !user || !dashboard.member) throw new Error('A workout plan is required.');
      if (status === 'SKIPPED' && !notes.trim()) throw new Error('Add a reason for skipping.');
      const minutes = duration ? Number(duration) : null; if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)) throw new Error('Enter a valid duration.');
      const numeric = (value?: string) => { if (!value) return null; const n = Number(value); if (!Number.isFinite(n) || n < 0) throw new Error('Enter valid reps, weight and duration.'); return n; };
      const day = new Date(Date.now() + 18000000).toISOString().slice(0, 10), queued = await readQueue(user.id);
      const existing = queued.find(entry => entry.body.planId === workout.planId && new Date(Date.parse(String(entry.body.sessionDate)) + 18000000).toISOString().slice(0, 10) === day);
      const id = workout.session?.id || existing?.id || Crypto.randomUUID();
      const logs = workout.exercises.flatMap(exercise => Array.from({ length: Math.max(1, Math.min(exercise.sets || 1, 30)) }, (_, index) => {
        const input = values[`${exercise.id}.${index}`] || {};
        return { workoutExerciseId: exercise.id, exerciseName: exercise.name, exerciseType: exercise.type, setNumber: index + 1, plannedReps: exercise.reps, actualReps: numeric(input.reps), actualWeight: numeric(input.weight), actualDuration: numeric(input.duration), isSkipped: status === 'SKIPPED' || !!input.skipped };
      }));
      await queueWorkout(user.id, { id, body: { sessionId: id, expectedMemberId: dashboard.member.id, planId: workout.planId, workoutDayId: workout.dayId, sessionDate: new Date().toISOString(), status, durationMinutes: minutes, memberNotes: notes, skipReason: status === 'SKIPPED' ? notes : undefined, completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined, exerciseLogs: logs } });
      const state = await NetInfo.fetch(); if (state.isConnected && action.token) await syncWorkouts(user.id, action.token, () => true);
      setPending(await readQueue(user.id));
    }, 'Workout saved. Any pending entry will submit when you reconnect.');
  }
  return <><Card title="Log this workout">{workout ? <><Choices label="Session status" value={status} onChange={setStatus} options={['COMPLETED', 'IN_PROGRESS', 'SKIPPED'].map(value => ({ label: value.replaceAll('_', ' '), value }))} /><Field label="Duration (minutes)" keyboardType="number-pad" value={duration} onChangeText={setDuration} />{status !== 'SKIPPED' && workout.exercises.map(exercise => <View key={exercise.id} style={{ gap: 12 }}><Text style={styles.label}>{exercise.name}</Text>{Array.from({ length: Math.max(1, Math.min(exercise.sets || 1, 30)) }, (_, index) => { const key = `${exercise.id}.${index}`, value = values[key] || {}; return <View key={key} style={{ gap: 10 }}><Text style={styles.muted}>Set {index + 1}</Text><View style={[styles.row, { alignItems: 'flex-start' }]}><View style={{ flex: 1 }}><Field label="Reps" value={value.reps || ''} keyboardType="number-pad" onChangeText={reps => update(key, { reps })} /></View><View style={{ flex: 1 }}><Field label="Weight (kg)" value={value.weight || ''} keyboardType="decimal-pad" onChangeText={weight => update(key, { weight })} /></View></View><Field label="Duration (seconds, optional)" value={value.duration || ''} keyboardType="number-pad" onChangeText={duration => update(key, { duration })} /><Toggle label="Skipped this set" value={!!value.skipped} onChange={skipped => update(key, { skipped })} /></View>; })}</View>)}<Field label={status === 'SKIPPED' ? 'Skip reason' : 'Session notes'} multiline value={notes} onChangeText={setNotes} /><Button title="Save workout" busy={action.busy} onPress={() => void save()} /></> : <Text style={styles.muted}>No assigned workout today.</Text>}<ActionNotice error={action.error} notice={action.notice} /></Card><Card title={`Pending sync (${pending.length})`}><Button secondary title="Sync now" busy={action.busy} onPress={() => void action.run(async () => { if (user && action.token) setPending(await syncWorkouts(user.id, action.token, () => true)); }, 'Sync attempted.')} />{pending.map(item => <View key={item.id} style={{ gap: 8 }}><Text style={styles.muted}>{String(item.body.status)} · {date(String(item.body.sessionDate))}</Text>{item.error && <Text style={styles.error}>{item.error}</Text>}<Button secondary title="Discard pending entry" onPress={() => Alert.alert('Discard workout?', 'This removes this unsent entry from your phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => void action.run(async () => { if (user) { await discardWorkout(user.id, item.id); setPending(await readQueue(user.id)); } }) }])} /></View>)}</Card></>;
}
export function WorkoutHistory() {
  const [page, setPage] = useState(1), query = useMemberQuery<{ rows: { id: string; sessionDate: string; status: string; durationMinutes: number | null; trainerFeedback: string | null; exerciseLogs: { id: string; exerciseName: string; actualReps: number | null; actualWeight: number | null }[] }[]; total: number; plan: { title: string; workoutDays: { id: string; title: string; dayOfWeek: string; exercises: { id: string; name: string; sets: number | null; reps: string | null; restSeconds: number | null; instructions: string | null }[] }[] } | null }>(`/api/v1/member/history?section=workout&page=${page}`);
  return <><Card title="Weekly plan">{query.data?.plan?.workoutDays.map(day => <View key={day.id} style={{ gap: 8 }}><Text style={styles.label}>{day.dayOfWeek} · {day.title}</Text>{day.exercises.map(exercise => <View key={exercise.id}><Text style={styles.text}>{exercise.name} · {exercise.sets ?? "—"} sets · {exercise.reps ?? "—"} reps · {exercise.restSeconds ?? "—"}s rest</Text>{exercise.instructions && <Text style={styles.muted}>{exercise.instructions}</Text>}</View>)}<View style={styles.divider} /></View>)}</Card><Card title="Previous sessions">{query.data?.rows.map(row => <View key={row.id} style={{ gap: 8 }}><Text style={styles.label}>{date(row.sessionDate)} · {row.status}</Text><Text style={styles.muted}>{row.durationMinutes ?? '—'} minutes</Text>{row.trainerFeedback && <Text style={styles.text}>Trainer: {row.trainerFeedback}</Text>}{row.exerciseLogs.map(log => <Text key={log.id} style={styles.muted}>{log.exerciseName} · {log.actualReps ?? '—'} reps · {log.actualWeight ?? '—'} kg</Text>)}<View style={styles.divider} /></View>)}<View style={styles.row}><Button secondary title="Previous" disabled={page === 1} onPress={() => setPage(page - 1)} /><Button secondary title="Next" disabled={!query.data || page * 20 >= query.data.total} onPress={() => setPage(page + 1)} /></View></Card></>;
}


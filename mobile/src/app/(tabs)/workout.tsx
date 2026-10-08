import { WorkoutLogger, WorkoutHistory } from '../../components/WorkoutLogger';
import { useEffect, useState } from 'react';
import { readWorkoutPlan, saveWorkoutPlan } from '../../lib/offline';
import { useSession } from '../../providers/session';
import type { Dashboard } from '../../types';
import { Link } from 'expo-router';
import { Linking, RefreshControl, Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../../components/ui';
import { useDashboard } from '../../hooks/member';
import { colors } from '../../theme';

export default function Workout() {
  const query = useDashboard(), { user } = useSession(), [saved, setSaved] = useState<Dashboard | null>(null), dashboard = query.data || saved, workout = dashboard?.todayWorkout; useEffect(() => { let active = true; if (user) void readWorkoutPlan<{ day: string; data: Dashboard }>(user.id).then(snapshot => { if (active && snapshot?.day === new Date(Date.now() + 18000000).toISOString().slice(0, 10)) setSaved(snapshot.data); }).catch(() => {}); return () => { active = false; }; }, [user]); useEffect(() => { if (user && query.data) void saveWorkoutPlan(user.id, { day: new Date(Date.now() + 18000000).toISOString().slice(0, 10), data: query.data }).catch(() => {}); }, [user, query.data]);
  return <Screen refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}><Heading>Your training</Heading><View style={styles.row}><Link href="/diet" style={styles.text}>Diet →</Link><Link href="/progress" style={styles.text}>Progress →</Link></View><ErrorNotice error={query.error} retry={() => void query.refetch()} />{!dashboard ? <><LoadingCard title="Today's workout" /><LoadingCard title="Your trainer" /></> : <><Card title={workout?.dayTitle || 'No workout scheduled'}><Text style={styles.muted}>{workout?.planTitle || 'Your trainer will publish your training plan here.'}</Text>{workout?.session && <Text style={styles.text}>{workout.session.status.replaceAll('_', ' ')}</Text>}</Card>{workout?.exercises.map((exercise, index) => <Card key={exercise.id} title={`${index + 1}. ${exercise.name}`}><Text style={styles.text}>{exercise.sets || '—'} sets · {exercise.reps || '—'} reps{exercise.restSeconds ? ` · ${exercise.restSeconds}s rest` : ''}</Text>{!!exercise.instructions && <Text style={styles.muted}>{exercise.instructions}</Text>}{exercise.demoVideoUrl?.startsWith('https://') && <Button secondary title="Watch exercise demo" onPress={() => void Linking.openURL(exercise.demoVideoUrl!)} />}</Card>)}<Card title="Your trainer"><Text style={styles.text}>{dashboard.trainer?.name || 'Not assigned'}</Text><Text style={styles.muted}>{dashboard.trainer?.coachingFocus || 'Reception can help with a trainer assignment.'}</Text></Card></>}{dashboard && <WorkoutLogger dashboard={dashboard} />}<WorkoutHistory /></Screen>;
}




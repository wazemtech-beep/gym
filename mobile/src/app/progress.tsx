import { ProgressChart } from '../components/ProgressChart';
import { MeasurementForm, ProgressGoals, ProgressPhotos } from '../components/ProgressActions';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../components/ui';
import { useMemberQuery } from '../hooks/member';
import { date } from '../theme';

type Measurement = { id: string; date: string; weightKg: number | null; waistCm: number | null };
type Progress = { hasEntries: boolean; latest: Measurement | null; comparison: { weightChangeKg: number | null } | null; measurements: Measurement[] };
export default function ProgressScreen() {
  const query = useMemberQuery<Progress>('/api/v1/member/progress/measurements');
  return <Screen><Link href="/workout" style={styles.text}>← Training</Link><Heading>Your progress</Heading><MeasurementForm /><ProgressGoals /><ErrorNotice error={query.error} retry={() => void query.refetch()} />{!query.data ? <><LoadingCard title="Latest measurements" /><LoadingCard title="Measurement history" /></> : <><Card title="Latest measurements"><Text style={styles.heading}>{query.data.latest?.weightKg != null ? `${query.data.latest.weightKg} kg` : 'No weight recorded'}</Text>{query.data.latest && <Text style={styles.muted}>{date(query.data.latest.date)}</Text>}{query.data.comparison?.weightChangeKg != null && <Text style={styles.text}>{query.data.comparison.weightChangeKg > 0 ? '+' : ''}{query.data.comparison.weightChangeKg} kg since baseline</Text>}</Card><ProgressChart readings={query.data.measurements} /><Card title="Measurement history">{query.data.measurements.length ? [...query.data.measurements].reverse().map(row => <View key={row.id} style={{ gap: 8 }}><Text style={styles.label}>{date(row.date)}</Text><Text style={styles.text}>Weight: {row.weightKg != null ? `${row.weightKg} kg` : '—'} · Waist: {row.waistCm != null ? `${row.waistCm} cm` : '—'}</Text><View style={styles.divider} /></View>) : <Text style={styles.muted}>No measurements yet.</Text>}</Card></>}<ProgressPhotos /></Screen>;
}



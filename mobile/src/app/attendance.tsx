import { useState } from 'react';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../components/ui';
import { useMemberQuery } from '../hooks/member';
import { date } from '../theme';
export default function Attendance() {
  const [page, setPage] = useState(1), query = useMemberQuery<{ enabled: boolean; total: number; rows: { id: string; checkIn: string; method: string; membership: { planName: string } | null }[] }>(`/api/v1/member/history?section=attendance&page=${page}`);
  return <Screen><Link href="/account" style={styles.text}>← Account</Link><Heading>Attendance</Heading><ErrorNotice error={query.error} retry={() => void query.refetch()} /><Card title="Your visits">{!query.data ? <LoadingCard title="Attendance history" /> : !query.data.enabled ? <Text style={styles.muted}>Attendance history is disabled by your gym.</Text> : <>{query.data.rows.length ? query.data.rows.map(row => <View key={row.id} style={{ gap: 6 }}><Text style={styles.label}>{date(row.checkIn)}</Text><Text style={styles.muted}>{row.method} · {row.membership?.planName}</Text><View style={styles.divider} /></View>) : <Text style={styles.muted}>No visits recorded.</Text>}<View style={styles.row}><Button secondary title="Previous" disabled={page === 1} onPress={() => setPage(page - 1)} /><Button secondary title="Next" disabled={page * 20 >= query.data.total} onPress={() => setPage(page + 1)} /></View></>}</Card></Screen>;
}

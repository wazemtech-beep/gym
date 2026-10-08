import { Text, View } from 'react-native';
import { Card, styles } from './ui';
import { colors, date } from '../theme';
export function ProgressChart({ readings }: { readings: { id: string; date: string; weightKg: number | null }[] }) {
  const points = readings.filter(row => row.weightKg !== null).slice(-12), minimum = Math.min(...points.map(row => row.weightKg!), 0), maximum = Math.max(...points.map(row => row.weightKg!), 1);
  return <Card title="Weight trend">{points.length ? points.map(point => <View key={point.id} style={{ gap: 5 }}><View style={styles.row}><Text style={styles.muted}>{date(point.date)}</Text><Text style={styles.label}>{point.weightKg} kg</Text></View><View style={{ backgroundColor: colors.soft, height: 10, borderRadius: 5 }}><View accessibilityLabel={`${date(point.date)}, ${point.weightKg} kilograms`} style={{ width: `${Math.max(2, (point.weightKg! - minimum) / (maximum - minimum) * 100)}%`, backgroundColor: colors.primary, height: 10, borderRadius: 5 }} /></View></View>) : <Text style={styles.muted}>Add weight readings to see your trend.</Text>}</Card>;
}

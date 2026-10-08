import { Pressable, Switch, Text, View } from 'react-native';
import { colors } from '../theme';
import { styles } from './ui';

export function Choices({ label, options, value, onChange, disabled }: { label: string; options: { label: string; value: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <View style={{ gap: 10 }}><Text style={styles.label}>{label}</Text><View style={{ gap: 8 }}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)} style={{ padding: 13, borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.border, backgroundColor: value === option.value ? colors.soft : colors.surface, borderRadius: 10 }}><Text style={styles.text}>{value === option.value ? '● ' : '○ '}{option.label}</Text></Pressable>)}</View></View>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <View style={styles.row}><Text style={[styles.text, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} /></View>; }
export function ActionNotice({ error, notice }: { error?: string; notice?: string }) { return <>{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice && <Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}</>; }

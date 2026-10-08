import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorNotice, Field, Heading, LoadingCard, Screen, styles } from '../../components/ui';
import { useMemberQuery } from '../../hooks/member';
import { useSession } from '../../providers/session';
import { request } from '../../lib/api';

type Profile = { fullName: string; memberId: string; phone: string; email: string | null; address: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null };
export default function Account() {
  const { user, token, signOut, expire } = useSession(), query = useMemberQuery<Profile>('/api/v1/member/profile'), cache = useQueryClient();
  const [form, setForm] = useState({ address: '', emergencyContactName: '', emergencyContactPhone: '' }), [security, setSecurity] = useState<'email' | 'password' | null>(null), [email, setEmail] = useState(''), [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const dirty = useRef(false), operation = useRef(false);
  useEffect(() => { if (query.data && !dirty.current) setForm({ address: query.data.address || '', emergencyContactName: query.data.emergencyContactName || '', emergencyContactPhone: query.data.emergencyContactPhone || '' }); }, [query.data]);
  async function action(work: () => Promise<void>) {
    if (operation.current) return; operation.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { operation.current = false; setBusy(false); }
  }
  const field = (key: keyof typeof form) => ({ value: form[key], editable: !busy && !!query.data, onChangeText: (value: string) => { dirty.current = true; setForm(current => ({ ...current, [key]: value })); } });
  const save = () => action(async () => { await request('/api/v1/member/profile', { token, method: 'PATCH', body: form }); dirty.current = false; await cache.invalidateQueries({ queryKey: ['member', user?.id] }); setNotice('Details saved.'); });
  const updateSecurity = () => action(async () => {
    if (security === 'email') { await request('/api/auth/change-email', { token, method: 'POST', body: { email, password: currentPassword } }); setNotice('Check your new email for the verification link.'); }
    else { if (newPassword.length < 8 || newPassword !== confirm) throw new Error('Use matching passwords of at least 8 characters.'); await request('/api/auth/change-password', { token, method: 'POST', body: { currentPassword, newPassword } }); await expire(); }
    setSecurity(null); setCurrentPassword(''); setNewPassword(''); setConfirm('');
  });
  const logout = (all: boolean) => Alert.alert(all ? 'Sign out everywhere?' : 'Sign out?', all ? 'This will end your sessions on all devices.' : 'This will end this device’s session.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => void action(() => signOut(all)) }]);
  return <Screen><Heading>Your account</Heading><ErrorNotice error={error || query.error} retry={query.error ? () => void query.refetch() : undefined} />{!!notice && <Text accessibilityRole="alert" style={styles.text}>{notice}</Text>}<Card title={query.data?.fullName || user?.name || 'Your profile'}><Text style={styles.muted}>{query.data?.memberId || user?.memberId}</Text><Text style={styles.muted}>{query.data?.email || user?.email}</Text>{!query.data && <LoadingCard title="Contact details" />}<Field label="Address" {...field('address')} multiline maxLength={500} /><Field label="Emergency contact name" {...field('emergencyContactName')} maxLength={100} /><Field label="Emergency contact mobile" {...field('emergencyContactPhone')} keyboardType="phone-pad" maxLength={25} /><Button title="Save details" disabled={!query.data} busy={busy} onPress={() => void save()} /></Card><Card title="Account security"><Button secondary title="Change login email" disabled={busy} onPress={() => { setSecurity(security === 'email' ? null : 'email'); setError(''); setCurrentPassword(''); }} /><Button secondary title="Change password" disabled={busy} onPress={() => { setSecurity(security === 'password' ? null : 'password'); setError(''); setCurrentPassword(''); }} />{security && <View style={{ gap: 14 }}>{security === 'email' && <Field label="New login email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} />}<Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry editable={!busy} />{security === 'password' && <><Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry editable={!busy} /><Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!busy} /></>}<Button title={security === 'email' ? 'Send verification' : 'Save password'} busy={busy} onPress={() => void updateSecurity()} /></View>}</Card><Card title="Sessions"><Button secondary title="Logout" busy={busy} onPress={() => logout(false)} /><Button secondary title="Logout all devices" busy={busy} onPress={() => logout(true)} /></Card><Link href="/fitness" style={styles.text}>Fitness permissions & privacy →</Link><Link href="/attendance" style={styles.text}>Attendance history →</Link><Link href="/updates" style={styles.text}>Your updates →</Link></Screen>;
}


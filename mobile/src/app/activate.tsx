import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Field, Heading, Screen, styles } from '../components/ui';
import { request } from '../lib/api';
import { ActionNotice } from '../components/controls';
export default function Activate() {
  const params = useLocalSearchParams<{ token?: string }>(), [code, setCode] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  async function submit() { if (busy) return; setBusy(true); setError(''); try { if (password.length < 8 || password !== confirm) throw new Error('Use matching passwords with at least 8 characters.'); await request('/api/auth/activate', { method: 'POST', body: { token: params.token, activationCode: code || undefined, password } }); setDone(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please retry.'); } finally { setBusy(false); } }
  return <Screen><Heading>Activate account</Heading><Card>{done ? <Text style={styles.text}>Your account is activated. You can now sign in.</Text> : <>{!params.token && <Field label="Activation code from reception" value={code} onChangeText={setCode} autoCapitalize="none" />}<Field label="New password" value={password} onChangeText={setPassword} secureTextEntry /><Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry /><Button title="Activate account" busy={busy} onPress={() => void submit()} /><ActionNotice error={error} /></>}<Link href="/sign-in" style={styles.text}>Sign in →</Link></Card></Screen>;
}

import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Field, Heading, Screen, styles } from '../components/ui';
import { request } from '../lib/api';
import { ActionNotice } from '../components/controls';
export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>(), [token, setToken] = useState(params.token || ''), [identifier, setIdentifier] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  async function submit() { if (busy) return; setBusy(true); setError(''); try { if (password.length < 8 || password !== confirm) throw new Error('Use matching passwords with at least 8 characters.'); await request(token ? '/api/auth/reset-password' : '/api/auth/reset-with-code', { method: 'POST', body: token ? { token, newPassword: password } : { identifier, resetCode: code, newPassword: password } }); setDone(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please retry.'); } finally { setBusy(false); } }
  return <Screen><Heading>Reset password</Heading><Card>{done ? <><Text style={styles.text}>Password updated. Sign in with your new password.</Text><Link href="/sign-in" style={styles.text}>Sign in →</Link></> : <><Field label="Reset link token (if supplied)" value={token} onChangeText={setToken} autoCapitalize="none" />{!token && <><Field label="Email or mobile" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" /><Field label="Reset code" value={code} onChangeText={setCode} /></>}<Field label="New password" value={password} onChangeText={setPassword} secureTextEntry /><Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry /><Button title="Reset password" busy={busy} onPress={() => void submit()} /><ActionNotice error={error} /></>}</Card></Screen>;
}


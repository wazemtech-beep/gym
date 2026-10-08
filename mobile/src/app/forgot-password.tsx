import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, ErrorNotice, Field, Heading, Screen, styles } from '../components/ui';
import { request } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await request('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim() } }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request reset.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Screen><Link href="/sign-in" style={styles.text}>← Sign in</Link><Heading>Reset your password</Heading>{sent ? <Card title="Check your email"><Text style={styles.text}>If this email has an active account, you will receive a reset link. Open it to choose a new password, then sign in here.</Text></Card> : <Card><Field label="Login email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} /><ErrorNotice error={error} /><Button title="Send reset link" busy={busy} onPress={() => void submit()} /></Card>}<Link href="/reset-password" style={styles.text}>Use a reset code →</Link></Screen>;
}


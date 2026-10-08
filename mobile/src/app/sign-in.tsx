import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorNotice, Field, Heading, Screen, styles } from '../components/ui';
import { useSession } from '../providers/session';
import { colors, fonts } from '../theme';

export default function SignIn() {
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    if (!identifier.trim() || !password) { setError('Enter your email or member ID and password.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await signIn(identifier, password); setPassword(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Screen><View style={{ marginTop: 26, marginBottom: 28, gap: 18 }}><View style={styles.row}><Ionicons name="barbell" color={colors.primary} size={36} /><Text style={{ fontFamily: fonts.heading, fontSize: 23, color: colors.ink }}>OXGEN GYM</Text></View><View style={{ backgroundColor: colors.primary, height: 5, width: 42, borderRadius: 3 }} /></View><Heading>Your gym. Your progress.</Heading><Text style={styles.muted}>Sign in to your member account.</Text><View style={[styles.card, { gap: 20 }]}><Field label="Email or member ID" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" editable={!busy} /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" editable={!busy} onSubmitEditing={() => void submit()} /><Link href="/forgot-password" style={{ ...styles.text, color: colors.primary, alignSelf: 'flex-end' }}>Forgot password?</Link><ErrorNotice error={error} /><Button title="Sign in" busy={busy} onPress={() => void submit()} /></View><View style={{ alignItems: 'center', gap: 10 }}><Text style={styles.muted}>New to the gym?</Text><Link href="/register" style={{ ...styles.text, color: colors.primary, fontFamily: fonts.bold }}>Request an account</Link><Link href="/activate" style={styles.text}>Have an activation code?</Link></View></Screen>;
}


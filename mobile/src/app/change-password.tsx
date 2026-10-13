import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, ErrorNotice, Field, Heading, Screen, styles } from '../components/ui';
import { request } from '../lib/api';
import { useSession } from '../providers/session';

export default function ChangePassword() {
  const { token, expire } = useSession();
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    if (password.length < 8 || confirm !== password) { setError('Use at least 8 characters and matching passwords.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try { await request('/api/auth/change-password', { token, method: 'POST', body: { newPassword: password } }); await expire(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save password.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Screen><Heading>Set your password</Heading><Text style={styles.muted}>Choose a new password before opening your gym account.</Text><Card><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" editable={!busy} /><Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!busy} /><ErrorNotice error={error} /><Button title="Save password" busy={busy} onPress={() => void submit()} /></Card></Screen>;
}

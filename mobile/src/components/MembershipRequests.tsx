import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, styles } from './ui';
import { ActionNotice, Choices } from './controls';
import { useDashboard } from '../hooks/member';
import { useMemberAction } from '../hooks/action';
import { money } from '../theme';

export function MembershipRequests() {
  const dashboard = useDashboard(), action = useMemberAction();
  const [mode, setMode] = useState<'renew' | 'freeze' | null>(null), [plan, setPlan] = useState(''), [start, setStart] = useState(''), [days, setDays] = useState(''), [notes, setNotes] = useState('');
  async function submit() {
    const result = mode === 'renew'
      ? await action.send('/api/v1/member/renewal-request', { feePlanId: plan, preferredStartDate: start, notes }, 'POST', 'Renewal request sent for approval.')
      : await action.send('/api/v1/member/freeze-request', { requestedDays: Number(days), reason: notes }, 'POST', 'Freeze request sent for approval.');
    if (result) { setMode(null); setNotes(''); }
  }
  return <Card title="Membership requests"><Text style={styles.muted}>Reception confirms package changes. Your fee and expiry stay unchanged until approval.</Text><Button secondary title="Request renewal" disabled={action.busy} onPress={() => { setMode(mode === 'renew' ? null : 'renew'); action.clear(); const end = dashboard.data?.membership?.endDate; setStart(end ? new Date(Math.max(new Date(end).getTime() + 86400000, Date.now()) + 18000000).toISOString().slice(0, 10) : new Date(Date.now() + 18000000).toISOString().slice(0, 10)); }} /><Button secondary title="Request freeze" disabled={action.busy || dashboard.data?.membership?.status !== 'ACTIVE'} onPress={() => { setMode(mode === 'freeze' ? null : 'freeze'); action.clear(); }} />{mode === 'renew' && <><Choices label="Choose package" value={plan} onChange={setPlan} disabled={action.busy} options={(dashboard.data?.availablePlans || []).map(item => ({ value: item.id, label: `${item.name} · ${money(item.membershipFee)}` }))} /><Field label="Preferred start date" placeholder="YYYY-MM-DD" maxLength={10} value={start} onChangeText={setStart} editable={!action.busy} /></>}{mode === 'freeze' && <Field label={`Freeze days (maximum ${dashboard.data?.freezePolicy?.maxDays || 30})`} value={days} onChangeText={setDays} keyboardType="number-pad" editable={!action.busy} />}{mode && <><Field label={mode === 'freeze' ? 'Reason' : 'Notes (optional)'} multiline value={notes} onChangeText={setNotes} maxLength={2000} editable={!action.busy} /><Button title="Send request" busy={action.busy} onPress={() => void submit()} /></>}<ActionNotice error={action.error} notice={action.notice} /></Card>;
}


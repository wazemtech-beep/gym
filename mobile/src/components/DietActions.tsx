import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, styles } from './ui';
import { Choices, ActionNotice } from './controls';
import { useMemberQuery } from '../hooks/member';
import { useMemberAction } from '../hooks/action';

const fields = { goal: 'Goal', foodPreference: 'Food preference', allergies: 'Allergies', budget: 'Food budget', routine: 'Daily routine', cookingAccess: 'Cooking access', dislikedFoods: 'Foods you dislike', restrictions: 'Diet restrictions', notes: 'Other notes' };
export function DietPreferences() {
  const query = useMemberQuery<Record<string, string> | null>('/api/v1/member/diet/preferences'), action = useMemberAction();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<Record<string, string> | null>(null), [reason, setReason] = useState('');
  return <><Card title="Diet preferences"><Button secondary title={open ? 'Close preferences' : 'Edit preferences'} disabled={!query.isSuccess} onPress={() => { setDraft(query.data || {}); setOpen(!open); }} />{open && <>{Object.entries(fields).map(([key, label]) => <Field key={key} label={label} value={draft?.[key] || ''} onChangeText={value => setDraft(previous => ({ ...previous, [key]: value }))} editable={!action.busy} maxLength={1000} />)}<Button title="Save preferences" busy={action.busy} onPress={() => void action.send('/api/v1/member/diet/preferences', draft, 'POST', 'Preferences sent to your trainer.')} /></>}</Card><Card title="Request diet change"><Text style={styles.muted}>Tell your trainer what you would like changed.</Text><Field label="Requested change" multiline value={reason} onChangeText={setReason} maxLength={2000} editable={!action.busy} /><Button title="Send request" busy={action.busy} disabled={!reason.trim()} onPress={() => void action.send('/api/v1/member/diet/change-request', { reason }, 'POST', 'Request sent for review.')} /><ActionNotice error={action.error} notice={action.notice} /></Card></>;
}
export function MealLog({ planId, meal }: { planId: string; meal: { id: string; slotType: string } }) {
  const action = useMemberAction(), [status, setStatus] = useState('FOLLOWED'), [food, setFood] = useState(''), [reason, setReason] = useState('');
  return <><Choices label="Today’s meal" value={status} onChange={setStatus} disabled={action.busy} options={['FOLLOWED', 'PARTIALLY_FOLLOWED', 'DIFFERENT_MEAL', 'SKIPPED'].map(value => ({ value, label: value.replaceAll('_', ' ').toLowerCase() }))} /><Field label="What you ate (optional)" value={food} onChangeText={setFood} editable={!action.busy} />{status === 'SKIPPED' && <Field label="Reason" value={reason} onChangeText={setReason} />}<Button secondary title="Save meal log" busy={action.busy} onPress={() => void action.send('/api/v1/member/diet/log', { dietPlanId: planId, mealSlotId: meal.id, slotType: meal.slotType, status, actualFood: food, skipReason: reason })} /><ActionNotice error={action.error} notice={action.notice} /></>;
}

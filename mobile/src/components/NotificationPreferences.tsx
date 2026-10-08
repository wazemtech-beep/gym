import { Text } from 'react-native';
import { Button, Card, LoadingCard, styles } from './ui';
import { Toggle, ActionNotice } from './controls';
import { useMemberAction } from '../hooks/action';
import { useMemberQuery } from '../hooks/member';
import { enablePush } from '../lib/push';
export function NotificationPreferences() {
  const query = useMemberQuery<Record<string, boolean>>('/api/v1/member/notification-preferences'), action = useMemberAction();
  return <Card title="Notification preferences">{!query.data ? <LoadingCard title="Preferences" /> : ['Payment', 'Membership', 'Training', 'Announcements'].map(category => <Card key={category} title={category}><Toggle label="Email" value={query.data![`email${category}`] ?? true} disabled={action.busy} onChange={value => void action.send('/api/v1/member/notification-preferences', { [`email${category}`]: value })} /><Toggle label="Phone notification" value={query.data![`push${category}`] ?? true} disabled={action.busy} onChange={value => void action.send('/api/v1/member/notification-preferences', { [`push${category}`]: value })} /></Card>)}<Text style={styles.muted}>Enable notifications on this phone to receive reminders.</Text><Button title="Enable phone notifications" busy={action.busy} onPress={() => void action.run(async () => { if (action.token) await enablePush(action.token); }, 'Phone notifications enabled.')} /><ActionNotice error={action.error} notice={action.notice} /></Card>;
}

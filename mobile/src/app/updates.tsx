import { Link } from 'expo-router';
import { RefreshControl, Text } from 'react-native';
import { Button, Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../components/ui';
import { useMemberQuery } from '../hooks/member';
import { colors, date } from '../theme';
import { NotificationPreferences } from '../components/NotificationPreferences';
import { useMemberAction } from '../hooks/action';
import { ActionNotice } from '../components/controls';

type Updates = { unreadCount: number; notifications: { id: string; title: string; message: string; createdAt: string; isRead: boolean }[] };
export default function UpdatesScreen() {
  const action = useMemberAction();
  const query = useMemberQuery<Updates>('/api/v1/member/notifications?limit=40');
  return <Screen refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}><Link href="/" style={styles.text}>← Home</Link><Heading>Your updates</Heading><Button secondary title="Mark all read" busy={action.busy} onPress={() => void action.send("/api/v1/member/notifications/read-all", {})} /><ActionNotice error={action.error} notice={action.notice} /><ErrorNotice error={query.error} retry={() => void query.refetch()} />{!query.data ? <LoadingCard title="Notifications" /> : query.data.notifications.length ? query.data.notifications.map(item => <Card key={item.id} title={item.title}><Text style={styles.text}>{item.message}</Text><Text style={styles.muted}>{date(item.createdAt)}{item.isRead ? '' : ' · New'}</Text>{!item.isRead && <Button secondary title="Mark read" disabled={action.busy} onPress={() => void action.send('/api/v1/member/notifications/' + item.id + '/read', {}, 'PATCH')} />}</Card>) : <Card><Text style={styles.muted}>You’re all caught up.</Text></Card>}<NotificationPreferences /></Screen>;
}



import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ErrorNotice, Heading, LoadingCard, Screen, styles } from '../components/ui';
import { useMemberQuery } from '../hooks/member';
import { date, money } from '../theme';
import { TransferForm } from '../components/TransferForm';
import { downloadReceipt } from '../lib/assets';
import { useMemberAction } from '../hooks/action';
import { ActionNotice } from '../components/controls';

type History = { total: number; rows: { id: string; invoiceNumber: string; title: string; status: string; dueDate: string; totalAmount: number; paidAmount: number; balanceAmount: number; lineItems: { id: string; description: string; amount: number }[]; installments: { id: string; installmentNumber: number; dueDate: string; amount: number; paidAmount: number; status: string }[] }[]; receipts: { id: string; receiptNumber: string; amount: number; paymentDate: string; status: string }[]; transfers: { id: string; amount: number; status: string; rejectionReason: string | null }[] };
export default function Payments() {
  const action = useMemberAction();
  const [page, setPage] = useState(1), query = useMemberQuery<History>(`/api/v1/member/history?section=payments&page=${page}`);
  return <Screen><Link href="/" style={styles.text}>← Home</Link><Heading>Payments & invoices</Heading><TransferForm /><ActionNotice error={action.error} notice={action.notice} /><ErrorNotice error={query.error} retry={() => void query.refetch()} />{!query.data ? <><LoadingCard title="Invoices" /><LoadingCard title="Receipts" /></> : <><Card title="Invoices">{query.data.rows.length ? query.data.rows.map(row => <View key={row.id} style={{ gap: 8 }}><Text style={styles.label}>{row.title}</Text><Text style={styles.muted}>{row.invoiceNumber} · {row.status.replaceAll('_', ' ')}</Text><View style={styles.row}><Text style={styles.muted}>Paid {money(row.paidAmount)}</Text><Text style={styles.text}>Due {money(row.balanceAmount)}</Text></View><Text style={styles.muted}>Due date {date(row.dueDate)}</Text>{row.lineItems.map(item => <Text key={item.id} style={styles.muted}>{item.description}: {money(item.amount)}</Text>)}{row.installments.map(item => <Text key={item.id} style={styles.muted}>Installment {item.installmentNumber}: {money(item.amount - item.paidAmount)} due · {date(item.dueDate)} · {item.status}</Text>)}<View style={styles.divider} /></View>) : <Text style={styles.muted}>No invoices yet.</Text>}</Card><Card title="Receipts">{query.data.receipts.length ? query.data.receipts.map(row => <View key={row.id} style={{ gap: 6 }}><Text style={styles.label}>{row.receiptNumber}</Text><Text style={styles.text}>{money(row.amount)} · {row.status}</Text><Text style={styles.muted}>{date(row.paymentDate)}</Text><Button secondary title="Download receipt" busy={action.busy} onPress={() => void action.run(() => downloadReceipt(row.id, action.token), "Receipt ready.", false)} /><View style={styles.divider} /></View>) : <Text style={styles.muted}>No payments recorded.</Text>}</Card>{query.data.transfers.length > 0 && <Card title="Transfer status">{query.data.transfers.map(row => <View key={row.id}><Text style={styles.text}>{money(row.amount)} · {row.status}</Text>{row.rejectionReason && <Text style={styles.muted}>{row.rejectionReason}</Text>}</View>)}</Card>}<View style={styles.row}><Button secondary title="Previous" disabled={page === 1} onPress={() => setPage(value => value - 1)} /><Text style={styles.muted}>Page {page}</Text><Button secondary title="Next" disabled={page * 20 >= query.data.total} onPress={() => setPage(value => value + 1)} /></View></>}</Screen>;
}




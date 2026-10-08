import { useState } from 'react';
import { Image, Text } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Button, Card, Field, styles } from './ui';
import { ActionNotice, Choices } from './controls';
import { useDashboard } from '../hooks/member';
import { useMemberAction } from '../hooks/action';
import { choosePhoto, uploadPhoto } from '../lib/assets';
import { request } from '../lib/api';

export function TransferForm() {
  const query = useDashboard(), action = useMemberAction();
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(''), [account, setAccount] = useState(''), [reference, setReference] = useState(''), [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const selected = query.data?.receivingAccounts?.find(item => item.id === account);
  async function submit() {
    const result = await action.run(async () => {
      if (!photo || !account || !reference.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Choose an account, enter amount/reference and attach proof.');
      const uploaded = await uploadPhoto(photo, 'transfers', action.token);
      return request('/api/v1/member/transfers', { token: action.token, method: 'POST', body: { amount: Number(amount), receivingAccountId: account, transactionReference: reference, proofImageUrl: uploaded.url } });
    }, 'Proof submitted. Staff will verify the payment.');
    if (result) { setOpen(false); setPhoto(null); setAmount(''); setReference(''); }
  }
  return <Card title="Bank transfer"><Text style={styles.muted}>Only staff confirmation updates your paid amount.</Text><Button secondary title={open ? 'Close form' : 'Submit transfer proof'} onPress={() => setOpen(!open)} disabled={action.busy} />{open && <><Choices label="Receiving account" value={account} onChange={setAccount} disabled={action.busy} options={(query.data?.receivingAccounts || []).map(item => ({ label: item.displayName, value: item.id }))} />{selected && <Text selectable style={styles.text}>{[selected.accountTitle, selected.bankName, selected.accountNumber, selected.iban].filter(Boolean).join('\n')}</Text>}<Field label="Amount (Rs.)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!action.busy} /><Field label="Transaction reference" value={reference} onChangeText={setReference} maxLength={150} editable={!action.busy} />{photo && <Image source={{ uri: photo.uri }} style={{ height: 160, width: '100%', borderRadius: 12 }} resizeMode="contain" />}<Button secondary title={photo ? 'Change proof image' : 'Choose proof image'} disabled={action.busy} onPress={() => void action.run(async () => { const image = await choosePhoto(); if (image) setPhoto(image); }, '', false)} /><Button title="Submit for verification" busy={action.busy} onPress={() => void submit()} /></>}<ActionNotice error={action.error} notice={action.notice} /></Card>;
}



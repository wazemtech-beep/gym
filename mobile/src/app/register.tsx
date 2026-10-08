import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, ErrorNotice, Field, Heading, Screen, styles } from '../components/ui';
import { request } from '../lib/api';
import { appendPhoto } from '../lib/assets';

const initial = { fullName: '', email: '', phone: '', password: '', confirmPassword: '', address: '', emergencyContactName: '', emergencyContactPhone: '', fitnessGoal: '', limitations: '', dateOfBirth: '', joiningDate: '' };
export default function Register() {
  const [form, setForm] = useState(initial), [step, setStep] = useState(1), [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const field = (name: keyof typeof initial) => ({ value: form[name], onChangeText: (value: string) => setForm(current => ({ ...current, [name]: value })), editable: !busy });
  function next() {
    if (form.fullName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.password.length < 8 || form.password !== form.confirmPassword) { setError('Enter your name, valid email and matching passwords of at least 8 characters.'); return; }
    setError(''); setStep(2);
  }
  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled) {
        const asset = result.assets[0];
        if ((asset.fileSize || 0) > 2 * 1024 * 1024) { setError('Choose a photo smaller than 2 MB.'); return; }
        if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) { setError('Choose a JPG, PNG or WebP photo.'); return; }
        setPhoto(asset); setError('');
      }
    } catch { setError('Photo selection is unavailable. Please try again.'); }
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      let body: unknown = form;
      if (photo) {
        const data = new FormData(); Object.entries(form).forEach(([name, value]) => data.append(name, value));
        await appendPhoto(data, 'photo', photo);
        body = data;
      }
      await request('/api/member-registration', { method: 'POST', body });
      setForm(initial); setPhoto(null); setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request could not be submitted.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Screen><Link href="/sign-in" style={styles.text}>← Sign in</Link><Heading>{submitted ? 'Request submitted' : 'Join OXGEN GYM'}</Heading>{submitted ? <Card><Text style={styles.text}>Reception will review your request. You can sign in after admin approval.</Text><Link href="/sign-in" style={styles.label}>Back to sign in →</Link></Card> : <><Text style={styles.muted}>Step {step} of 2 · {step === 1 ? 'Your account' : 'Member details'}</Text><Card>{step === 1 ? <><Field label="Full name" {...field('fullName')} maxLength={100} autoComplete="name" /><Field label="Mobile number" {...field('phone')} keyboardType="phone-pad" placeholder="03001234567" maxLength={25} /><Field label="Email" {...field('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={254} /><Field label="Password" {...field('password')} secureTextEntry textContentType="newPassword" /><Field label="Confirm password" {...field('confirmPassword')} secureTextEntry /><ErrorNotice error={error} /><Button title="Continue" onPress={next} /></> : <><View style={{ gap: 14, alignItems: 'center' }}>{photo && <Image source={{ uri: photo.uri }} style={{ width: 88, height: 88, borderRadius: 44 }} accessibilityLabel="Selected profile photo" />}<Button secondary title={photo ? 'Change photo' : 'Add photo (optional)'} disabled={busy} onPress={() => void pickPhoto()} />{photo && <Button secondary title="Remove photo" disabled={busy} onPress={() => setPhoto(null)} />}</View><Field label="Address (optional)" {...field('address')} multiline maxLength={500} /><Field label="Emergency contact name (optional)" {...field('emergencyContactName')} maxLength={100} /><Field label="Emergency contact mobile (optional)" {...field('emergencyContactPhone')} keyboardType="phone-pad" maxLength={25} /><Field label="Fitness goal (optional)" {...field('fitnessGoal')} multiline maxLength={500} /><Field label="Injuries or limitations (optional)" {...field('limitations')} multiline maxLength={1000} /><Field label="Date of birth (optional)" {...field('dateOfBirth')} placeholder="YYYY-MM-DD" maxLength={10} /><Field label="Joining date (optional)" {...field('joiningDate')} placeholder="YYYY-MM-DD" maxLength={10} /><ErrorNotice error={error} /><Button title="Submit request" busy={busy} onPress={() => void submit()} /><Button secondary title="Back" disabled={busy} onPress={() => { setStep(1); setError(''); }} /></>}</Card></>}</Screen>;
}

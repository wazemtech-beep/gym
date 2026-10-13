import { Platform, type ImageURISource } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL, ApiError, request } from './api';

export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
  if (result.canceled) return null;
  const image = result.assets[0];
  if ((image.fileSize || 0) > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  return image;
}
export async function appendPhoto(form: FormData, field: string, image: ImagePicker.ImagePickerAsset) {
  if (Platform.OS === 'web') form.append(field, await (await fetch(image.uri)).blob(), image.fileName || 'photo.jpg');
  else form.append(field, new File(image.uri));
}
export async function uploadPhoto(image: ImagePicker.ImagePickerAsset, folder: 'progress' | 'transfers' | 'members' | 'expenses' | 'branding', token: string | null) {
  const form = new FormData();
  form.append('folder', folder);
  await appendPhoto(form, 'file', image);
  return (await request<{ data: { url: string; publicId: string } }>('/api/v1/uploads/cloudinary', { token, method: 'POST', body: form })).data;
}
export function privateImage(url: string, token: string | null): ImageURISource {
  const image = new URL(url, API_URL);
  const headers: Record<string, string> = {};
  if (token && image.origin === new URL(API_URL).origin) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { uri: image.toString(), headers, cache: 'reload' };
}
export async function downloadReceipt(id: string, token: string | null) {
  return downloadDocument('/api/v1/receipts/' + encodeURIComponent(id) + '/download', 'receipt-' + id, token);
}
export async function downloadDocument(path: string, name: string, token: string | null, extension: 'pdf' | 'csv' = 'pdf') {
  if (!__DEV__ && !API_URL.startsWith('https://')) throw new Error('A secure server connection is required.');
  if (Platform.OS === 'web') throw new Error('Receipt sharing is available in the phone app.');
  if (!token || !FileSystem.cacheDirectory) throw new Error('Sign in to download your receipt.');
  if (!path.startsWith('/api/v1/')) throw new Error('Invalid document link.');
  const filename = FileSystem.cacheDirectory + name.replace(/[^a-zA-Z0-9_-]/g, '') + '.' + extension;
  try {
    const response = await FileSystem.downloadAsync(API_URL + path, filename, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status !== 200) throw new ApiError('Receipt download failed. Please try again.', response.status);
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(filename, { mimeType: extension === 'pdf' ? 'application/pdf' : 'text/csv', UTI: extension === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text', dialogTitle: 'Save gym document' });
  } finally { await FileSystem.deleteAsync(filename, { idempotent: true }).catch(() => {}); }
}

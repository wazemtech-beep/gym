import { Platform, type ImageURISource } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
export async function uploadPhoto(image: ImagePicker.ImagePickerAsset, folder: 'progress' | 'transfers', token: string | null) {
  const form = new FormData(), type = image.mimeType || 'image/jpeg';
  form.append('folder', folder);
  if (Platform.OS === 'web') form.append('file', await (await fetch(image.uri)).blob(), 'photo.jpg');
  else form.append('file', { uri: image.uri, name: image.fileName || 'photo.jpg', type } as unknown as Blob);
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
  if (Platform.OS === 'web') throw new Error('Receipt sharing is available in the phone app.');
  if (!token || !FileSystem.cacheDirectory) throw new Error('Sign in to download your receipt.');
  const filename = FileSystem.cacheDirectory + 'receipt-' + id.replace(/[^a-zA-Z0-9_-]/g, '') + '.pdf';
  try {
    const response = await FileSystem.downloadAsync(API_URL + '/api/v1/receipts/' + encodeURIComponent(id) + '/download', filename, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status !== 200) throw new ApiError('Receipt download failed. Please try again.', response.status);
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(filename, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save your gym receipt' });
  } finally { await FileSystem.deleteAsync(filename, { idempotent: true }).catch(() => {}); }
}

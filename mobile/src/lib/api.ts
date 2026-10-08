export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export async function request<T>(path: string, options: { token?: string | null; method?: string; body?: unknown; signal?: AbortSignal; fresh?: boolean } = {}): Promise<T> {
  if (!/^https?:\/\//.test(API_URL)) throw new ApiError('App connection is not configured. Set EXPO_PUBLIC_API_URL.', 0);
  if (!__DEV__ && !API_URL.startsWith('https://')) throw new ApiError('A secure server connection is required.', 0);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, 30000);
  try {
    const multipart = options.body instanceof FormData;
    const response = await fetch(API_URL + path, { method: options.method || 'GET', credentials: 'omit', headers: { Accept: 'application/json', 'X-Gym-Client': 'mobile', ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(options.fresh ? { 'X-Gym-Fresh': '1' } : {}) }, body: options.body ? multipart ? options.body as FormData : JSON.stringify(options.body) : undefined, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) throw new ApiError(data?.error || (response.status === 401 ? 'Please sign in again.' : 'Unable to load this right now. Please try again.'), response.status);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error;
    if (__DEV__) console.warn('GYM_REQUEST_FAILED', path, error instanceof Error ? error.message : 'Network failure');
    throw new ApiError(controller.signal.aborted ? 'The server took too long. Please try again.' : 'Cannot connect. Check your internet connection and try again.', 0);
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}

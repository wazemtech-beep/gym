import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../providers/session';
import { ApiError, request } from '../lib/api';

export function useMemberAction() {
  const { token, user, expire } = useSession(), cache = useQueryClient(), locked = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function run<T>(work: () => Promise<T>, message = 'Saved.', invalidate = true) {
    if (locked.current) return undefined;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await work(); if (invalidate) await cache.invalidateQueries({ queryKey: ['member', user?.id] }); setNotice(message); return result; }
    catch (cause) { if (cause instanceof ApiError && cause.status === 401) await expire(); setError(cause instanceof Error ? cause.message : 'Please try again.'); return undefined; }
    finally { locked.current = false; setBusy(false); }
  }
  const send = (path: string, body: unknown, method = 'POST', message?: string) => run(() => request(path, { token, method, body }), message);
  return { token, busy, error, notice, run, send, clear: () => { setError(''); setNotice(''); } };
}

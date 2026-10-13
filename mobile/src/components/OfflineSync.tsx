import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../providers/session';
import { readQueue, syncWorkouts } from '../lib/offline';
import { ApiError } from '../lib/api';

export function OfflineSync() {
  const { user, token, expire } = useSession(), cache = useQueryClient(), current = useRef(token);
  useEffect(() => {
    current.current = token; if (!user || !token || user.role !== 'MEMBER' || user.mustChangePassword) return;
    let active = true, busy = false;
    const sync = async () => {
      if (!active || busy) return; busy = true;
      try { if (!(await readQueue(user.id)).length) return; const network = await NetInfo.fetch(); if (network.isConnected && network.isInternetReachable !== false) { await syncWorkouts(user.id, token, () => active && current.current === token); if (active) await cache.invalidateQueries({ queryKey: ['member', user.id] }); } }
      catch (error) { if (error instanceof ApiError && error.status === 401 && active) await expire(); }
      finally { busy = false; }
    };
    void sync(); const network = NetInfo.addEventListener(state => { if (state.isConnected) void sync(); }), app = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    return () => { active = false; network(); app.remove(); };
  }, [user, token, cache, expire]);
  return null;
}


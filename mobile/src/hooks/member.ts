import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError, request } from '../lib/api';
import { useSession } from '../providers/session';
import type { Dashboard } from '../types';

export function useMemberQuery<T>(path: string) {
  const { token, user, expire } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const query = useQuery({ queryKey: ['member', user?.id, path], queryFn: async ({ signal }) => (await request<{ data: T }>(path, { token, signal })).data, enabled: focused && !!token && !user?.mustChangePassword, refetchInterval: focused ? 30000 : false, refetchIntervalInBackground: false });
  useEffect(() => { if (query.error instanceof ApiError && query.error.status === 401) void expire(); }, [query.error, expire]);
  return query;
}
export const useDashboard = () => useMemberQuery<Dashboard>('/api/v1/member/dashboard');

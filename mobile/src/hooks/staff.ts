import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, request } from "../lib/api";
import { useSession } from "../providers/session";

export function useStaffQuery<T>(path: string, enabled = true) {
  const { token, user, expire } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const query = useQuery({
    queryKey: ["staff", user?.id, user?.role, path],
    queryFn: ({ signal }) => request<T>(path, { token, signal }),
    enabled:
      enabled &&
      focused &&
      !!token &&
      !!user &&
      user.role !== "MEMBER" &&
      !user.mustChangePassword,
    refetchInterval: focused ? 30000 : false,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401)
      void expire();
  }, [query.error, expire]);
  return query;
}

export function useStaffAction() {
  const { token, user, expire } = useSession(),
    cache = useQueryClient();
  return async <T>(path: string, body: unknown, method = "POST") => {
    try {
      const result = await request<T>(path, { token, body, method });
      await cache.invalidateQueries({ queryKey: ["staff", user?.id] });
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        path !== "/api/v1/settings/reauth"
      )
        await expire();
      throw error;
    }
  };
}

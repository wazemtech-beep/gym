import { AsyncLocalStorage } from "node:async_hooks";
import type { validateSession } from "./auth";
export const sessionContext = new AsyncLocalStorage<{ current: Awaited<ReturnType<typeof validateSession>> }>();

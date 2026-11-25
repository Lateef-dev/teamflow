import type { ApiErrorBody } from '@shared/types';
import { getSocketId } from './socket';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'teamflow_token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: ApiErrorBody['details'],
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * fetch wrapper: adds the JWT and this tab's socket id (so the server does not
 * echo our own changes back to us), parses JSON and throws ApiError on failure.
 * `T` is the response shape from @shared/types.
 */
export async function api<T>(path: string, { method = 'GET', body }: { method?: Method; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const socketId = getSocketId();
  if (socketId) headers['x-socket-id'] = socketId;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as Partial<ApiErrorBody>;
    throw new ApiError(res.status, err.error ?? 'Request failed', err.details);
  }
  return data as T;
}

export interface RejectValue {
  status: number;
  message: string;
}

/** Turns a thrown error into a plain object createAsyncThunk can store. */
export const toRejectValue = (err: unknown): RejectValue =>
  err instanceof ApiError
    ? { status: err.status, message: err.message }
    : { status: 0, message: err instanceof Error ? err.message : 'Something went wrong' };

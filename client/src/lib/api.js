import { getSocketId } from './socket';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'teamflow_token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * fetch wrapper: adds the JWT and this tab's socket id (so the server does not
 * echo our own changes back to us), parses JSON and throws ApiError on failure.
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const socketId = getSocketId();
  if (socketId) headers['x-socket-id'] = socketId;

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed', data.details);
  return data;
}

/** Turns a thrown error into a plain object createAsyncThunk can store. */
export const toRejectValue = (err) => ({ status: err.status ?? 0, message: err.message ?? 'Something went wrong' });

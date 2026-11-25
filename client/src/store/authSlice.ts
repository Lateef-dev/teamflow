import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, PublicUser } from '@shared/types';
import { api, tokenStore } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { apiThunk } from './thunk';

const startSession = ({ token, user }: AuthResponse) => {
  tokenStore.set(token);
  connectSocket(token);
  return user;
};

export const login = apiThunk('auth/login', async (credentials: { email: string; password: string }) =>
  startSession(await api<AuthResponse>('/auth/login', { method: 'POST', body: credentials })),
);

export const register = apiThunk('auth/register', async (details: { name: string; email: string; password: string }) =>
  startSession(await api<AuthResponse>('/auth/register', { method: 'POST', body: details })),
);

/** Restores the session from localStorage on page load. */
export const loadSession = apiThunk('auth/loadSession', async () => {
  const token = tokenStore.get();
  if (!token) return null;
  try {
    const { user } = await api<{ user: PublicUser }>('/auth/me');
    connectSocket(token);
    return user;
  } catch (err) {
    if ((err as { status?: number }).status === 401) tokenStore.clear();
    throw err;
  }
});

interface AuthState {
  user: PublicUser | null;
  status: 'idle' | 'loading' | 'ready';
  submitting: boolean;
  error: string | null;
}

const initialState: AuthState = { user: null, status: 'idle', submitting: false, error: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      tokenStore.clear();
      disconnectSocket();
      state.user = null;
      state.status = 'ready';
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadSession.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.status = 'ready';
      })
      .addCase(loadSession.rejected, (state) => {
        state.status = 'ready';
      });
    for (const thunk of [login, register] as const) {
      builder
        .addCase(thunk.pending, (state) => {
          state.error = null;
          state.submitting = true;
        })
        .addCase(thunk.fulfilled, (state, { payload }: PayloadAction<PublicUser>) => {
          state.user = payload;
          state.status = 'ready';
          state.submitting = false;
        })
        .addCase(thunk.rejected, (state, { payload }) => {
          state.error = payload?.message ?? 'Something went wrong';
          state.submitting = false;
        });
    }
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

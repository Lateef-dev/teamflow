import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, toRejectValue, tokenStore } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

const startSession = ({ token, user }) => {
  tokenStore.set(token);
  connectSocket(token);
  return user;
};

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    return startSession(await api('/auth/login', { method: 'POST', body: credentials }));
  } catch (err) {
    return rejectWithValue(toRejectValue(err));
  }
});

export const register = createAsyncThunk('auth/register', async (details, { rejectWithValue }) => {
  try {
    return startSession(await api('/auth/register', { method: 'POST', body: details }));
  } catch (err) {
    return rejectWithValue(toRejectValue(err));
  }
});

/** Restores the session from localStorage on page load. */
export const loadSession = createAsyncThunk('auth/loadSession', async (_, { rejectWithValue }) => {
  const token = tokenStore.get();
  if (!token) return null;
  try {
    const { user } = await api('/auth/me');
    connectSocket(token);
    return user;
  } catch (err) {
    if (err.status === 401) tokenStore.clear();
    return rejectWithValue(toRejectValue(err));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'idle', error: null },
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
    for (const thunk of [login, register]) {
      builder
        .addCase(thunk.pending, (state) => {
          state.error = null;
          state.submitting = true;
        })
        .addCase(thunk.fulfilled, (state, { payload }) => {
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

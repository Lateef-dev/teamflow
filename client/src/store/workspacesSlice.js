import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { api, toRejectValue } from '@/lib/api';
import { logout } from './authSlice';

const adapter = createEntityAdapter({ selectId: (w) => w._id });
const boardsAdapter = createEntityAdapter({ selectId: (b) => b._id });

const thunk = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(toRejectValue(err));
    }
  });

export const fetchWorkspaces = thunk('workspaces/fetchAll', async () => (await api('/workspaces')).workspaces);
export const fetchWorkspace = thunk('workspaces/fetchOne', async (id) => {
  const [{ workspace }, { boards }, { activity }] = await Promise.all([
    api(`/workspaces/${id}`),
    api(`/workspaces/${id}/boards`),
    api(`/workspaces/${id}/activity?limit=20`),
  ]);
  return { workspace, boards, activity };
});
export const createWorkspace = thunk('workspaces/create', async (body) =>
  (await api('/workspaces', { method: 'POST', body })).workspace);
export const joinWorkspace = thunk('workspaces/join', async (inviteCode) =>
  (await api('/workspaces/join', { method: 'POST', body: { inviteCode } })).workspace);
export const updateWorkspace = thunk('workspaces/update', async ({ id, ...body }) =>
  (await api(`/workspaces/${id}`, { method: 'PATCH', body })).workspace);
export const deleteWorkspace = thunk('workspaces/delete', async (id) => {
  await api(`/workspaces/${id}`, { method: 'DELETE' });
  return id;
});
export const regenerateInvite = thunk('workspaces/regenerateInvite', async (id) => ({
  id,
  ...(await api(`/workspaces/${id}/invite-code`, { method: 'POST' })),
}));
export const setMemberRole = thunk('workspaces/setMemberRole', async ({ id, userId, role }) =>
  (await api(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: { role } })).workspace);
export const removeMember = thunk('workspaces/removeMember', async ({ id, userId }) =>
  (await api(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' })).workspace);
export const createBoard = thunk('workspaces/createBoard', async ({ workspaceId, ...body }) =>
  (await api(`/workspaces/${workspaceId}/boards`, { method: 'POST', body })).board);
export const deleteBoard = thunk('workspaces/deleteBoard', async (boardId) => {
  await api(`/boards/${boardId}`, { method: 'DELETE' });
  return boardId;
});
export const fetchMyTasks = thunk('workspaces/myTasks', async () => (await api('/me/tasks')).tasks);

const initialState = adapter.getInitialState({
  status: 'idle',
  error: null,
  current: { id: null, status: 'idle', error: null, boards: boardsAdapter.getInitialState(), activity: [] },
  myTasks: [],
});

const slice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    // Realtime events for the workspace currently open.
    boardUpserted(state, { payload }) {
      if (payload.workspace !== state.current.id) return;
      const existing = state.current.boards.entities[payload._id];
      boardsAdapter.upsertOne(state.current.boards, { taskCount: 0, doneCount: 0, ...existing, ...payload });
    },
    boardRemoved(state, { payload }) {
      boardsAdapter.removeOne(state.current.boards, payload._id);
    },
    workspaceActivityAdded(state, { payload }) {
      if (payload.workspace !== state.current.id) return;
      state.current.activity = [payload, ...state.current.activity].slice(0, 30);
    },
    membersChanged(state, { payload }) {
      const ws = state.entities[payload.workspaceId];
      if (ws) ws.members = payload.members;
    },
    workspaceChanged(state, { payload }) {
      adapter.updateOne(state, { id: payload._id, changes: payload });
    },
    workspaceGone(state, { payload }) {
      adapter.removeOne(state, payload._id);
      if (state.current.id === payload._id) state.current.status = 'gone';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaces.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWorkspaces.fulfilled, (state, { payload }) => {
        adapter.setAll(state, payload);
        state.status = 'ready';
      })
      .addCase(fetchWorkspaces.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.error = payload?.message;
      })
      .addCase(fetchWorkspace.pending, (state, { meta }) => {
        if (state.current.id !== meta.arg) {
          state.current = { ...initialState.current, id: meta.arg };
        }
        state.current.status = 'loading';
      })
      .addCase(fetchWorkspace.fulfilled, (state, { payload }) => {
        adapter.upsertOne(state, payload.workspace);
        boardsAdapter.setAll(state.current.boards, payload.boards);
        state.current.activity = payload.activity;
        state.current.status = 'ready';
      })
      .addCase(fetchWorkspace.rejected, (state, { payload }) => {
        state.current.status = 'failed';
        state.current.error = payload?.message;
      })
      .addCase(createBoard.fulfilled, (state, { payload }) => {
        boardsAdapter.upsertOne(state.current.boards, payload);
      })
      .addCase(deleteBoard.fulfilled, (state, { payload }) => {
        boardsAdapter.removeOne(state.current.boards, payload);
      })
      .addCase(regenerateInvite.fulfilled, (state, { payload }) => {
        adapter.updateOne(state, { id: payload.id, changes: { inviteCode: payload.inviteCode } });
      })
      .addCase(deleteWorkspace.fulfilled, (state, { payload }) => {
        adapter.removeOne(state, payload);
      })
      .addCase(fetchMyTasks.fulfilled, (state, { payload }) => {
        state.myTasks = payload;
      })
      .addCase(logout, () => initialState);

    for (const t of [createWorkspace, joinWorkspace, updateWorkspace, setMemberRole, removeMember]) {
      builder.addCase(t.fulfilled, (state, { payload }) => {
        adapter.upsertOne(state, payload);
      });
    }
  },
});

export const { boardUpserted, boardRemoved, workspaceActivityAdded, membersChanged, workspaceChanged, workspaceGone } =
  slice.actions;

export const workspaceSelectors = adapter.getSelectors((s) => s.workspaces);
export const currentBoardsSelectors = boardsAdapter.getSelectors((s) => s.workspaces.current.boards);

export default slice.reducer;

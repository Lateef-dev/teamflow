import { createEntityAdapter, createSlice, type EntityState, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Activity,
  Board,
  BoardSummary,
  ID,
  Member,
  MyTask,
  Workspace,
} from '@shared/types';
import { api } from '@/lib/api';
import { logout } from './authSlice';
import type { RootState } from './index';
import { apiThunk } from './thunk';

const adapter = createEntityAdapter<Workspace, ID>({ selectId: (w) => w._id });
const boardsAdapter = createEntityAdapter<BoardSummary, ID>({ selectId: (b) => b._id });

export const fetchWorkspaces = apiThunk('workspaces/fetchAll', async () =>
  (await api<{ workspaces: Workspace[] }>('/workspaces')).workspaces);

export const fetchWorkspace = apiThunk('workspaces/fetchOne', async (id: ID) => {
  const [{ workspace }, { boards }, { activity }] = await Promise.all([
    api<{ workspace: Workspace }>(`/workspaces/${id}`),
    api<{ boards: BoardSummary[] }>(`/workspaces/${id}/boards`),
    api<{ activity: Activity[] }>(`/workspaces/${id}/activity?limit=20`),
  ]);
  return { workspace, boards, activity };
});

type WorkspaceResult = { workspace: Workspace };
const workspaceCall = (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) =>
  api<WorkspaceResult>(path, { method, body }).then((r) => r.workspace);

export const createWorkspace = apiThunk('workspaces/create', (body: { name: string; description?: string }) =>
  workspaceCall('/workspaces', 'POST', body));
export const joinWorkspace = apiThunk('workspaces/join', (inviteCode: string) =>
  workspaceCall('/workspaces/join', 'POST', { inviteCode }));
export const updateWorkspace = apiThunk('workspaces/update', ({ id, ...body }: { id: ID; name?: string; description?: string }) =>
  workspaceCall(`/workspaces/${id}`, 'PATCH', body));
export const setMemberRole = apiThunk('workspaces/setMemberRole', ({ id, userId, role }: { id: ID; userId: ID; role: 'admin' | 'member' }) =>
  workspaceCall(`/workspaces/${id}/members/${userId}`, 'PATCH', { role }));
export const removeMember = apiThunk('workspaces/removeMember', ({ id, userId }: { id: ID; userId: ID }) =>
  workspaceCall(`/workspaces/${id}/members/${userId}`, 'DELETE'));

export const deleteWorkspace = apiThunk('workspaces/delete', async (id: ID) => {
  await api<void>(`/workspaces/${id}`, { method: 'DELETE' });
  return id;
});
export const regenerateInvite = apiThunk('workspaces/regenerateInvite', async (id: ID) => ({
  id,
  ...(await api<{ inviteCode: string }>(`/workspaces/${id}/invite-code`, { method: 'POST' })),
}));
export const createBoard = apiThunk(
  'workspaces/createBoard',
  async ({ workspaceId, ...body }: { workspaceId: ID; name: string; description?: string }) =>
    (await api<{ board: BoardSummary }>(`/workspaces/${workspaceId}/boards`, { method: 'POST', body })).board,
);
export const deleteBoard = apiThunk('workspaces/deleteBoard', async (boardId: ID) => {
  await api<void>(`/boards/${boardId}`, { method: 'DELETE' });
  return boardId;
});
export const fetchMyTasks = apiThunk('workspaces/myTasks', async () => (await api<{ tasks: MyTask[] }>('/me/tasks')).tasks);

interface CurrentWorkspace {
  id: ID | null;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'gone';
  error: string | null;
  boards: EntityState<BoardSummary, ID>;
  activity: Activity[];
}

interface WorkspacesState extends EntityState<Workspace, ID> {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  current: CurrentWorkspace;
  myTasks: MyTask[];
}

const emptyCurrent = (id: ID | null = null): CurrentWorkspace => ({
  id,
  status: 'idle',
  error: null,
  boards: boardsAdapter.getInitialState(),
  activity: [],
});

const initialState: WorkspacesState = adapter.getInitialState({
  status: 'idle',
  error: null,
  current: emptyCurrent(),
  myTasks: [],
});

const slice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    // Realtime events for the workspace currently open.
    boardUpserted(state, { payload }: PayloadAction<Board | BoardSummary>) {
      if (payload.workspace !== state.current.id) return;
      const existing = state.current.boards.entities[payload._id];
      boardsAdapter.upsertOne(state.current.boards, { taskCount: 0, doneCount: 0, ...existing, ...payload });
    },
    boardRemoved(state, { payload }: PayloadAction<{ _id: ID }>) {
      boardsAdapter.removeOne(state.current.boards, payload._id);
    },
    workspaceActivityAdded(state, { payload }: PayloadAction<Activity>) {
      if (payload.workspace !== state.current.id) return;
      state.current.activity = [payload, ...state.current.activity].slice(0, 30);
    },
    membersChanged(state, { payload }: PayloadAction<{ workspaceId: ID; members: Member[] }>) {
      const ws = state.entities[payload.workspaceId];
      if (ws) ws.members = payload.members;
    },
    workspaceChanged(state, { payload }: PayloadAction<{ _id: ID; name: string; description: string }>) {
      adapter.updateOne(state, { id: payload._id, changes: payload });
    },
    workspaceGone(state, { payload }: PayloadAction<{ _id: ID }>) {
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
        state.error = payload?.message ?? null;
      })
      .addCase(fetchWorkspace.pending, (state, { meta }) => {
        if (state.current.id !== meta.arg) state.current = emptyCurrent(meta.arg);
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
        state.current.error = payload?.message ?? null;
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

    for (const t of [createWorkspace, joinWorkspace, updateWorkspace, setMemberRole, removeMember] as const) {
      builder.addCase(t.fulfilled, (state, { payload }: PayloadAction<Workspace>) => {
        adapter.upsertOne(state, payload);
      });
    }
  },
});

export const { boardUpserted, boardRemoved, workspaceActivityAdded, membersChanged, workspaceChanged, workspaceGone } =
  slice.actions;

export const workspaceSelectors = adapter.getSelectors((s: RootState) => s.workspaces);
export const currentBoardsSelectors = boardsAdapter.getSelectors((s: RootState) => s.workspaces.current.boards);

export default slice.reducer;

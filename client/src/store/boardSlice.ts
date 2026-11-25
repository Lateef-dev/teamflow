import { createEntityAdapter, createSelector, createSlice, type EntityState, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Activity,
  Board,
  BoardResponse,
  BoardWorkspace,
  Column,
  Comment,
  CreateTaskInput,
  ID,
  Member,
  MoveTaskInput,
  Priority,
  PublicUser,
  Task,
  UpdateTaskInput,
} from '@shared/types';
import { api } from '@/lib/api';
import { orderBetween } from '@/lib/ordering';
import { logout } from './authSlice';
import type { RootState } from './index';
import { apiThunk } from './thunk';

const tasksAdapter = createEntityAdapter<Task, ID>({
  selectId: (t) => t._id,
  sortComparer: (a, b) => a.order - b.order,
});

// ---- Thunks ------------------------------------------------------------------

export const fetchBoard = apiThunk('board/fetch', (boardId: ID) => api<BoardResponse>(`/boards/${boardId}`));
export const fetchBoardActivity = apiThunk('board/activity', async (boardId: ID) =>
  (await api<{ activity: Activity[] }>(`/boards/${boardId}/activity?limit=40`)).activity);
export const updateBoard = apiThunk('board/update', async ({ id, ...body }: { id: ID; name?: string; description?: string }) =>
  (await api<{ board: Board }>(`/boards/${id}`, { method: 'PATCH', body })).board);

export const createTask = apiThunk('board/createTask', async ({ boardId, ...body }: CreateTaskInput & { boardId: ID }) =>
  (await api<{ task: Task }>(`/boards/${boardId}/tasks`, { method: 'POST', body })).task);
export const updateTask = apiThunk('board/updateTask', async ({ id, ...body }: UpdateTaskInput & { id: ID }) =>
  (await api<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body })).task);
export const deleteTask = apiThunk('board/deleteTask', async (id: ID) => {
  await api<void>(`/tasks/${id}`, { method: 'DELETE' });
  return id;
});
/** Optimistic: the pending reducer moves the card before the server answers. */
export const moveTask = apiThunk('board/moveTask', async ({ id, ...body }: MoveTaskInput & { id: ID }) =>
  (await api<{ task: Task }>(`/tasks/${id}/move`, { method: 'PATCH', body })).task);

type ColumnsResult = { columns: Column[] };
export const addColumn = apiThunk('board/addColumn', async ({ boardId, ...body }: { boardId: ID; title: string; color?: string }) =>
  (await api<ColumnsResult>(`/boards/${boardId}/columns`, { method: 'POST', body })).columns);
export const editColumn = apiThunk(
  'board/editColumn',
  async ({ boardId, columnId, ...body }: { boardId: ID; columnId: ID; title?: string; color?: string }) =>
    (await api<ColumnsResult>(`/boards/${boardId}/columns/${columnId}`, { method: 'PATCH', body })).columns,
);
export const removeColumn = apiThunk('board/removeColumn', async ({ boardId, columnId }: { boardId: ID; columnId: ID }) =>
  (await api<ColumnsResult>(`/boards/${boardId}/columns/${columnId}`, { method: 'DELETE' })).columns);
/** Optimistic column reorder. */
export const reorderColumns = apiThunk('board/reorderColumns', async ({ boardId, columnIds }: { boardId: ID; columnIds: ID[] }) =>
  (await api<ColumnsResult>(`/boards/${boardId}/columns/order`, { method: 'PUT', body: { columnIds } })).columns);

export const fetchComments = apiThunk('board/fetchComments', async (taskId: ID) => ({
  taskId,
  comments: (await api<{ comments: Comment[] }>(`/tasks/${taskId}/comments`)).comments,
}));
export const addComment = apiThunk('board/addComment', async ({ taskId, body }: { taskId: ID; body: string }) => ({
  taskId,
  ...(await api<{ comment: Comment; commentCount: number }>(`/tasks/${taskId}/comments`, { method: 'POST', body: { body } })),
}));
export const deleteComment = apiThunk('board/deleteComment', async ({ taskId, commentId }: { taskId: ID; commentId: ID }) => {
  await api<void>(`/comments/${commentId}`, { method: 'DELETE' });
  return { taskId, commentId };
});

// ---- State -------------------------------------------------------------------

export type AssigneeFilter = 'all' | 'me' | 'none' | ID;
export interface Filters {
  query: string;
  assignee: AssigneeFilter;
  priority: 'all' | Priority;
}

interface FocusEntry {
  user: PublicUser;
  at: number;
}

interface BoardState {
  id: ID | null;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'gone';
  error: string | null;
  board: Board | null;
  workspace: BoardWorkspace | null;
  tasks: EntityState<Task, ID>;
  presence: PublicUser[];
  focus: Record<ID, FocusEntry[]>;
  comments: Record<ID, Comment[]>;
  activity: Activity[];
  filters: Filters;
  connection: 'connecting' | 'online' | 'offline';
}

const initialFilters: Filters = { query: '', assignee: 'all', priority: 'all' };

const initialState: BoardState = {
  id: null,
  status: 'idle',
  error: null,
  board: null,
  workspace: null,
  tasks: tasksAdapter.getInitialState(),
  presence: [],
  focus: {},
  comments: {},
  activity: [],
  filters: initialFilters,
  connection: 'connecting',
};

function applyCommentCount(state: BoardState, taskId: ID, commentCount: number) {
  const task = state.tasks.entities[taskId];
  if (task) task.commentCount = commentCount;
}

function setColumns(state: BoardState, columns: Column[]) {
  if (state.board) state.board.columns = columns;
}

const slice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // ---- realtime events from teammates ----
    taskUpserted(state, { payload }: PayloadAction<Task>) {
      if (payload.board === state.id) tasksAdapter.upsertOne(state.tasks, payload);
    },
    taskRemoved(state, { payload }: PayloadAction<{ _id: ID }>) {
      tasksAdapter.removeOne(state.tasks, payload._id);
    },
    tasksReordered(state, { payload }: PayloadAction<{ boardId: ID; orders: { _id: ID; order: number }[] }>) {
      if (payload.boardId !== state.id) return;
      tasksAdapter.updateMany(state.tasks, payload.orders.map((o) => ({ id: o._id, changes: { order: o.order } })));
    },
    columnsSet(state, { payload }: PayloadAction<{ boardId: ID; columns: Column[] }>) {
      if (payload.boardId === state.id) setColumns(state, payload.columns);
    },
    boardChanged(state, { payload }: PayloadAction<Board>) {
      if (state.board && payload._id === state.id) Object.assign(state.board, payload);
    },
    boardGone(state, { payload }: PayloadAction<{ _id: ID }>) {
      if (payload._id === state.id) state.status = 'gone';
    },
    presenceSet(state, { payload }: PayloadAction<{ boardId: ID; users: PublicUser[] }>) {
      if (payload.boardId === state.id) state.presence = payload.users;
    },
    taskFocused: {
      reducer(state, { payload }: PayloadAction<{ taskId: ID; user: PublicUser; at: number }>) {
        const recent = (state.focus[payload.taskId] ?? []).filter(
          (f) => f.user._id !== payload.user._id && payload.at - f.at < 15000,
        );
        state.focus[payload.taskId] = [...recent, { user: payload.user, at: payload.at }];
      },
      // Timestamp in prepare so the reducer stays pure.
      prepare: (p: { taskId: ID; user: PublicUser }) => ({ payload: { ...p, at: Date.now() } }),
    },
    commentReceived(state, { payload }: PayloadAction<{ comment: Comment; taskId: ID; commentCount: number }>) {
      applyCommentCount(state, payload.taskId, payload.commentCount);
      const list = state.comments[payload.taskId];
      if (list && !list.some((c) => c._id === payload.comment._id)) list.push(payload.comment);
    },
    commentRemoved(state, { payload }: PayloadAction<{ _id: ID; taskId: ID; commentCount: number }>) {
      applyCommentCount(state, payload.taskId, payload.commentCount);
      const list = state.comments[payload.taskId];
      if (list) state.comments[payload.taskId] = list.filter((c) => c._id !== payload._id);
    },
    activityReceived(state, { payload }: PayloadAction<Activity>) {
      if (payload.board === state.id) state.activity = [payload, ...state.activity].slice(0, 50);
    },
    membersChangedOnBoard(state, { payload }: PayloadAction<{ workspaceId: ID; members: Member[] }>) {
      if (state.workspace?._id === payload.workspaceId) state.workspace.members = payload.members;
    },
    connectionChanged(state, { payload }: PayloadAction<BoardState['connection']>) {
      state.connection = payload;
    },
    setFilter(state, { payload }: PayloadAction<Partial<Filters>>) {
      Object.assign(state.filters, payload);
    },
    resetFilters(state) {
      state.filters = initialFilters;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoard.pending, (state, { meta }) => {
        if (state.id !== meta.arg) {
          return { ...initialState, id: meta.arg, status: 'loading', connection: state.connection };
        }
        return undefined;
      })
      .addCase(fetchBoard.fulfilled, (state, { payload }) => {
        state.status = 'ready';
        state.board = payload.board;
        state.workspace = payload.workspace;
        tasksAdapter.setAll(state.tasks, payload.tasks);
      })
      .addCase(fetchBoard.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.error = payload?.message ?? null;
      })
      .addCase(fetchBoardActivity.fulfilled, (state, { payload }) => {
        state.activity = payload;
      })
      .addCase(updateBoard.fulfilled, (state, { payload }) => {
        if (state.board) Object.assign(state.board, payload);
      })
      .addCase(createTask.fulfilled, (state, { payload }) => {
        tasksAdapter.upsertOne(state.tasks, payload);
      })
      .addCase(updateTask.pending, (state, { meta }) => {
        // Instant feedback for plain fields; assignees come back populated from the server.
        const { id, assignees: _assignees, ...changes } = meta.arg;
        if (state.tasks.entities[id]) tasksAdapter.updateOne(state.tasks, { id, changes });
      })
      .addCase(updateTask.fulfilled, (state, { payload }) => {
        tasksAdapter.upsertOne(state.tasks, payload);
      })
      .addCase(deleteTask.fulfilled, (state, { payload }) => {
        tasksAdapter.removeOne(state.tasks, payload);
      })
      .addCase(moveTask.pending, (state, { meta }) => {
        const { id, columnId } = meta.arg;
        const siblings = Object.values(state.tasks.entities)
          .filter((t) => t.column === columnId && t._id !== id)
          .sort((a, b) => a.order - b.order);
        const index = Math.min(meta.arg.index, siblings.length);
        const order = orderBetween(siblings[index - 1]?.order, siblings[index]?.order);
        tasksAdapter.updateOne(state.tasks, { id, changes: { column: columnId, order } });
      })
      .addCase(moveTask.fulfilled, (state, { payload }) => {
        tasksAdapter.upsertOne(state.tasks, payload);
      })
      .addCase(reorderColumns.pending, (state, { meta }) => {
        if (!state.board) return;
        const byId = new Map(state.board.columns.map((c) => [c._id, c]));
        state.board.columns = meta.arg.columnIds.flatMap((id) => byId.get(id) ?? []);
      })
      .addCase(fetchComments.fulfilled, (state, { payload }) => {
        state.comments[payload.taskId] = payload.comments;
      })
      .addCase(addComment.fulfilled, (state, { payload }) => {
        applyCommentCount(state, payload.taskId, payload.commentCount);
        const list = state.comments[payload.taskId] ?? [];
        if (!list.some((c) => c._id === payload.comment._id)) list.push(payload.comment);
        state.comments[payload.taskId] = list;
      })
      .addCase(deleteComment.fulfilled, (state, { payload }) => {
        const task = state.tasks.entities[payload.taskId];
        if (task) task.commentCount = Math.max(0, task.commentCount - 1);
        state.comments[payload.taskId] = (state.comments[payload.taskId] ?? []).filter((c) => c._id !== payload.commentId);
      })
      .addCase(logout, () => initialState);

    for (const t of [addColumn, editColumn, removeColumn, reorderColumns] as const) {
      builder.addCase(t.fulfilled, (state, { payload }: PayloadAction<Column[]>) => setColumns(state, payload));
    }
  },
});

export const {
  taskUpserted,
  taskRemoved,
  tasksReordered,
  columnsSet,
  boardChanged,
  boardGone,
  presenceSet,
  taskFocused,
  commentReceived,
  commentRemoved,
  activityReceived,
  membersChangedOnBoard,
  connectionChanged,
  setFilter,
  resetFilters,
} = slice.actions;

export const taskSelectors = tasksAdapter.getSelectors((s: RootState) => s.board.tasks);

const selectFilters = (s: RootState) => s.board.filters;
const selectMe = (s: RootState) => s.auth.user;

function matches(task: Task, f: Filters, meId: ID | undefined) {
  const q = f.query.trim().toLowerCase();
  if (q && !`${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase().includes(q)) return false;
  if (f.priority !== 'all' && task.priority !== f.priority) return false;
  const ids = task.assignees.map((a) => a._id);
  switch (f.assignee) {
    case 'all':
      return true;
    case 'me':
      return meId !== undefined && ids.includes(meId);
    case 'none':
      return ids.length === 0;
    default:
      return ids.includes(f.assignee);
  }
}

/** Tasks grouped by column id after applying the search and filters. */
export const selectTasksByColumn = createSelector([taskSelectors.selectAll, selectFilters, selectMe], (tasks, f, me) => {
  const grouped: Record<ID, Task[]> = {};
  for (const t of tasks) {
    if (matches(t, f, me?._id)) (grouped[t.column] ??= []).push(t);
  }
  return grouped;
});

/** Unfiltered task count per column. */
export const selectColumnTotals = createSelector([taskSelectors.selectAll], (tasks) => {
  const totals: Record<ID, number> = {};
  for (const t of tasks) totals[t.column] = (totals[t.column] ?? 0) + 1;
  return totals;
});

export const selectFiltersActive = createSelector(
  [selectFilters],
  (f) => Boolean(f.query.trim()) || f.assignee !== 'all' || f.priority !== 'all',
);

export default slice.reducer;

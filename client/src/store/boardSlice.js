import { createAsyncThunk, createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';
import { api, toRejectValue } from '@/lib/api';
import { orderBetween } from '@/lib/ordering';
import { logout } from './authSlice';

const tasksAdapter = createEntityAdapter({
  selectId: (t) => t._id,
  sortComparer: (a, b) => a.order - b.order,
});

const thunk = (type, fn) =>
  createAsyncThunk(type, async (arg, api_) => {
    try {
      return await fn(arg, api_);
    } catch (err) {
      return api_.rejectWithValue(toRejectValue(err));
    }
  });

export const fetchBoard = thunk('board/fetch', (boardId) => api(`/boards/${boardId}`));
export const fetchBoardActivity = thunk('board/activity', async (boardId) =>
  (await api(`/boards/${boardId}/activity?limit=40`)).activity);
export const updateBoard = thunk('board/update', async ({ id, ...body }) =>
  (await api(`/boards/${id}`, { method: 'PATCH', body })).board);

export const createTask = thunk('board/createTask', async ({ boardId, ...body }) =>
  (await api(`/boards/${boardId}/tasks`, { method: 'POST', body })).task);
export const updateTask = thunk('board/updateTask', async ({ id, ...body }) =>
  (await api(`/tasks/${id}`, { method: 'PATCH', body })).task);
export const deleteTask = thunk('board/deleteTask', async (id) => {
  await api(`/tasks/${id}`, { method: 'DELETE' });
  return id;
});
/** Optimistic: the pending reducer moves the card before the server answers. */
export const moveTask = thunk('board/moveTask', async ({ id, columnId, index }) =>
  (await api(`/tasks/${id}/move`, { method: 'PATCH', body: { columnId, index } })).task);

export const addColumn = thunk('board/addColumn', async ({ boardId, ...body }) =>
  (await api(`/boards/${boardId}/columns`, { method: 'POST', body })).columns);
export const editColumn = thunk('board/editColumn', async ({ boardId, columnId, ...body }) =>
  (await api(`/boards/${boardId}/columns/${columnId}`, { method: 'PATCH', body })).columns);
export const removeColumn = thunk('board/removeColumn', async ({ boardId, columnId }) =>
  (await api(`/boards/${boardId}/columns/${columnId}`, { method: 'DELETE' })).columns);
/** Optimistic column reorder. */
export const reorderColumns = thunk('board/reorderColumns', async ({ boardId, columnIds }) =>
  (await api(`/boards/${boardId}/columns/order`, { method: 'PUT', body: { columnIds } })).columns);

export const fetchComments = thunk('board/fetchComments', async (taskId) => ({
  taskId,
  comments: (await api(`/tasks/${taskId}/comments`)).comments,
}));
export const addComment = thunk('board/addComment', async ({ taskId, body }) => ({
  taskId,
  ...(await api(`/tasks/${taskId}/comments`, { method: 'POST', body: { body } })),
}));
export const deleteComment = thunk('board/deleteComment', async ({ taskId, commentId }) => {
  await api(`/comments/${commentId}`, { method: 'DELETE' });
  return { taskId, commentId };
});

const initialState = {
  id: null,
  status: 'idle',
  error: null,
  board: null,
  workspace: null,
  tasks: tasksAdapter.getInitialState(),
  presence: [],
  focus: {}, // taskId -> [{ user, at }]
  comments: {}, // taskId -> comment[]
  activity: [],
  filters: { query: '', assignee: 'all', priority: 'all' },
  connection: 'connecting',
};

function applyCommentCount(state, taskId, commentCount) {
  const task = state.tasks.entities[taskId];
  if (task && commentCount != null) task.commentCount = commentCount;
}

const slice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // ---- realtime events from teammates ----
    taskUpserted(state, { payload }) {
      if (payload.board !== state.id) return;
      tasksAdapter.upsertOne(state.tasks, payload);
    },
    taskRemoved(state, { payload }) {
      tasksAdapter.removeOne(state.tasks, payload._id);
    },
    tasksReordered(state, { payload }) {
      if (payload.boardId !== state.id) return;
      tasksAdapter.updateMany(state.tasks, payload.orders.map((o) => ({ id: o._id, changes: { order: o.order } })));
    },
    columnsSet(state, { payload }) {
      if (state.board && payload.boardId === state.id) state.board.columns = payload.columns;
    },
    boardChanged(state, { payload }) {
      if (state.board && payload._id === state.id) Object.assign(state.board, payload);
    },
    boardGone(state, { payload }) {
      if (payload._id === state.id) state.status = 'gone';
    },
    presenceSet(state, { payload }) {
      if (payload.boardId === state.id) state.presence = payload.users;
    },
    taskFocused(state, { payload }) {
      const now = Date.now();
      const list = (state.focus[payload.taskId] ?? []).filter((f) => f.user._id !== payload.user._id && now - f.at < 15000);
      state.focus[payload.taskId] = [...list, { user: payload.user, at: now }];
    },
    commentReceived(state, { payload }) {
      applyCommentCount(state, payload.taskId, payload.commentCount);
      const list = state.comments[payload.taskId];
      if (list && !list.some((c) => c._id === payload.comment._id)) list.push(payload.comment);
    },
    commentRemoved(state, { payload }) {
      applyCommentCount(state, payload.taskId, payload.commentCount);
      const list = state.comments[payload.taskId];
      if (list) state.comments[payload.taskId] = list.filter((c) => c._id !== payload._id);
    },
    activityReceived(state, { payload }) {
      if (payload.board !== state.id) return;
      state.activity = [payload, ...state.activity].slice(0, 50);
    },
    membersChangedOnBoard(state, { payload }) {
      if (state.workspace && state.workspace._id === payload.workspaceId) state.workspace.members = payload.members;
    },
    connectionChanged(state, { payload }) {
      state.connection = payload;
    },
    setFilter(state, { payload }) {
      Object.assign(state.filters, payload);
    },
    resetFilters(state) {
      state.filters = initialState.filters;
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
        state.error = payload?.message;
      })
      .addCase(fetchBoardActivity.fulfilled, (state, { payload }) => {
        state.activity = payload;
      })
      .addCase(updateBoard.fulfilled, (state, { payload }) => {
        Object.assign(state.board, payload);
      })
      .addCase(createTask.fulfilled, (state, { payload }) => {
        tasksAdapter.upsertOne(state.tasks, payload);
      })
      .addCase(updateTask.pending, (state, { meta }) => {
        // Instant feedback for simple fields; assignees are populated objects, so wait for the server.
        const { id, assignees, ...changes } = meta.arg;
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
        const byId = Object.fromEntries(state.board.columns.map((c) => [c._id, c]));
        state.board.columns = meta.arg.columnIds.map((id) => byId[id]);
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

    for (const t of [addColumn, editColumn, removeColumn, reorderColumns]) {
      builder.addCase(t.fulfilled, (state, { payload }) => {
        if (state.board) state.board.columns = payload;
      });
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

export const taskSelectors = tasksAdapter.getSelectors((s) => s.board.tasks);

const selectFilters = (s) => s.board.filters;
const selectMe = (s) => s.auth.user;

/** Tasks grouped by column id after applying the search and filters. */
export const selectTasksByColumn = createSelector([taskSelectors.selectAll, selectFilters, selectMe], (tasks, f, me) => {
  const q = f.query.trim().toLowerCase();
  const grouped = {};
  for (const t of tasks) {
    if (q && !`${t.title} ${t.description} ${t.labels.join(' ')}`.toLowerCase().includes(q)) continue;
    if (f.priority !== 'all' && t.priority !== f.priority) continue;
    if (f.assignee === 'me' && !t.assignees.some((a) => a._id === me?._id)) continue;
    if (f.assignee === 'none' && t.assignees.length) continue;
    if (!['all', 'me', 'none'].includes(f.assignee) && !t.assignees.some((a) => a._id === f.assignee)) continue;
    (grouped[t.column] ??= []).push(t);
  }
  return grouped;
});

export const selectFiltersActive = createSelector(
  [selectFilters],
  (f) => Boolean(f.query.trim()) || f.assignee !== 'all' || f.priority !== 'all',
);

export default slice.reducer;

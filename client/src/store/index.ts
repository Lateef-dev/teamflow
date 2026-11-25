import { configureStore, isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import type { RejectValue } from '@/lib/api';
import auth from './authSlice';
import workspaces from './workspacesSlice';
import board from './boardSlice';
import ui, { toast } from './uiSlice';

const QUIET = ['auth/', '/fetch', 'board/activity', 'workspaces/myTasks'];

/** Shows a toast for any failed mutation so components do not each handle errors. */
const errorToaster: Middleware = (storeApi) => (next) => (action) => {
  if (isRejectedWithValue(action) && !QUIET.some((q) => action.type.includes(q))) {
    const payload = action.payload as RejectValue | undefined;
    storeApi.dispatch(toast(payload?.message ?? 'Something went wrong', 'error'));
  }
  return next(action);
};

export function makeStore() {
  return configureStore({
    reducer: { auth, workspaces, board, ui },
    middleware: (getDefault) => getDefault().concat(errorToaster),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

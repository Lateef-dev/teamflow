import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import auth from './authSlice';
import workspaces from './workspacesSlice';
import board from './boardSlice';
import ui, { toast } from './uiSlice';

/** Shows a toast for any failed mutation so components do not each handle errors. */
const errorToaster = (storeApi) => (next) => (action) => {
  const quiet = ['auth/', '/fetch', 'board/activity', 'workspaces/myTasks'];
  if (isRejectedWithValue(action) && !quiet.some((q) => action.type.includes(q))) {
    storeApi.dispatch(toast(action.payload?.message ?? 'Something went wrong', 'error'));
  }
  return next(action);
};

export function makeStore() {
  return configureStore({
    reducer: { auth, workspaces, board, ui },
    middleware: (getDefault) => getDefault().concat(errorToaster),
  });
}

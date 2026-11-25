import { createAsyncThunk } from '@reduxjs/toolkit';
import { toRejectValue, type RejectValue } from '@/lib/api';
import type { AppDispatch, RootState } from './index';

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: RejectValue;
}>();

/** Thunk around an API call: rejections carry a serialisable { status, message }. */
export function apiThunk<Returned, Arg = void>(type: string, request: (arg: Arg) => Promise<Returned>) {
  return createAppAsyncThunk<Returned, Arg>(type, async (arg, { rejectWithValue }) => {
    try {
      return await request(arg);
    } catch (err) {
      return rejectWithValue(toRejectValue(err));
    }
  });
}

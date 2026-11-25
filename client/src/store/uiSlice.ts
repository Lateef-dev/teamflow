import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'error';
}

const slice = createSlice({
  name: 'ui',
  initialState: { toasts: [] as Toast[] },
  reducers: {
    toast: {
      reducer(state, { payload }: PayloadAction<Toast>) {
        state.toasts = [...state.toasts, payload].slice(-4);
      },
      prepare: (message: string, tone: Toast['tone'] = 'info') => ({ payload: { id: nanoid(), message, tone } }),
    },
    dismissToast(state, { payload }: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
  },
});

export const { toast, dismissToast } = slice.actions;
export default slice.reducer;

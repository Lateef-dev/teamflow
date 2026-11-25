'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { dismissToast, type Toast as ToastData } from '@/store/uiSlice';
import { cx } from './ui';

function Toast({ toast }: { toast: ToastData }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), 4000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id]);
  return (
    <div
      role="status"
      className={cx(
        'animate-toast-in pointer-events-auto rounded-lg px-4 py-3 text-sm shadow-lg ring-1',
        toast.tone === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-slate-900 text-white ring-slate-900',
      )}
    >
      {toast.message}
    </div>
  );
}

export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@/store';
import { loadSession } from '@/store/authSlice';
import { Toaster } from '@/components/Toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(makeStore);
  useEffect(() => {
    void store.dispatch(loadSession());
  }, [store]);
  return (
    <Provider store={store}>
      {children}
      <Toaster />
    </Provider>
  );
}

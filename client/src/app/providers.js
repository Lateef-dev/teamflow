'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store';
import { loadSession } from '@/store/authSlice';
import { Toaster } from '@/components/Toaster';

export function Providers({ children }) {
  const [store] = useState(makeStore);
  useEffect(() => {
    store.dispatch(loadSession());
  }, [store]);
  return (
    <Provider store={store}>
      {children}
      <Toaster />
    </Provider>
  );
}

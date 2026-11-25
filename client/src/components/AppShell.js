'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@/store/authSlice';
import { useUserRealtime } from '@/hooks/useRealtime';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import { PageLoader } from './ui';

function UserMenu({ user }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-slate-200"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar user={user} size="sm" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <hr className="my-1 border-slate-100" />
          <button
            role="menuitem"
            onClick={() => {
              dispatch(logout());
              router.replace('/login');
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Realtime() {
  useUserRealtime();
  return null;
}

/** Client side auth guard plus the top navigation for signed in pages. */
export function AppShell({ children }) {
  const { user, status } = useSelector((s) => s.auth);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'ready' && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, user, router, pathname]);

  if (!user) return <PageLoader label="Checking your session" />;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Realtime />
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href="/dashboard" />
            <nav className="hidden sm:block">
              <Link
                href="/dashboard"
                className={`rounded-md px-2 py-1 text-sm ${pathname === '/dashboard' ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Dashboard
              </Link>
            </nav>
          </div>
          <UserMenu user={user} />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { clearAuthError, login, register } from '@/store/authSlice';
import { Button, Field, Input } from './ui';

const DEMO = { email: 'demo@teamflow.dev', password: 'password123' };

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const { user, error, submitting } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState(() =>
    isLogin && params.get('demo') ? { ...DEMO, name: '' } : { name: '', email: '', password: '' },
  );

  const next = params.get('next') || '/dashboard';

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch, mode]);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password } = form;
    if (isLogin) void dispatch(login({ email, password }));
    else void dispatch(register({ name, email, password }));
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLogin ? 'Log in to pick up where your team left off.' : 'Start a workspace and invite your team.'}
        </p>
      </div>

      {!isLogin && (
        <Field label="Name" htmlFor="name">
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} required minLength={2} />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
      </Field>
      <Field label="Password" htmlFor="password" hint={isLogin ? undefined : 'At least 8 characters'}>
        <Input
          id="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={form.password}
          onChange={set('password')}
          required
          minLength={8}
        />
      </Field>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" loading={submitting}>
        {isLogin ? 'Log in' : 'Create account'}
      </Button>

      {isLogin && (
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, ...DEMO }))}
          className="w-full text-center text-xs text-slate-500 hover:text-brand-600"
        >
          Use the demo account
        </button>
      )}

      <p className="text-center text-sm text-slate-500">
        {isLogin ? "Don't have an account? " : 'Already have an account? '}
        <Link href={isLogin ? '/register' : '/login'} className="font-medium text-brand-600 hover:text-brand-700">
          {isLogin ? 'Sign up' : 'Log in'}
        </Link>
      </p>
    </form>
  );
}

import { describe, expect, it } from 'vitest';
import { api, registerUser } from './helpers.js';

describe('auth', () => {
  it('registers, logs in and returns the current user', async () => {
    const reg = await api()
      .post('/api/auth/register')
      .send({ name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(reg.body.user.password).toBeUndefined();

    const login = await api().post('/api/auth/login').send({ email: 'ada@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ada@example.com');
  });

  it('rejects duplicate emails, bad passwords and missing tokens', async () => {
    const user = await registerUser();
    const dup = await api().post('/api/auth/register').send({ name: 'Dup', email: user.email, password: 'password123' });
    expect(dup.status).toBe(409);

    const bad = await api().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const anon = await api().get('/api/auth/me');
    expect(anon.status).toBe(401);
  });

  it('validates input', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

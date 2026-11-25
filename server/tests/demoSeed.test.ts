import { describe, expect, it } from 'vitest';
import { Board, Task, User, Workspace } from '../src/models/index.js';
import { ensureDemoData } from '../src/lib/demoSeed.js';
import { api } from './helpers.js';

describe('demo seed', () => {
  it('creates the demo workspace once and lets the demo user log in', async () => {
    expect(await ensureDemoData()).toBe(true);
    expect(await ensureDemoData()).toBe(false);

    expect(await User.countDocuments({ email: /@teamflow\.dev$/ })).toBe(3);
    expect(await Workspace.countDocuments({ inviteCode: 'acme-demo' })).toBe(1);
    expect(await Board.countDocuments()).toBe(2);
    expect(await Task.countDocuments()).toBe(8);

    const login = await api().post('/api/auth/login').send({ email: 'demo@teamflow.dev', password: 'password123' });
    expect(login.status).toBe(200);
  });
});

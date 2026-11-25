import { describe, expect, it } from 'vitest';
import { api, registerUser } from './helpers.js';

describe('workspaces', () => {
  it('lets a teammate join with the invite code and hides it from members', async () => {
    const owner = await registerUser('Owner');
    const created = await api().post('/api/workspaces').set(owner.auth).send({ name: 'Acme' });
    expect(created.status).toBe(201);
    const { _id, inviteCode } = created.body.workspace;
    expect(inviteCode).toBeTruthy();

    const mate = await registerUser('Mate');
    const before = await api().get(`/api/workspaces/${_id}`).set(mate.auth);
    expect(before.status).toBe(404);

    const joined = await api().post('/api/workspaces/join').set(mate.auth).send({ inviteCode });
    expect(joined.status).toBe(200);
    expect(joined.body.workspace.role).toBe('member');
    expect(joined.body.workspace.inviteCode).toBeUndefined();
    expect(joined.body.workspace.members).toHaveLength(2);

    const list = await api().get('/api/workspaces').set(mate.auth);
    expect(list.body.workspaces.map((w) => w._id)).toContain(_id);
  });

  it('enforces roles for admin actions', async () => {
    const owner = await registerUser('Owner');
    const { body } = await api().post('/api/workspaces').set(owner.auth).send({ name: 'Acme' });
    const ws = body.workspace;
    const mate = await registerUser('Mate');
    await api().post('/api/workspaces/join').set(mate.auth).send({ inviteCode: ws.inviteCode });

    expect((await api().patch(`/api/workspaces/${ws._id}`).set(mate.auth).send({ name: 'Hacked' })).status).toBe(403);
    expect((await api().delete(`/api/workspaces/${ws._id}`).set(mate.auth)).status).toBe(403);

    const promoted = await api()
      .patch(`/api/workspaces/${ws._id}/members/${mate.user._id}`)
      .set(owner.auth)
      .send({ role: 'admin' });
    expect(promoted.status).toBe(200);
    expect((await api().patch(`/api/workspaces/${ws._id}`).set(mate.auth).send({ name: 'Renamed' })).status).toBe(200);

    const removeOwner = await api().delete(`/api/workspaces/${ws._id}/members/${owner.user._id}`).set(mate.auth);
    expect(removeOwner.status).toBe(400);
  });

  it('lets a member leave', async () => {
    const owner = await registerUser('Owner');
    const { body } = await api().post('/api/workspaces').set(owner.auth).send({ name: 'Acme' });
    const mate = await registerUser('Mate');
    await api().post('/api/workspaces/join').set(mate.auth).send({ inviteCode: body.workspace.inviteCode });
    const left = await api().delete(`/api/workspaces/${body.workspace._id}/members/${mate.user._id}`).set(mate.auth);
    expect(left.status).toBe(200);
    expect(left.body.workspace.members).toHaveLength(1);
  });
});

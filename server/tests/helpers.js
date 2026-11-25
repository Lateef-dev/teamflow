import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);

let counter = 0;
export async function registerUser(name = 'Test User') {
  counter += 1;
  const email = `user${counter}_${Date.now()}@example.com`;
  const res = await api().post('/api/auth/register').send({ name, email, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = { Authorization: `Bearer ${res.body.token}` };
  return { ...res.body, email, auth };
}

/** Owner + workspace + board with the default columns. */
export async function boardFixture() {
  const owner = await registerUser('Owner');
  const ws = await api().post('/api/workspaces').set(owner.auth).send({ name: 'Acme' });
  const board = await api()
    .post(`/api/workspaces/${ws.body.workspace._id}/boards`)
    .set(owner.auth)
    .send({ name: 'Launch' });
  return { owner, workspace: ws.body.workspace, board: board.body.board };
}

import request from 'supertest';
import type { AuthResponse, BoardSummary, Workspace } from '../../shared/types.js';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);

export interface TestUser extends AuthResponse {
  email: string;
  auth: { Authorization: string };
}

let counter = 0;
export async function registerUser(name = 'Test User'): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}_${Date.now()}@example.com`;
  const res = await api().post('/api/auth/register').send({ name, email, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const body = res.body as AuthResponse;
  return { ...body, email, auth: { Authorization: `Bearer ${body.token}` } };
}

/** Owner + workspace + board with the default columns. */
export async function boardFixture() {
  const owner = await registerUser('Owner');
  const ws = await api().post('/api/workspaces').set(owner.auth).send({ name: 'Acme' });
  const workspace = (ws.body as { workspace: Workspace }).workspace;
  const res = await api().post(`/api/workspaces/${workspace._id}/boards`).set(owner.auth).send({ name: 'Launch' });
  const board = (res.body as { board: BoardSummary }).board;
  return { owner, workspace, board };
}

/** Column id by position, failing loudly if the board has fewer columns. */
export function columnId(board: BoardSummary, index: number): string {
  const column = board.columns[index];
  if (!column) throw new Error(`Board has no column at index ${index}`);
  return column._id;
}

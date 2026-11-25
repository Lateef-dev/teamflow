import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.js';
import { app, boardFixture, columnId, registerUser } from './helpers.js';
import { createSocketServer } from '../src/socket.js';
import { registerIo, type IoServer } from '../src/lib/realtime.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type EventPayload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

let server: http.Server;
let ioServer: IoServer;
let url: string;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  ioServer = createSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  registerIo(null);
  await ioServer.close();
});

function client(token: string): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function once<E extends keyof ServerToClientEvents>(socket: ClientSocket, event: E): Promise<EventPayload<E>> {
  return new Promise((resolve) => {
    const handler = (payload: EventPayload<E>) => resolve(payload);
    (socket.once as (ev: E, fn: (p: EventPayload<E>) => void) => void)(event, handler);
  });
}

const join = (socket: ClientSocket, boardId: string) =>
  new Promise<{ ok: boolean }>((resolve) => socket.emit('board:join', boardId, resolve));

describe('realtime', () => {
  it('rejects sockets without a valid token', async () => {
    await expect(client('bad-token')).rejects.toThrow('unauthorized');
  });

  it('broadcasts task changes and presence to teammates on the board', async () => {
    const { owner, workspace, board } = await boardFixture();
    const mate = await registerUser('Mate');
    await request(app).post('/api/workspaces/join').set(mate.auth).send({ inviteCode: workspace.inviteCode });

    const ownerSocket = await client(owner.token);
    const mateSocket = await client(mate.token);

    expect(await join(ownerSocket, board._id)).toEqual({ ok: true });
    const presence = once(ownerSocket, 'presence:update');
    expect(await join(mateSocket, board._id)).toEqual({ ok: true });
    expect((await presence).users.map((u) => u.name).sort()).toEqual(['Mate', 'Owner']);

    // The creator passes its socket id, so only the teammate gets the event.
    let echoed = false;
    ownerSocket.on('task:created', () => {
      echoed = true;
    });
    const created = once(mateSocket, 'task:created');
    await request(app)
      .post(`/api/boards/${board._id}/tasks`)
      .set(owner.auth)
      .set('x-socket-id', ownerSocket.id ?? '')
      .send({ title: 'Live task', columnId: columnId(board, 0) });
    expect((await created).title).toBe('Live task');
    await new Promise((r) => setTimeout(r, 100));
    expect(echoed).toBe(false);

    const leftPresence = once(ownerSocket, 'presence:update');
    mateSocket.disconnect();
    expect((await leftPresence).users.map((u) => u.name)).toEqual(['Owner']);
  });

  it('refuses to join a board the user cannot access', async () => {
    const { board } = await boardFixture();
    const outsider = await registerUser('Outsider');
    const socket = await client(outsider.token);
    expect((await join(socket, board._id)).ok).toBe(false);
  });
});

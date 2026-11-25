import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { app, boardFixture, registerUser } from './helpers.js';
import { createSocketServer } from '../src/socket.js';
import { registerIo } from '../src/lib/realtime.js';

let server;
let ioServer;
let url;
const clients = [];

beforeAll(async () => {
  server = http.createServer(app);
  ioServer = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  registerIo(null);
  await new Promise((resolve) => ioServer.close(resolve));
});

function client(token) {
  const socket = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const join = (socket, boardId) => new Promise((resolve) => socket.emit('board:join', boardId, resolve));

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
    ownerSocket.on('task:created', () => { echoed = true; });
    const created = once(mateSocket, 'task:created');
    await request(app)
      .post(`/api/boards/${board._id}/tasks`)
      .set(owner.auth)
      .set('x-socket-id', ownerSocket.id)
      .send({ title: 'Live task', columnId: board.columns[0]._id });
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
    const res = await join(socket, board._id);
    expect(res.ok).toBe(false);
  });
});

import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { PublicUser } from '../../shared/types.js';
import { config } from './config.js';
import { userFromToken } from './middleware/auth.js';
import { boardForMember, workspaceForMember } from './lib/access.js';
import { registerIo, rooms, type IoServer } from './lib/realtime.js';
import { toPublicUser } from './lib/serialize.js';

/**
 * Presence: boardId -> userId -> { user, sockets }.
 * A user with two tabs open counts once and only leaves when both close.
 */
const presence = new Map<string, Map<string, { user: PublicUser; sockets: Set<string> }>>();

const presenceList = (boardId: string) => [...(presence.get(boardId)?.values() ?? [])].map((e) => e.user);

function addPresence(boardId: string, user: PublicUser, socketId: string) {
  let board = presence.get(boardId);
  if (!board) presence.set(boardId, (board = new Map()));
  let entry = board.get(user._id);
  if (!entry) board.set(user._id, (entry = { user, sockets: new Set() }));
  entry.sockets.add(socketId);
}

function removePresence(boardId: string, userId: string, socketId: string) {
  const board = presence.get(boardId);
  const entry = board?.get(userId);
  if (!board || !entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) board.delete(userId);
  if (board.size === 0) presence.delete(boardId);
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

export function createSocketServer(httpServer: HttpServer): IoServer {
  const io: IoServer = new Server(httpServer, {
    cors: { origin: [...config.clientOrigins], credentials: true },
  });

  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    socket.data.boards = new Set();
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    const publicUser = toPublicUser(user);
    void socket.join(rooms.user(user._id));

    const broadcastPresence = (boardId: string) =>
      io.to(rooms.board(boardId)).emit('presence:update', { boardId, users: presenceList(boardId) });

    const leaveBoard = (boardId: string) => {
      if (!socket.data.boards.has(boardId)) return;
      socket.data.boards.delete(boardId);
      void socket.leave(rooms.board(boardId));
      removePresence(boardId, publicUser._id, socket.id);
      broadcastPresence(boardId);
    };

    socket.on('board:join', async (boardId, ack) => {
      try {
        await boardForMember(boardId, user);
        await socket.join(rooms.board(boardId));
        socket.data.boards.add(boardId);
        addPresence(boardId, publicUser, socket.id);
        broadcastPresence(boardId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: errorMessage(err) });
      }
    });

    socket.on('board:leave', leaveBoard);

    socket.on('workspace:join', async (workspaceId, ack) => {
      try {
        await workspaceForMember(workspaceId, user);
        await socket.join(rooms.workspace(workspaceId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: errorMessage(err) });
      }
    });

    socket.on('workspace:leave', (workspaceId) => void socket.leave(rooms.workspace(workspaceId)));

    // Lightweight "who is looking at this card" signal; not persisted.
    socket.on('task:focus', ({ boardId, taskId }) => {
      if (!socket.data.boards.has(boardId)) return;
      socket.to(rooms.board(boardId)).emit('task:focus', { taskId, user: publicUser });
    });

    socket.on('disconnect', () => {
      for (const boardId of [...socket.data.boards]) leaveBoard(boardId);
    });
  });

  registerIo(io);
  return io;
}

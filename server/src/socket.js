import { Server } from 'socket.io';
import { config } from './config.js';
import { userFromToken } from './middleware/auth.js';
import { boardForMember, workspaceForMember } from './lib/access.js';
import { registerIo, rooms } from './lib/realtime.js';

/**
 * Presence: boardId -> Map<userId, { user, sockets: Set<socketId> }>.
 * A user with two tabs open counts once, and only leaves when both close.
 */
const presence = new Map();

function presenceList(boardId) {
  return [...(presence.get(boardId)?.values() ?? [])].map((entry) => entry.user);
}

function addPresence(boardId, user, socketId) {
  if (!presence.has(boardId)) presence.set(boardId, new Map());
  const board = presence.get(boardId);
  const key = user._id.toString();
  if (!board.has(key)) board.set(key, { user, sockets: new Set() });
  board.get(key).sockets.add(socketId);
}

function removePresence(boardId, userId, socketId) {
  const board = presence.get(boardId);
  const entry = board?.get(userId);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) board.delete(userId);
  if (board.size === 0) presence.delete(boardId);
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
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
    const publicUser = user.toPublic();
    socket.join(rooms.user(user._id));

    const leaveBoard = (boardId) => {
      if (!socket.data.boards.has(boardId)) return;
      socket.data.boards.delete(boardId);
      socket.leave(rooms.board(boardId));
      removePresence(boardId, publicUser._id, socket.id);
      io.to(rooms.board(boardId)).emit('presence:update', { boardId, users: presenceList(boardId) });
    };

    socket.on('board:join', async (boardId, ack = () => {}) => {
      try {
        await boardForMember(boardId, user);
        socket.join(rooms.board(boardId));
        socket.data.boards.add(boardId);
        addPresence(boardId, publicUser, socket.id);
        io.to(rooms.board(boardId)).emit('presence:update', { boardId, users: presenceList(boardId) });
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    socket.on('board:leave', (boardId) => leaveBoard(boardId));

    socket.on('workspace:join', async (workspaceId, ack = () => {}) => {
      try {
        await workspaceForMember(workspaceId, user);
        socket.join(rooms.workspace(workspaceId));
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: err.message });
      }
    });

    socket.on('workspace:leave', (workspaceId) => socket.leave(rooms.workspace(workspaceId)));

    // Lightweight "who is looking at this task" signal; not persisted.
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

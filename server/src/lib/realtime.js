/**
 * Thin wrapper around the Socket.io server so route handlers can broadcast
 * without importing the socket layer directly. When no io instance is
 * registered (e.g. in API unit tests) every emit is a no-op.
 */
let io = null;

export const rooms = {
  board: (id) => `board:${id}`,
  workspace: (id) => `workspace:${id}`,
  user: (id) => `user:${id}`,
};

export function registerIo(instance) {
  io = instance;
}

/**
 * @param {string} room
 * @param {string} event
 * @param {unknown} payload
 * @param {string} [exceptSocketId] socket that triggered the change; it already applied it optimistically
 */
export function emit(room, event, payload, exceptSocketId) {
  if (!io) return;
  const target = exceptSocketId ? io.to(room).except(exceptSocketId) : io.to(room);
  target.emit(event, payload);
}

export const emitToBoard = (boardId, event, payload, except) =>
  emit(rooms.board(boardId), event, payload, except);

export const emitToWorkspace = (workspaceId, event, payload, except) =>
  emit(rooms.workspace(workspaceId), event, payload, except);

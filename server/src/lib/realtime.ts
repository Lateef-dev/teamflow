import type { Server } from 'socket.io';
import type { UserDoc } from '../models/index.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types.js';

/**
 * Thin wrapper around the Socket.io server so route handlers can broadcast
 * without importing the socket layer. With no io registered (API tests)
 * every emit is a no-op. Event names and payloads are checked against the
 * shared ServerToClientEvents map.
 */
export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export interface SocketData {
  user: UserDoc;
  /** Boards this socket has joined, for presence cleanup on disconnect. */
  boards: Set<string>;
}

type Events = ServerToClientEvents;
type IdLike = string | { toString(): string };

let io: IoServer | null = null;

export const rooms = {
  board: (id: IdLike) => `board:${id.toString()}`,
  workspace: (id: IdLike) => `workspace:${id.toString()}`,
  user: (id: IdLike) => `user:${id.toString()}`,
};

export function registerIo(instance: IoServer | null) {
  io = instance;
}

/**
 * @param exceptSocketId socket that triggered the change; it already applied it optimistically
 */
export function emit<E extends keyof Events>(
  room: string,
  event: E,
  payload: Parameters<Events[E]>[0],
  exceptSocketId?: string,
) {
  if (!io) return;
  const target = exceptSocketId ? io.to(room).except(exceptSocketId) : io.to(room);
  // socket.io's typed emit cannot narrow a generic event name, so spread the args tuple.
  (target.emit as (ev: E, ...args: Parameters<Events[E]>) => boolean)(event, ...([payload] as Parameters<Events[E]>));
}

export const emitToBoard = <E extends keyof Events>(boardId: IdLike, event: E, payload: Parameters<Events[E]>[0], except?: string) =>
  emit(rooms.board(boardId), event, payload, except);

export const emitToWorkspace = <E extends keyof Events>(
  workspaceId: IdLike,
  event: E,
  payload: Parameters<Events[E]>[0],
  except?: string,
) => emit(rooms.workspace(workspaceId), event, payload, except);

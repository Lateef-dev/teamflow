import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';

/** Socket typed with the shared event maps, so event names and payloads are checked. */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

const url = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** One shared connection per tab, authenticated with the JWT. */
export function connectSocket(token: string): AppSocket {
  const current = socket?.auth as { token?: string } | undefined;
  if (socket && current?.token === token) return socket;
  socket?.disconnect();
  socket = io(url(), { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export const getSocket = () => socket;

export const getSocketId = () => (socket?.connected ? (socket.id ?? null) : null);

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

import { io } from 'socket.io-client';

let socket = null;

const url = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** One shared connection per tab, authenticated with the JWT. */
export function connectSocket(token) {
  if (socket && socket.auth?.token === token) return socket;
  socket?.disconnect();
  socket = io(url(), { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function getSocket() {
  return socket;
}

export function getSocketId() {
  return socket?.connected ? socket.id : null;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

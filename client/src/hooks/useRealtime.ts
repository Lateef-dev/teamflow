'use client';

import { useEffect } from 'react';
import type { ID, ServerToClientEvents } from '@shared/types';
import { getSocket, type AppSocket } from '@/lib/socket';
import { useAppDispatch } from './store';
import {
  activityReceived,
  boardChanged,
  boardGone,
  columnsSet,
  commentReceived,
  commentRemoved,
  connectionChanged,
  fetchBoard,
  membersChangedOnBoard,
  presenceSet,
  taskFocused,
  taskRemoved,
  taskUpserted,
  tasksReordered,
} from '@/store/boardSlice';
import {
  boardRemoved,
  boardUpserted,
  membersChanged,
  workspaceActivityAdded,
  workspaceChanged,
  workspaceGone,
} from '@/store/workspacesSlice';

type Handlers = Partial<ServerToClientEvents>;

interface RoomLifecycle {
  /** Runs on every (re)connect; `initial` is false after a reconnect. */
  onConnect: (socket: AppSocket, initial: boolean) => void;
  onLeave: (socket: AppSocket) => void;
  onDisconnect?: () => void;
}

/** Subscribes to socket events for as long as the component is mounted. */
function useSocketEvents(lifecycle: RoomLifecycle, handlers: Handlers, deps: unknown[]) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const entries = Object.entries(handlers) as [keyof ServerToClientEvents, (...args: unknown[]) => void][];
    // Socket.io's typed `on` cannot take a union of event names, so register through a loose signature.
    const on = socket.on.bind(socket) as (ev: string, fn: (...args: unknown[]) => void) => void;
    const off = socket.off.bind(socket) as (ev: string, fn: (...args: unknown[]) => void) => void;
    entries.forEach(([event, fn]) => on(event, fn));

    let initial = true;
    const onConnect = () => {
      lifecycle.onConnect(socket, initial);
      initial = false;
    };
    const onDisconnect = () => lifecycle.onDisconnect?.();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();

    return () => {
      entries.forEach(([event, fn]) => off(event, fn));
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      lifecycle.onLeave(socket);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Joins the board's room, keeps Redux in sync with teammates' changes and
 * refetches after a reconnect so nothing missed while offline is lost.
 */
export function useBoardRealtime(boardId: ID) {
  const dispatch = useAppDispatch();
  useSocketEvents(
    {
      onConnect: (socket, initial) => {
        dispatch(connectionChanged('online'));
        socket.emit('board:join', boardId);
        if (!initial) void dispatch(fetchBoard(boardId));
      },
      onLeave: (socket) => socket.emit('board:leave', boardId),
      onDisconnect: () => dispatch(connectionChanged('offline')),
    },
    {
      'task:created': (t) => dispatch(taskUpserted(t)),
      'task:updated': (t) => dispatch(taskUpserted(t)),
      'task:moved': (t) => dispatch(taskUpserted(t)),
      'task:deleted': (t) => dispatch(taskRemoved(t)),
      'tasks:reordered': (p) => dispatch(tasksReordered(p)),
      'board:columns': (p) => dispatch(columnsSet(p)),
      'board:updated': (b) => dispatch(boardChanged(b)),
      'board:deleted': (b) => dispatch(boardGone(b)),
      'presence:update': (p) => dispatch(presenceSet(p)),
      'task:focus': (p) => dispatch(taskFocused(p)),
      'comment:created': (p) => dispatch(commentReceived(p)),
      'comment:deleted': (p) => dispatch(commentRemoved(p)),
      'activity:created': (a) => dispatch(activityReceived(a)),
      'workspace:members': (p) => dispatch(membersChangedOnBoard(p)),
    },
    [boardId, dispatch],
  );
}

export function useWorkspaceRealtime(workspaceId: ID) {
  const dispatch = useAppDispatch();
  useSocketEvents(
    {
      onConnect: (socket) => socket.emit('workspace:join', workspaceId),
      onLeave: (socket) => socket.emit('workspace:leave', workspaceId),
    },
    {
      'board:created': (b) => dispatch(boardUpserted(b)),
      'board:updated': (b) => dispatch(boardUpserted(b)),
      'board:deleted': (b) => dispatch(boardRemoved(b)),
      'activity:created': (a) => dispatch(workspaceActivityAdded(a)),
      'workspace:members': (p) => dispatch(membersChanged(p)),
      'workspace:updated': (w) => dispatch(workspaceChanged(w)),
      'workspace:deleted': (w) => dispatch(workspaceGone(w)),
    },
    [workspaceId, dispatch],
  );
}

/** Listens on the personal room, e.g. for being removed from a workspace. */
export function useUserRealtime() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onRemoved = (w: { _id: ID }) => dispatch(workspaceGone(w));
    socket.on('workspace:removed', onRemoved);
    return () => {
      socket.off('workspace:removed', onRemoved);
    };
  }, [dispatch]);
}

'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getSocket } from '@/lib/socket';
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

/** Subscribes a component to a set of socket events for as long as it is mounted. */
function useSocketEvents(join, handlers, deps) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const entries = Object.entries(handlers);
    entries.forEach(([event, fn]) => socket.on(event, fn));
    let initial = true;
    const onConnect = () => {
      join.onConnect(socket, { initial });
      initial = false;
    };
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    return () => {
      entries.forEach(([event, fn]) => socket.off(event, fn));
      socket.off('connect', onConnect);
      join.onLeave(socket);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Joins the board's room, keeps Redux in sync with teammates' changes and
 * refetches after a reconnect so nothing missed while offline is lost.
 */
export function useBoardRealtime(boardId) {
  const dispatch = useDispatch();
  useSocketEvents(
    {
      onConnect: (socket, { initial } = {}) => {
        dispatch(connectionChanged('online'));
        socket.emit('board:join', boardId);
        if (!initial) dispatch(fetchBoard(boardId));
      },
      onLeave: (socket) => socket.emit('board:leave', boardId),
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
      disconnect: () => dispatch(connectionChanged('offline')),
    },
    [boardId, dispatch],
  );
}

export function useWorkspaceRealtime(workspaceId) {
  const dispatch = useDispatch();
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
  const dispatch = useDispatch();
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onRemoved = (w) => dispatch(workspaceGone(w));
    socket.on('workspace:removed', onRemoved);
    return () => socket.off('workspace:removed', onRemoved);
  }, [dispatch]);
}

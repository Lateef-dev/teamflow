'use client';

import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addColumn,
  fetchBoard,
  fetchBoardActivity,
  moveTask,
  reorderColumns,
  selectTasksByColumn,
  taskSelectors,
  updateBoard,
} from '@/store/boardSlice';
import { deleteBoard } from '@/store/workspacesSlice';
import { useBoardRealtime } from '@/hooks/useRealtime';
import { useDraft } from '@/hooks/useDraft';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Column } from '@/components/board/Column';
import { Filters, Presence } from '@/components/board/BoardToolbar';
import { TaskModal } from '@/components/board/TaskModal';
import { Button, EmptyState, PageLoader, cx } from '@/components/ui';
import { COLUMN_COLORS } from '@/lib/constants';

function AddColumn({ boardId, count }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await dispatch(addColumn({ boardId, title: title.trim(), color: COLUMN_COLORS[count % COLUMN_COLORS.length] }));
    setTitle('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="h-12 w-72 shrink-0 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700">
        + Add column
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="w-72 shrink-0 rounded-xl bg-slate-100 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Column title"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" type="submit">Add</Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function ActivityDrawer({ open, onClose, boardId }) {
  const dispatch = useDispatch();
  const items = useSelector((s) => s.board.activity);
  useEffect(() => {
    if (open) dispatch(fetchBoardActivity(boardId));
  }, [open, boardId, dispatch]);
  return (
    <aside
      aria-hidden={!open}
      className={cx(
        'fixed bottom-0 right-0 top-14 z-30 w-80 transform border-l border-slate-200 bg-white shadow-xl transition-transform duration-200',
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Close</button>
      </div>
      <div className="h-[calc(100%-49px)] overflow-y-auto p-4">
        <ActivityFeed items={items} />
      </div>
    </aside>
  );
}

function BoardTitle({ board }) {
  const dispatch = useDispatch();
  const [name, setName] = useDraft(board.name);
  return (
    <input
      aria-label="Board name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => name.trim() && name !== board.name && dispatch(updateBoard({ id: board._id, name: name.trim() }))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="-ml-1 min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xl font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:outline-none"
    />
  );
}

export function BoardView({ params }) {
  const { boardId } = use(params);
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openTaskId = searchParams.get('task');

  const { status, error, board, workspace } = useSelector((s) => s.board);
  const loaded = useSelector((s) => s.board.id === boardId);
  const visible = useSelector(selectTasksByColumn);
  const allTasks = useSelector(taskSelectors.selectAll);
  const [activityOpen, setActivityOpen] = useState(false);

  useBoardRealtime(boardId);
  useEffect(() => {
    dispatch(fetchBoard(boardId));
  }, [dispatch, boardId]);

  const openTask = useCallback(
    (id) => router.push(`${pathname}?task=${id}`, { scroll: false }),
    [router, pathname],
  );
  const closeTask = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const onDragEnd = async ({ source, destination, draggableId, type }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'COLUMN') {
      const ids = board.columns.map((c) => c._id);
      const [moved] = ids.splice(source.index, 1);
      ids.splice(destination.index, 0, moved);
      const res = await dispatch(reorderColumns({ boardId, columnIds: ids }));
      if (reorderColumns.rejected.match(res)) dispatch(fetchBoard(boardId));
      return;
    }

    // The visible list may be filtered, so translate the drop index into
    // an index in the full column before asking the server.
    const columnId = destination.droppableId;
    const shown = (visible[columnId] ?? []).filter((t) => t._id !== draggableId);
    const full = allTasks.filter((t) => t.column === columnId && t._id !== draggableId);
    let index;
    if (destination.index < shown.length) index = full.findIndex((t) => t._id === shown[destination.index]._id);
    else index = shown.length ? full.findIndex((t) => t._id === shown.at(-1)._id) + 1 : full.length;

    const res = await dispatch(moveTask({ id: draggableId, columnId, index }));
    if (moveTask.rejected.match(res)) dispatch(fetchBoard(boardId));
  };

  if (!loaded || status === 'loading' || status === 'idle') return <PageLoader label="Loading board" />;
  if (status === 'failed' || status === 'gone') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState
          title={status === 'gone' ? 'This board was deleted' : 'Board not found'}
          body={status === 'failed' ? error : 'Someone on your team deleted it.'}
          action={<Link href="/dashboard" className="text-sm font-medium text-brand-600">Back to dashboard</Link>}
        />
      </div>
    );
  }

  const canDelete = ['owner', 'admin'].includes(workspace.role);
  const doneColumnId = board.columns.at(-1)?._id;

  const removeBoard = async () => {
    if (!window.confirm(`Delete ${board.name} and all of its tasks?`)) return;
    const res = await dispatch(deleteBoard(board._id));
    if (deleteBoard.fulfilled.match(res)) router.replace(`/w/${workspace._id}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <nav className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          <span className="mx-1">/</span>
          <Link href={`/w/${workspace._id}`} className="hover:text-slate-900">{workspace.name}</Link>
        </nav>
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <BoardTitle board={board} />
          <div className="flex flex-wrap items-center gap-3">
            <Presence />
            <Button variant="secondary" size="sm" onClick={() => setActivityOpen((o) => !o)}>Activity</Button>
            {canDelete && (
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={removeBoard}>Delete</Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <Filters />
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="COLUMN" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="board-scroll flex min-h-0 flex-1 items-start gap-4 overflow-x-auto px-4 py-4 sm:px-6"
            >
              {board.columns.map((column, i) => (
                <Column
                  key={column._id}
                  boardId={board._id}
                  column={column}
                  index={i}
                  tasks={visible[column._id] ?? []}
                  total={allTasks.filter((t) => t.column === column._id).length}
                  onOpenTask={openTask}
                  isDone={column._id === doneColumnId}
                />
              ))}
              {provided.placeholder}
              <AddColumn boardId={board._id} count={board.columns.length} />
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} boardId={board._id} />
      <TaskModal taskId={openTaskId} onClose={closeTask} />
    </div>
  );
}

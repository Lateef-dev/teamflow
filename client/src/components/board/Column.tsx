'use client';

import { Draggable, Droppable } from '@hello-pangea/dnd';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '@/hooks/store';
import { createTask, editColumn, removeColumn } from '@/store/boardSlice';
import type { Column as ColumnData, ID, Task } from '@shared/types';
import { COLUMN_COLORS } from '@/lib/constants';
import { TaskCard } from './TaskCard';
import { cx } from '../ui';

function QuickAdd({ boardId, columnId }: { boardId: ID; columnId: ID }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle('');
    await dispatch(createTask({ boardId, columnId, title: value }));
  };
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
      >
        <span className="text-lg leading-none">+</span> Add task
      </button>
    );
  }
  return (
    <form onSubmit={submit}>
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
          if (e.key === 'Escape') setOpen(false);
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="What needs doing?"
        className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <div className="mt-1 flex gap-2">
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">Add</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">Cancel</button>
      </div>
    </form>
  );
}

interface ColumnMenuProps {
  boardId: ID;
  column: ColumnData;
  onRename: () => void;
  taskCount: number;
}

function ColumnMenu({ boardId, column, onRename, taskCount }: ColumnMenuProps) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label={`${column.title} column options`}>
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg bg-white p-1 shadow-lg ring-1 ring-slate-200">
          <button onClick={() => { setOpen(false); onRename(); }} className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-slate-100">Rename</button>
          <div className="flex flex-wrap gap-1.5 px-3 py-2">
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => void dispatch(editColumn({ boardId, columnId: column._id, color: c }))}
                className={cx('h-5 w-5 rounded-full ring-offset-1', column.color === c && 'ring-2 ring-slate-400')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            disabled={taskCount > 0}
            title={taskCount > 0 ? 'Move the tasks out first' : undefined}
            onClick={() => {
              if (window.confirm(`Delete the ${column.title} column?`)) void dispatch(removeColumn({ boardId, columnId: column._id }));
            }}
            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            Delete column
          </button>
        </div>
      )}
    </div>
  );
}

interface ColumnProps {
  boardId: ID;
  column: ColumnData;
  index: number;
  /** Tasks after filtering. */
  tasks: Task[];
  /** Unfiltered count. */
  total: number;
  onOpenTask: (taskId: ID) => void;
  isDone: boolean;
}

export function Column({ boardId, column, index, tasks, onOpenTask, isDone, total }: ColumnProps) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);

  const saveTitle = () => {
    setEditing(false);
    const value = title.trim();
    if (value && value !== column.title) void dispatch(editColumn({ boardId, columnId: column._id, title: value }));
    else setTitle(column.title);
  };

  return (
    <Draggable draggableId={`col-${column._id}`} index={index}>
      {(provided, snapshot) => (
        <section
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cx('flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-100/80', snapshot.isDragging && 'shadow-xl')}
          aria-label={`${column.title} column`}
        >
          <header {...provided.dragHandleProps} className="flex items-center gap-2 px-3 pb-2 pt-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
            {editing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') { setTitle(column.title); setEditing(false); }
                }}
                className="min-w-0 flex-1 rounded border border-brand-500 bg-white px-1 text-sm font-semibold focus:outline-none"
              />
            ) : (
              <h2 onDoubleClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                {column.title}
              </h2>
            )}
            <span className="rounded-full bg-slate-200 px-2 text-xs font-medium text-slate-600">
              {tasks.length !== total ? `${tasks.length}/${total}` : total}
            </span>
            <ColumnMenu boardId={boardId} column={column} taskCount={total} onRename={() => setEditing(true)} />
          </header>
          <Droppable droppableId={column._id} type="TASK">
            {(dropProvided, dropSnapshot) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className={cx(
                  'mx-2 min-h-16 flex-1 overflow-y-auto rounded-lg px-1 pt-1 transition-colors',
                  dropSnapshot.isDraggingOver && 'bg-brand-50/70',
                )}
              >
                {tasks.map((task, i) => (
                  <TaskCard key={task._id} task={task} index={i} onOpen={onOpenTask} isDone={isDone} />
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
          <div className="px-2 pb-2 pt-1">
            <QuickAdd boardId={boardId} columnId={column._id} />
          </div>
        </section>
      )}
    </Draggable>
  );
}

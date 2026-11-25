'use client';

import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import {
  addComment,
  deleteComment,
  deleteTask,
  fetchComments,
  moveTask,
  taskSelectors,
  updateTask,
} from '@/store/boardSlice';
import { getSocket } from '@/lib/socket';
import { useDraft } from '@/hooks/useDraft';
import type { Column, ID, Member, PublicUser, Task, UpdateTaskInput } from '@shared/types';
import { PRIORITIES, isPriority } from '@/lib/constants';
import { Avatar } from '../Avatar';
import { Modal } from '../Modal';
import { TimeAgo } from '../TimeAgo';
import { Button, Field, Input, Select, Textarea, cx } from '../ui';

const toDateInput = (d: string | null) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

function Comments({ taskId, me }: { taskId: ID; me: PublicUser }) {
  const dispatch = useAppDispatch();
  const comments = useAppSelector((s) => s.board.comments[taskId]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dispatch(fetchComments(taskId));
  }, [dispatch, taskId]);

  const submit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const res = await dispatch(addComment({ taskId, body }));
    setBusy(false);
    if (addComment.fulfilled.match(res)) setBody('');
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Comments</h3>
      <ul className="mt-3 space-y-4">
        {comments === undefined && <li className="text-sm text-slate-400">Loading comments…</li>}
        {comments?.length === 0 && <li className="text-sm text-slate-400">No comments yet. Start the conversation.</li>}
        {comments?.map((c) => (
          <li key={c._id} className="flex gap-3">
            <Avatar user={c.author} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-slate-800">{c.author.name}</span>
                <TimeAgo date={c.createdAt} className="text-xs text-slate-400" />
                {c.author._id === me._id && (
                  <button
                    onClick={() => void dispatch(deleteComment({ taskId, commentId: c._id }))}
                    className="ml-auto text-xs text-slate-400 hover:text-rose-600"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-4 flex gap-3">
        <Avatar user={me} size="sm" />
        <div className="flex-1 space-y-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit(e);
            }}
            placeholder="Write a comment… (Ctrl + Enter to send)"
            aria-label="New comment"
          />
          <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>Comment</Button>
        </div>
      </form>
    </div>
  );
}

function Assignees({ task, members }: { task: Task; members: Member[] }) {
  const dispatch = useAppDispatch();
  const ids = task.assignees.map((a) => a._id);
  const toggle = (userId: ID) => {
    const next = ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId];
    void dispatch(updateTask({ id: task._id, assignees: next }));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map(({ user }) => {
        const active = ids.includes(user._id);
        return (
          <button
            key={user._id}
            type="button"
            onClick={() => toggle(user._id)}
            aria-pressed={active}
            className={cx(
              'flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs ring-1 transition',
              active ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <Avatar user={user} size="xs" />
            {user.name.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}

function Labels({ task }: { task: Task }) {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const save = (labels: string[]) => void dispatch(updateTask({ id: task._id, labels }));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const label = value.trim().toLowerCase();
    if (label && !task.labels.includes(label)) save([...task.labels, label]);
    setValue('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.labels.map((l) => (
        <span key={l} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {l}
          <button type="button" onClick={() => save(task.labels.filter((x) => x !== l))} aria-label={`Remove ${l}`} className="text-brand-400 hover:text-brand-700">×</button>
        </span>
      ))}
      <form onSubmit={add}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+ label"
          maxLength={24}
          className="w-20 rounded-md border border-transparent px-1.5 py-0.5 text-xs hover:border-slate-200 focus:border-brand-500 focus:outline-none"
        />
      </form>
    </div>
  );
}

interface DetailsProps {
  task: Task;
  columns: Column[];
  members: Member[];
  onClose: () => void;
}

function Details({ task, columns, members, onClose }: DetailsProps) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  // Local drafts that follow along when a teammate edits the same task.
  const [title, setTitle] = useDraft(task.title);
  const [description, setDescription] = useDraft(task.description);

  const save = (changes: UpdateTaskInput) =>
    void dispatch(updateTask({ id: task._id, ...changes }));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_220px]">
      <div className="space-y-5">
        <Input
          aria-label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
          className="h-auto border-transparent px-2 py-1 text-lg font-semibold hover:border-slate-200"
        />
        <Field label="Description" htmlFor="task-desc">
          <Textarea
            id="task-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== task.description && save({ description })}
            placeholder="Add more detail, links or acceptance criteria…"
          />
        </Field>
        <div className="border-t border-slate-100 pt-5">
          {me && <Comments taskId={task._id} me={me} />}
        </div>
      </div>
      <aside className="space-y-4">
        <Field label="Status" htmlFor="task-col">
          <Select
            id="task-col"
            value={task.column}
            onChange={(e) => void dispatch(moveTask({ id: task._id, columnId: e.target.value, index: Number.MAX_SAFE_INTEGER }))}
          >
            {columns.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Select id="task-priority" value={task.priority} onChange={(e) => {
              if (isPriority(e.target.value)) save({ priority: e.target.value });
            }}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="task-due">
          <Input
            id="task-due"
            type="date"
            value={toDateInput(task.dueDate)}
            onChange={(e) => save({ dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
          />
        </Field>
        <Field label="Assignees">
          <Assignees task={task} members={members} />
        </Field>
        <Field label="Labels">
          <Labels task={task} />
        </Field>
        <div className="space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-400">
          <p>Created <TimeAgo date={task.createdAt} /></p>
          <p>Updated <TimeAgo date={task.updatedAt} /></p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-rose-600 hover:bg-rose-50"
          onClick={async () => {
            if (!window.confirm('Delete this task?')) return;
            onClose();
            await dispatch(deleteTask(task._id));
          }}
        >
          Delete task
        </Button>
      </aside>
    </div>
  );
}

export function TaskModal({ taskId, onClose }: { taskId: ID | null; onClose: () => void }) {
  const task = useAppSelector((s) => (taskId ? taskSelectors.selectById(s, taskId) : null));
  const board = useAppSelector((s) => s.board.board);
  const members = useAppSelector((s) => s.board.workspace?.members ?? []);
  const status = useAppSelector((s) => s.board.status);

  // Tell teammates we're looking at this card, refreshed while it stays open.
  useEffect(() => {
    if (!taskId || !board) return undefined;
    const ping = () => getSocket()?.emit('task:focus', { boardId: board._id, taskId });
    ping();
    const t = setInterval(ping, 10000);
    return () => clearInterval(t);
  }, [taskId, board]);

  const open = Boolean(taskId);
  const missing = open && status === 'ready' && !task;

  return (
    <Modal open={open} onClose={onClose} size="lg" title={missing ? 'Task not found' : board?.name}>
      {missing && <p className="text-sm text-slate-500">This task was deleted or moved to another board.</p>}
      {task && board && <Details key={task._id} task={task} columns={board.columns} members={members} onClose={onClose} />}
    </Modal>
  );
}

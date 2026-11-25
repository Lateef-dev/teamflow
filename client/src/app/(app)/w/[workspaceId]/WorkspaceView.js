'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createBoard,
  currentBoardsSelectors,
  deleteWorkspace,
  fetchWorkspace,
  regenerateInvite,
  removeMember,
  setMemberRole,
  updateWorkspace,
  workspaceSelectors,
} from '@/store/workspacesSlice';
import { toast } from '@/store/uiSlice';
import { useWorkspaceRealtime } from '@/hooks/useRealtime';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Badge, Button, EmptyState, Field, Input, PageLoader, Textarea } from '@/components/ui';

function BoardCard({ board }) {
  const pct = board.taskCount ? Math.round((board.doneCount / board.taskCount) * 100) : 0;
  return (
    <Link
      href={`/b/${board._id}`}
      className="group rounded-xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
    >
      <div className="mb-4 flex gap-1">
        {board.columns.map((c) => (
          <span key={c._id} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: c.color }} />
        ))}
      </div>
      <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{board.name}</h3>
      <p className="mt-1 line-clamp-1 text-sm text-slate-500">{board.description || `${board.columns.length} columns`}</p>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{board.taskCount} tasks</span>
          <span>{pct}% done</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}

function CreateBoardModal({ open, onClose, workspaceId }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await dispatch(createBoard({ workspaceId, name, description }));
    setBusy(false);
    if (createBoard.fulfilled.match(res)) {
      setName('');
      setDescription('');
      onClose();
      router.push(`/b/${res.payload._id}`);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="New board" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Board name" htmlFor="board-name">
          <Input id="board-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 15" />
        </Field>
        <Field label="Description" htmlFor="board-desc" hint="Boards start with To do, In progress, In review and Done.">
          <Textarea id="board-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>Create board</Button>
        </div>
      </form>
    </Modal>
  );
}

function InviteCard({ workspace }) {
  const dispatch = useDispatch();
  if (!workspace.inviteCode) return null;
  const copy = async () => {
    await navigator.clipboard?.writeText(workspace.inviteCode);
    dispatch(toast('Invite code copied'));
  };
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">Invite teammates</h3>
      <p className="mt-1 text-xs text-slate-500">Share this code. They can join from their dashboard.</p>
      <div className="mt-3 flex gap-2">
        <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">{workspace.inviteCode}</code>
        <Button size="sm" variant="secondary" className="h-auto" onClick={copy}>Copy</Button>
      </div>
      <button onClick={() => dispatch(regenerateInvite(workspace._id))} className="mt-2 text-xs text-slate-500 hover:text-brand-600">
        Generate a new code
      </button>
    </div>
  );
}

function Members({ workspace, me }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const canManage = ['owner', 'admin'].includes(workspace.role);
  const isOwner = workspace.role === 'owner';

  const leave = async () => {
    if (!window.confirm(`Leave ${workspace.name}?`)) return;
    const res = await dispatch(removeMember({ id: workspace._id, userId: me._id }));
    if (removeMember.fulfilled.match(res)) router.replace('/dashboard');
  };

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">Members · {workspace.members.length}</h3>
      <ul className="mt-3 space-y-3">
        {workspace.members.map(({ user, role }) => (
          <li key={user._id} className="flex items-center gap-3">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {user.name} {user._id === me._id && <span className="font-normal text-slate-400">(you)</span>}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            {isOwner && role !== 'owner' ? (
              <select
                aria-label={`Role for ${user.name}`}
                value={role}
                onChange={(e) => dispatch(setMemberRole({ id: workspace._id, userId: user._id, role: e.target.value }))}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <Badge className="bg-slate-100 capitalize text-slate-600">{role}</Badge>
            )}
            {canManage && role !== 'owner' && user._id !== me._id && (isOwner || role === 'member') && (
              <button
                onClick={() => window.confirm(`Remove ${user.name}?`) && dispatch(removeMember({ id: workspace._id, userId: user._id }))}
                className="text-xs text-slate-400 hover:text-rose-600"
                aria-label={`Remove ${user.name}`}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {workspace.role !== 'owner' && (
        <button onClick={leave} className="mt-4 text-xs text-rose-600 hover:text-rose-700">Leave workspace</button>
      )}
    </div>
  );
}

function SettingsModal({ open, onClose, workspace }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const save = async (e) => {
    e.preventDefault();
    const res = await dispatch(updateWorkspace({ id: workspace._id, name, description }));
    if (updateWorkspace.fulfilled.match(res)) onClose();
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${workspace.name} and all of its boards? This cannot be undone.`)) return;
    const res = await dispatch(deleteWorkspace(workspace._id));
    if (deleteWorkspace.fulfilled.match(res)) router.replace('/dashboard');
  };
  return (
    <Modal open={open} onClose={onClose} title="Workspace settings" size="sm">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name" htmlFor="ws-edit-name">
          <Input id="ws-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="ws-edit-desc">
          <Textarea id="ws-edit-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-2">
          {workspace.role === 'owner' ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={remove}>Delete workspace</Button>
          ) : <span />}
          <Button type="submit" disabled={!name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export function WorkspaceView({ params }) {
  const { workspaceId } = use(params);
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const workspace = useSelector((s) => workspaceSelectors.selectById(s, workspaceId));
  const current = useSelector((s) => s.workspaces.current);
  const boards = useSelector(currentBoardsSelectors.selectAll);
  const [modal, setModal] = useState(null);

  useWorkspaceRealtime(workspaceId);
  useEffect(() => {
    dispatch(fetchWorkspace(workspaceId));
  }, [dispatch, workspaceId]);

  const isCurrent = current.id === workspaceId;
  if (isCurrent && current.status === 'failed') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState title="Workspace not found" body={current.error} action={<Link href="/dashboard" className="text-sm font-medium text-brand-600">Back to dashboard</Link>} />
      </div>
    );
  }
  if (isCurrent && current.status === 'gone') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState title="You no longer have access to this workspace" action={<Link href="/dashboard" className="text-sm font-medium text-brand-600">Back to dashboard</Link>} />
      </div>
    );
  }
  if (!workspace || !isCurrent || current.status !== 'ready') {
    return <PageLoader label="Loading workspace" />;
  }

  const canManage = ['owner', 'admin'].includes(workspace.role);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <nav className="text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link> <span className="mx-1">/</span>
        <span className="text-slate-900">{workspace.name}</span>
      </nav>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{workspace.name}</h1>
          {workspace.description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{workspace.description}</p>}
        </div>
        <div className="flex gap-2">
          {canManage && <Button variant="secondary" onClick={() => setModal('settings')}>Settings</Button>}
          <Button onClick={() => setModal('board')}>New board</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Boards</h2>
          {boards.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {boards.map((b) => <BoardCard key={b._id} board={b} />)}
            </div>
          ) : (
            <EmptyState title="No boards yet" body="Boards hold your columns and tasks." action={<Button onClick={() => setModal('board')}>Create a board</Button>} />
          )}
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent activity</h2>
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <ActivityFeed items={current.activity} />
          </div>
        </section>
        <aside className="space-y-4">
          <InviteCard workspace={workspace} />
          <Members workspace={workspace} me={me} />
        </aside>
      </div>

      <CreateBoardModal open={modal === 'board'} onClose={() => setModal(null)} workspaceId={workspaceId} />
      {modal === 'settings' && <SettingsModal open onClose={() => setModal(null)} workspace={workspace} />}
    </div>
  );
}

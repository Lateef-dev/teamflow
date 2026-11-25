'use client';

import Link from 'next/link';
import { isPast, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyTasks, fetchWorkspaces, workspaceSelectors } from '@/store/workspacesSlice';
import { AvatarStack } from '@/components/Avatar';
import { CreateWorkspaceModal, JoinWorkspaceModal } from '@/components/WorkspaceForms';
import { Badge, Button, EmptyState, PageLoader } from '@/components/ui';
import { priorityMeta } from '@/lib/constants';

function WorkspaceCard({ workspace }) {
  return (
    <Link
      href={`/w/${workspace._id}`}
      className="group flex flex-col rounded-xl bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-lg font-semibold text-brand-700">
          {workspace.name[0]?.toUpperCase()}
        </span>
        <Badge className="bg-slate-100 capitalize text-slate-600">{workspace.role}</Badge>
      </div>
      <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-brand-700">{workspace.name}</h3>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{workspace.description || 'No description'}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          {workspace.boardCount} {workspace.boardCount === 1 ? 'board' : 'boards'} · {workspace.taskCount} tasks
        </span>
        <AvatarStack users={workspace.members.map((m) => m.user)} size="xs" />
      </div>
    </Link>
  );
}

function MyTasks() {
  const tasks = useSelector((s) => s.workspaces.myTasks);
  if (!tasks.length) return <p className="text-sm text-slate-500">Nothing assigned to you yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.slice(0, 8).map((t) => {
        const p = priorityMeta(t.priority);
        const overdue = t.dueDate && isPast(new Date(t.dueDate)) && t.columnTitle !== 'Done';
        return (
          <li key={t._id}>
            <Link href={`/b/${t.board._id}?task=${t._id}`} className="block rounded-lg px-2 py-2.5 hover:bg-slate-50">
              <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{t.board.name}</span>
                <span>·</span>
                <span>{t.columnTitle}</span>
                <Badge className={p.className}>{p.label}</Badge>
                {t.dueDate && (
                  <span className={overdue ? 'font-medium text-rose-600' : ''}>Due {format(new Date(t.dueDate), 'MMM d')}</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Dashboard() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const workspaces = useSelector(workspaceSelectors.selectAll);
  const status = useSelector((s) => s.workspaces.status);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    dispatch(fetchWorkspaces());
    dispatch(fetchMyTasks());
  }, [dispatch]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hi {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">Here are your workspaces and the work assigned to you.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModal('join')}>Join with code</Button>
          <Button onClick={() => setModal('create')}>New workspace</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Workspaces</h2>
          {status === 'loading' && !workspaces.length ? (
            <PageLoader label="Loading workspaces" />
          ) : workspaces.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {workspaces.map((w) => (
                <WorkspaceCard key={w._id} workspace={w} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No workspaces yet"
              body="Create a workspace for your team, or join one with an invite code."
              action={<Button onClick={() => setModal('create')}>Create your first workspace</Button>}
            />
          )}
        </section>
        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned to me</h2>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <MyTasks />
          </div>
        </aside>
      </div>

      <CreateWorkspaceModal open={modal === 'create'} onClose={() => setModal(null)} />
      <JoinWorkspaceModal open={modal === 'join'} onClose={() => setModal(null)} />
    </div>
  );
}

'use client';

import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { resetFilters, selectFiltersActive, setFilter } from '@/store/boardSlice';
import { PRIORITIES, isPriority } from '@/lib/constants';
import { Avatar } from '../Avatar';
import { cx } from '../ui';

export function Presence() {
  const users = useAppSelector((s) => s.board.presence);
  const connection = useAppSelector((s) => s.board.connection);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
          connection === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}
        role="status"
      >
        <span className={cx('h-1.5 w-1.5 rounded-full', connection === 'online' ? 'bg-emerald-500' : 'animate-pulse bg-amber-500')} />
        {connection === 'online' ? 'Live' : 'Reconnecting…'}
      </span>
      <div className="flex -space-x-2" aria-label={`${users.length} people on this board`}>
        {users.slice(0, 5).map((u) => (
          <Avatar key={u._id} user={u} size="sm" ring title={`${u.name} is here`} />
        ))}
        {users.length > 5 && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs ring-2 ring-white">+{users.length - 5}</span>
        )}
      </div>
    </div>
  );
}

export function Filters() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.board.filters);
  const members = useAppSelector((s) => s.board.workspace?.members ?? []);
  const active = useAppSelector(selectFiltersActive);
  const selectClass = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <svg className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
        </svg>
        <input
          value={filters.query}
          onChange={(e) => dispatch(setFilter({ query: e.target.value }))}
          placeholder="Search tasks"
          aria-label="Search tasks"
          className="h-8 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <select aria-label="Filter by assignee" value={filters.assignee} onChange={(e) => dispatch(setFilter({ assignee: e.target.value }))} className={selectClass}>
        <option value="all">Everyone</option>
        <option value="me">Assigned to me</option>
        <option value="none">Unassigned</option>
        {members.map(({ user }) => (
          <option key={user._id} value={user._id}>{user.name}</option>
        ))}
      </select>
      <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => dispatch(setFilter({ priority: isPriority(e.target.value) ? e.target.value : 'all' }))} className={selectClass}>
        <option value="all">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {active && (
        <button onClick={() => dispatch(resetFilters())} className="text-sm text-slate-500 hover:text-slate-800">Clear</button>
      )}
    </div>
  );
}

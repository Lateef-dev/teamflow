'use client';

import { Draggable } from '@hello-pangea/dnd';
import { differenceInCalendarDays, format } from 'date-fns';
import { memo, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/store';
import type { ID, PublicUser, Task } from '@shared/types';
import { priorityMeta } from '@/lib/constants';
import { Avatar, AvatarStack } from '../Avatar';
import { Badge, cx } from '../ui';

function DueDate({ date, done }: { date: string | null; done: boolean }) {
  if (!date) return null;
  const days = differenceInCalendarDays(new Date(date), new Date());
  const tone = done ? 'text-slate-400' : days < 0 ? 'text-rose-600 font-medium' : days <= 2 ? 'text-amber-600' : 'text-slate-500';
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs', tone)} title={format(new Date(date), 'PPP')}>
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
      </svg>
      {format(new Date(date), 'MMM d')}
    </span>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function LiveViewers({ focus }: { focus: { user: PublicUser; at: number }[] }) {
  const now = useNow(5000);
  const live = focus.filter((f) => now - f.at < 15000);
  if (!live.length) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex" title={`${live.map((f) => f.user.name).join(', ')} viewing`}>
      {live.slice(0, 2).map((f) => (
        <Avatar key={f.user._id} user={f.user} size="xs" ring className="animate-pulse" />
      ))}
    </span>
  );
}

/** Who else has this card open right now (from task:focus pings, expires after 15s). */
function Viewers({ taskId }: { taskId: ID }) {
  const focus = useAppSelector((s) => s.board.focus[taskId]);
  return focus?.length ? <LiveViewers focus={focus} /> : null;
}

interface TaskCardProps {
  task: Task;
  index: number;
  onOpen: (taskId: ID) => void;
  isDone: boolean;
}

export const TaskCard = memo(function TaskCard({ task, index, onOpen, isDone }: TaskCardProps) {
  const p = priorityMeta(task.priority);
  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(task._id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpen(task._id);
          }}
          aria-label={`${task.title}. Press space to drag, enter to open.`}
          className={cx(
            'group relative mb-2 cursor-pointer rounded-lg bg-white p-3 text-left ring-1 ring-slate-200 transition-shadow hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            snapshot.isDragging && 'rotate-1 shadow-xl ring-brand-300',
          )}
        >
          <Viewers taskId={task._id} />
          {task.labels.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {task.labels.map((l) => (
                <Badge key={l} className="bg-brand-50 text-brand-700">{l}</Badge>
              ))}
            </div>
          )}
          <p className={cx('text-sm font-medium leading-snug text-slate-800', isDone && 'text-slate-500 line-through decoration-slate-300')}>
            {task.title}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Badge className={p.className}>{p.label}</Badge>
              <DueDate date={task.dueDate} done={isDone} />
              {task.commentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={`${task.commentCount} comments`}>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 2c-4.418 0-8 2.91-8 6.5 0 1.75.856 3.34 2.25 4.508-.13.92-.555 1.91-1.32 2.79a.75.75 0 0 0 .578 1.232c1.692-.06 3.06-.6 4.07-1.244.78.14 1.59.214 2.422.214 4.418 0 8-2.91 8-6.5S14.418 2 10 2Z" clipRule="evenodd" />
                  </svg>
                  {task.commentCount}
                </span>
              )}
            </div>
            <AvatarStack users={task.assignees} max={3} size="xs" />
          </div>
        </div>
      )}
    </Draggable>
  );
});

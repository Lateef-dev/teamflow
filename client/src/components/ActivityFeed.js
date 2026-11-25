import { Avatar } from './Avatar';
import { TimeAgo } from './TimeAgo';

export function ActivityFeed({ items, empty = 'No activity yet.' }) {
  if (!items?.length) return <p className="px-1 py-4 text-sm text-slate-500">{empty}</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a._id} className="flex gap-3">
          <Avatar user={a.actor} size="xs" className="mt-0.5" />
          <div className="min-w-0 text-sm">
            <p className="text-slate-700">{a.message}</p>
            <TimeAgo date={a.createdAt} className="text-xs text-slate-400" />
          </div>
        </li>
      ))}
    </ol>
  );
}

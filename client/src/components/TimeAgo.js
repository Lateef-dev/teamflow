'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useState } from 'react';

/** Relative time that re-renders every minute. Rendered client-side only to avoid hydration drift. */
export function TimeAgo({ date, className }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  if (!date) return null;
  return (
    <time dateTime={new Date(date).toISOString()} className={className} suppressHydrationWarning>
      {formatDistanceToNowStrict(new Date(date), { addSuffix: true })}
    </time>
  );
}

import type { PublicUser } from '@shared/types';
import { cx } from './ui';

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

const sizes = { xs: 'h-5 w-5 text-[10px]', sm: 'h-7 w-7 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' } as const;
type Size = keyof typeof sizes;

interface AvatarProps {
  user: Pick<PublicUser, 'name' | 'avatarColor'> | null | undefined;
  size?: Size;
  ring?: boolean;
  className?: string;
  title?: string;
}

export function Avatar({ user, size = 'md', ring, className, title }: AvatarProps) {
  return (
    <span
      title={title ?? user?.name}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ backgroundColor: user?.avatarColor ?? '#94a3b8' }}
    >
      {initials(user?.name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }: { users?: PublicUser[]; max?: number; size?: Size }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u) => (
        <Avatar key={u._id} user={u} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600 ring-2 ring-white">
          +{rest}
        </span>
      )}
    </div>
  );
}

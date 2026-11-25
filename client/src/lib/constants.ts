import type { Priority } from '@shared/types';

export interface PriorityMeta {
  value: Priority;
  label: string;
  className: string;
}

export const PRIORITIES: readonly PriorityMeta[] = [
  { value: 'low', label: 'Low', className: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', className: 'bg-sky-100 text-sky-700' },
  { value: 'high', label: 'High', className: 'bg-amber-100 text-amber-800' },
  { value: 'urgent', label: 'Urgent', className: 'bg-rose-100 text-rose-700' },
];

const MEDIUM = PRIORITIES[1] as PriorityMeta;
export const priorityMeta = (value: Priority): PriorityMeta => PRIORITIES.find((p) => p.value === value) ?? MEDIUM;

export const isPriority = (value: string): value is Priority => PRIORITIES.some((p) => p.value === value);

export const COLUMN_COLORS = ['#94a3b8', '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#8b5cf6'] as const;

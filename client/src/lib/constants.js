export const PRIORITIES = [
  { value: 'low', label: 'Low', className: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', className: 'bg-sky-100 text-sky-700' },
  { value: 'high', label: 'High', className: 'bg-amber-100 text-amber-800' },
  { value: 'urgent', label: 'Urgent', className: 'bg-rose-100 text-rose-700' },
];

export const priorityMeta = (value) => PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];

export const COLUMN_COLORS = ['#94a3b8', '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#8b5cf6'];

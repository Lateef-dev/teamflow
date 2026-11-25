// Mirrors server/src/lib/ordering.ts so drag and drop can update instantly.
export const ORDER_GAP = 1024;

export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before == null && after == null) return ORDER_GAP;
  if (before == null) return (after as number) - ORDER_GAP;
  if (after == null) return before + ORDER_GAP;
  return (before + after) / 2;
}

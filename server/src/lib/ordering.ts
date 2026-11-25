/**
 * Fractional ordering: each task stores a float `order`. Moving a task only
 * rewrites that one document, which keeps drag and drop cheap and avoids
 * race conditions between people reordering the same column.
 */
export const ORDER_GAP = 1024;

export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before == null && after == null) return ORDER_GAP;
  if (before == null) return (after as number) - ORDER_GAP;
  if (after == null) return before + ORDER_GAP;
  return (before + after) / 2;
}

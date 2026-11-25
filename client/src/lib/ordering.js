// Mirrors server/src/lib/ordering.js so drag and drop can update instantly.
export const ORDER_GAP = 1024;

export function orderBetween(before, after) {
  if (before == null && after == null) return ORDER_GAP;
  if (before == null) return after - ORDER_GAP;
  if (after == null) return before + ORDER_GAP;
  return (before + after) / 2;
}

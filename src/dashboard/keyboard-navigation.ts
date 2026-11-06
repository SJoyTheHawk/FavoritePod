export interface NavigationItem {
  left: number;
  top: number;
  width: number;
}

/** Follow visual rows so arrows work across responsive grids and grouped lists. */
export function getNavigationTarget(
  items: readonly NavigationItem[],
  currentIndex: number,
  key: string,
): number | undefined {
  const current = items[currentIndex];
  if (!current) return undefined;
  if (key === 'Home') return 0;
  if (key === 'End') return items.length - 1;
  if (key === 'ArrowLeft') return currentIndex > 0 ? currentIndex - 1 : undefined;
  if (key === 'ArrowRight')
    return currentIndex < items.length - 1 ? currentIndex + 1 : undefined;
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return undefined;

  const direction = key === 'ArrowUp' ? -1 : 1;
  const candidates = items
    .map((item, index) => ({
      index,
      rowDistance: direction * (item.top - current.top),
      columnDistance: Math.abs(
        item.left + item.width / 2 - (current.left + current.width / 2),
      ),
    }))
    .filter((candidate) => candidate.rowDistance > 1);
  const nearestRow = Math.min(...candidates.map((candidate) => candidate.rowDistance));
  return candidates
    .filter((candidate) => candidate.rowDistance <= nearestRow + 1)
    .sort((left, right) => left.columnDistance - right.columnDistance)[0]?.index;
}

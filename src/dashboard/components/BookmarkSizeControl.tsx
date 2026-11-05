import type { BookmarkSize, LibraryView } from '../../core/storage';

const sizes: Record<LibraryView, BookmarkSize[]> = {
  grid: ['compact', 'extra-small', 'medium', 'large'],
  list: ['compact', 'small', 'medium', 'large'],
};
const labels = {
  compact: 'Compact',
  'extra-small': 'Extra small',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

function SizeIcon({ view, size }: { view: LibraryView; size: BookmarkSize }) {
  if (size === 'compact')
    return (
      <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 28 28" fill="currentColor">
        {Array.from({ length: view === 'grid' ? 6 : 4 }, (_, i) => {
          const x = view === 'grid' ? 2 + (i % 2) * 14 : 2;
          const y = view === 'grid' ? 2 + Math.floor(i / 2) * 8 : 3 + i * 6;
          return (
            <g key={i}>
              <rect x={view === 'grid' ? x + 4 : x} y={y} width={3} height={3} rx={0.5} />
              <rect
                x={view === 'grid' ? x + 1 : x + 5}
                y={view === 'grid' ? y + 4 : y + 1}
                width={view === 'grid' ? 10 : 19}
                height={1.5}
                rx={0.5}
              />
            </g>
          );
        })}
      </svg>
    );
  const count =
    size === 'extra-small' ? 4 : size === 'small' ? 3 : size === 'medium' ? 2 : 1;
  const gap = 3;
  const side = (24 - gap * (count - 1)) / count;
  const rowHeight = (18 - gap * (count - 1)) / count;

  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 28 28" fill="currentColor">
      {Array.from({ length: view === 'grid' ? count * count : count }, (_, i) => (
        <rect
          key={i}
          x={view === 'grid' ? 2 + (i % count) * (side + gap) : 2}
          y={
            view === 'grid'
              ? 2 + Math.floor(i / count) * (side + gap)
              : 5 + i * (rowHeight + gap)
          }
          width={view === 'grid' ? side : 24}
          height={view === 'grid' ? side : rowHeight}
          rx={1.5}
        />
      ))}
    </svg>
  );
}

export function BookmarkSizeControl({
  view,
  size,
  disabled,
  onChange,
}: {
  view: LibraryView;
  size: BookmarkSize;
  disabled: boolean;
  onChange: (size: BookmarkSize) => void;
}) {
  return (
    <div
      aria-label={`${view === 'grid' ? 'Grid card' : 'List row'} size`}
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-border p-1"
      role="group"
    >
      {sizes[view].map((option) => {
        const label = `${labels[option]} ${view === 'grid' ? 'cards' : 'rows'}${option === 'compact' ? ' — no thumbnails' : ''}`;
        return (
          <button
            key={option}
            aria-label={label}
            aria-pressed={size === option}
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors disabled:opacity-40 ${size === option ? 'bg-surface-hover text-text-primary' : 'text-text-tertiary hover:bg-surface-hover hover:text-text-primary'}`}
            disabled={disabled}
            onClick={() => onChange(option)}
            title={label}
            type="button"
          >
            <SizeIcon view={view} size={option} />
          </button>
        );
      })}
    </div>
  );
}

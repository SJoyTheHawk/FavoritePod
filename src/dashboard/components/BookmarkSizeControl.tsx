import type { BookmarkSize, LibraryView } from '../../core/storage';

const sizes: BookmarkSize[] = ['small', 'medium', 'large'];
const labels = { small: 'Small', medium: 'Medium', large: 'Large' };

function SizeIcon({ view, size }: { view: LibraryView; size: BookmarkSize }) {
  const count = size === 'small' ? 3 : size === 'medium' ? 2 : 1;
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
      {sizes.map((option) => {
        const label = `${labels[option]} ${view === 'grid' ? 'cards' : 'rows'}`;
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

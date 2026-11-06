interface ProgressBarProps {
  label: string;
  current?: number;
  total?: number;
}

export function ProgressBar({ label, current, total }: ProgressBarProps) {
  const determinate =
    typeof total === 'number' &&
    Number.isFinite(total) &&
    total > 0 &&
    typeof current === 'number' &&
    Number.isFinite(current);
  const value = determinate ? Math.max(0, Math.min(total, current)) : undefined;

  return (
    <div
      aria-label={label}
      aria-valuemax={determinate ? total : undefined}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuenow={value}
      className="h-1.5 overflow-hidden rounded-full bg-border"
      role="progressbar"
    >
      <div
        aria-hidden="true"
        className={`h-full rounded-full bg-primary transition-[width] duration-200 ${determinate ? '' : 'progress-indeterminate w-1/3'}`}
        style={determinate ? { width: `${(100 * value!) / total}%` } : undefined}
      />
    </div>
  );
}

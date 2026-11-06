import { useState, type ReactNode } from 'react';

interface ThumbnailImageProps {
  src?: string;
  alt?: string;
  loading?: boolean;
  fallback: ReactNode;
}

/** Show a stable placeholder through storage reads and image decoding. */
export function ThumbnailImage({
  src,
  alt = '',
  loading = false,
  fallback,
}: ThumbnailImageProps) {
  const [settled, setSettled] = useState<{ src: string; failed: boolean }>();
  const failed = !!src && settled?.src === src && settled.failed;
  const pending = loading || (!!src && settled?.src !== src);

  return (
    <div className="relative h-full w-full" aria-busy={pending || undefined}>
      {pending && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-surface-hover"
          data-thumbnail-loading
        />
      )}
      {src && !failed ? (
        <img
          alt={alt}
          className={`h-full w-full object-cover transition-opacity duration-200 ${pending ? 'opacity-0' : 'opacity-100'}`}
          decoding="async"
          draggable={false}
          key={src}
          loading="lazy"
          onError={() => setSettled({ src, failed: true })}
          onLoad={() => setSettled({ src, failed: false })}
          src={src}
        />
      ) : !pending ? (
        fallback
      ) : null}
    </div>
  );
}

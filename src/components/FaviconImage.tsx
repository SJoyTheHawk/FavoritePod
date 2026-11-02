import { faviconSources } from '../core/favicon';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface FaviconImageProps {
  url: string;
  faviconUrl?: string;
  fallback: ReactNode;
  className?: string;
}

export function FaviconImage({
  url,
  faviconUrl,
  fallback,
  className = 'h-4 w-4',
}: FaviconImageProps) {
  const sources = useMemo(() => faviconSources(url, faviconUrl), [faviconUrl, url]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [sources]);

  if (!sources[sourceIndex]) return fallback;

  return (
    <img
      alt=""
      className={`${className} shrink-0 object-contain`}
      onError={() => setSourceIndex((index) => index + 1)}
      src={sources[sourceIndex]}
      referrerPolicy="no-referrer"
    />
  );
}

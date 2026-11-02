import { DocumentIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { FaviconImage } from '../../components/FaviconImage';
import type { Item } from '../../core/types';
import { getUrlLabel, parseSafeUrl } from '../../core/validation';

export function FavoriteFallback({ item }: { item: Item }) {
  const hue = [...item.url].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 360,
    0,
  );
  const isLocalFile = parseSafeUrl(item.url)?.protocol === 'file:';

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 58% 46%), hsl(${(hue + 34) % 360} 62% 32%))`,
      }}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 shadow-inner">
        <FaviconImage
          className="h-12 w-12"
          faviconUrl={item.faviconUrl}
          fallback={
            isLocalFile ? (
              <DocumentIcon aria-hidden="true" className="h-8 w-8" />
            ) : (
              <GlobeAltIcon aria-hidden="true" className="h-8 w-8" />
            )
          }
          url={item.url}
        />
      </span>
      <span className="line-clamp-2 max-w-full text-sm font-semibold leading-5">
        {item.title}
      </span>
      <span className="max-w-full truncate rounded-full bg-black/20 px-2.5 py-1 text-[11px]">
        {getUrlLabel(item.url)}
      </span>
    </div>
  );
}

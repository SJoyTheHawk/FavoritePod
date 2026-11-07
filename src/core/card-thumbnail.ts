import { db } from './db';
import { createSmallThumbnail } from './thumbnail';

/** Backfill imported/synced previews lazily; the original image remains immutable. */
export async function getCardThumbnailBlob(
  hash: string,
  isNeeded: () => boolean = () => true,
): Promise<Blob | undefined> {
  const thumbnail = await db.thumbnails.get(hash);
  if (!thumbnail || !isNeeded()) return undefined;
  if (thumbnail.smallBlob) return thumbnail.smallBlob;
  const smallBlob = await createSmallThumbnail(thumbnail.blob);
  if (!isNeeded()) return undefined;
  // Decode outside an IndexedDB transaction. update() avoids resurrecting an
  // original removed by a concurrent archive replacement.
  try {
    await db.thumbnails.update(hash, { smallBlob });
  } catch {
    // A derived cache write (for example quota exhaustion) must not hide an
    // otherwise valid card image. Its URL still has a bounded lifetime.
  }
  return smallBlob;
}

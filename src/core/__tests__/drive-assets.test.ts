import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  compactOrphanDriveAssets,
  downloadMissingDriveAssets,
  getDriveAssetFileName,
  listDriveAssets,
  uploadMissingDriveAssets,
} from '../drive-assets';
import { hashBlob } from '../thumbnail';
import type { Thumbnail } from '../types';

const identity = {
  getAuthToken: vi.fn().mockResolvedValue({ token: 'drive-test-token' }),
  removeCachedAuthToken: vi.fn().mockResolvedValue(undefined),
};

function remoteFile(
  hash: string,
  fileId: string,
  modifiedTime = '2026-01-01T00:00:00.000Z',
) {
  return {
    id: fileId,
    name: getDriveAssetFileName(hash),
    mimeType: 'image/jpeg',
    modifiedTime,
    size: '12',
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

function listResponse(files: unknown[], nextPageToken?: string): Response {
  return jsonResponse({ files, ...(nextPageToken ? { nextPageToken } : {}) });
}

function thumbnail(hash: string, blob: Blob): Thumbnail {
  return {
    hash,
    blob,
    size: blob.size,
    width: 640,
    height: 400,
    createdAt: 1,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.syncMeta.put({
    key: 'drive.account',
    value: { emailAddress: 'test@example.com', permissionId: 'test-user' },
  });
  identity.getAuthToken.mockReset().mockResolvedValue({ token: 'drive-test-token' });
  identity.removeCachedAuthToken.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', { identity });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockImplementation(async () => ({
      width: 640,
      height: 400,
      close: vi.fn(),
    })),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Google Drive preview assets', () => {
  it('preserves authorization failures while listing preview assets', async () => {
    identity.getAuthToken.mockRejectedValue(new Error('OAuth2 not granted or revoked.'));
    await expect(listDriveAssets()).rejects.toMatchObject({
      code: 'authorization-required',
      retryable: false,
    });
    expect((await db.syncMeta.get('drive.authorizationRequired'))?.value).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves genuine network errors without setting recovery state', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listDriveAssets()).rejects.toMatchObject({
      code: 'network-error',
      retryable: true,
    });
    expect(await db.syncMeta.get('drive.authorizationRequired')).toBeUndefined();
  });

  it('lists paginated JPEG assets and ignores unrelated files', async () => {
    const firstHash = 'a'.repeat(64);
    const secondHash = 'b'.repeat(64);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        listResponse(
          [
            remoteFile(firstHash, 'asset-a'),
            { id: 'other', name: 'asset-not-a-hash.jpg', mimeType: 'image/jpeg' },
            {
              id: 'state',
              name: 'launcher-state-device-a.json',
              mimeType: 'application/json',
            },
          ],
          'next-page',
        ),
      )
      .mockResolvedValueOnce(listResponse([remoteFile(secondHash, 'asset-b')]));

    const files = await listDriveAssets();

    expect(files.map((file) => file.hash)).toEqual([firstHash, secondHash]);
    expect(await db.driveAssets.get(firstHash)).toMatchObject({ fileId: 'asset-a' });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('spaces=appDataFolder');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      'name+contains+%27asset-%27',
    );
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('pageToken=next-page');
  });

  it('skips hashes already present remotely and deduplicates the requested hashes', async () => {
    const hash = 'a'.repeat(64);
    vi.mocked(fetch).mockResolvedValue(listResponse([remoteFile(hash, 'asset-a')]));

    const result = await uploadMissingDriveAssets([hash, hash]);

    expect(result).toEqual({
      uploadedHashes: [],
      existingHashes: [hash],
      missingLocalHashes: [],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uploads a verified JPEG once with the hash-derived appDataFolder name', async () => {
    const blob = new Blob(['jpeg-preview-bytes'], { type: 'image/jpeg' });
    const hash = await hashBlob(blob);
    await db.thumbnails.put(thumbnail(hash, blob));
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(jsonResponse(remoteFile(hash, 'uploaded-asset')));
    const progress: number[] = [];

    const result = await uploadMissingDriveAssets([hash], (entry) => {
      if (entry.stage === 'uploading') progress.push(entry.current);
    });

    expect(result.uploadedHashes).toEqual([hash]);
    expect(result.existingHashes).toEqual([]);
    expect(progress).toEqual([0, 1]);
    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(url)).toContain('/upload/drive/v3/files?uploadType=multipart');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(Blob);
    const multipart = await (init?.body as Blob).text();
    expect(multipart).toContain(`"name":"${getDriveAssetFileName(hash)}"`);
    expect(multipart).toContain('"parents":["appDataFolder"]');
    expect(multipart).toContain('jpeg-preview-bytes');
    expect((init?.body as Blob).type).toContain('multipart/related');
    const boundary = (init?.body as Blob).type.match(/boundary=([^;]+)/)?.[1];
    expect(boundary).toBeTruthy();
    expect(multipart.startsWith(`--${boundary}\r\n`)).toBe(true);
    expect(multipart.endsWith(`\r\n--${boundary}--`)).toBe(true);
    expect(await db.driveAssets.get(hash)).toMatchObject({ fileId: 'uploaded-asset' });
  });

  it('includes Google error details for a rejected asset upload', async () => {
    const blob = new Blob(['jpeg-preview-bytes'], { type: 'image/jpeg' });
    const hash = await hashBlob(blob);
    await db.thumbnails.put(thumbnail(hash, blob));
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'Invalid multipart request' } }, 400),
      );

    await expect(uploadMissingDriveAssets([hash])).rejects.toThrow(
      'Could not upload preview (Google Drive HTTP 400): Invalid multipart request.',
    );
  });

  it('reports a missing local preview without failing the other asset uploads', async () => {
    const missingHash = 'c'.repeat(64);
    const localBlob = new Blob(['local-preview'], { type: 'image/jpeg' });
    const localHash = await hashBlob(localBlob);
    await db.thumbnails.put(thumbnail(localHash, localBlob));
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(jsonResponse(remoteFile(localHash, 'uploaded-asset')));

    const result = await uploadMissingDriveAssets([missingHash, localHash]);

    expect(result.uploadedHashes).toEqual([localHash]);
    expect(result.missingLocalHashes).toEqual([missingHash]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports a clear Drive storage quota error', async () => {
    const blob = new Blob(['jpeg-preview-bytes'], { type: 'image/jpeg' });
    const hash = await hashBlob(blob);
    await db.thumbnails.put(thumbnail(hash, blob));
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, 403),
      );

    await expect(uploadMissingDriveAssets([hash])).rejects.toThrow(
      'Google Drive storage is full. Free up space or disconnect sync.',
    );
  });

  it('downloads a missing preview and validates its content hash', async () => {
    const blob = new Blob(['remote-jpeg-bytes'], { type: 'image/jpeg' });
    const hash = await hashBlob(blob);
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([remoteFile(hash, 'remote-asset')]))
      .mockResolvedValueOnce(
        new Response(await blob.arrayBuffer(), {
          headers: { 'Content-Length': String(blob.size) },
        }),
      );
    const progress: number[] = [];

    const result = await downloadMissingDriveAssets([hash], (entry) => {
      if (entry.stage === 'downloading') progress.push(entry.current);
    });

    expect(result).toEqual({
      downloadedHashes: [hash],
      existingHashes: [],
      missingRemoteHashes: [],
    });
    expect(progress).toEqual([0, 1]);
    expect(await db.thumbnails.get(hash)).toMatchObject({
      hash,
      size: blob.size,
      width: 640,
      height: 400,
    });
    expect(await db.driveAssets.get(hash)).toMatchObject({ fileId: 'remote-asset' });
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain(
      '/files/remote-asset?alt=media',
    );
  });

  it('does not download a preview that already exists locally', async () => {
    const blob = new Blob(['local-jpeg-bytes'], { type: 'image/jpeg' });
    const hash = await hashBlob(blob);
    await db.thumbnails.put(thumbnail(hash, blob));
    vi.mocked(fetch).mockResolvedValueOnce(
      listResponse([remoteFile(hash, 'remote-asset')]),
    );

    const result = await downloadMissingDriveAssets([hash]);

    expect(result.existingHashes).toEqual([hash]);
    expect(result.downloadedHashes).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects downloaded bytes whose hash does not match the asset filename', async () => {
    const expectedHash = await hashBlob(new Blob(['expected']));
    const different = new Blob(['different']);
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([remoteFile(expectedHash, 'bad-asset')]))
      .mockResolvedValueOnce(new Response(await different.arrayBuffer()));

    await expect(downloadMissingDriveAssets([expectedHash])).rejects.toThrow(
      'failed its integrity check',
    );
    expect(await db.thumbnails.get(expectedHash)).toBeUndefined();
  });

  it('deletes only unreferenced previews older than 90 days', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const oldHash = 'a'.repeat(64);
    const referencedHash = 'b'.repeat(64);
    const recentHash = 'c'.repeat(64);
    const oldFile = remoteFile(oldHash, 'old-file', '2025-01-01T00:00:00.000Z');
    const referencedFile = remoteFile(
      referencedHash,
      'referenced-file',
      '2025-01-01T00:00:00.000Z',
    );
    const recentFile = remoteFile(recentHash, 'recent-file', '2026-05-30T00:00:00.000Z');
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([oldFile, referencedFile, recentFile]))
      .mockResolvedValueOnce(listResponse([oldFile, referencedFile, recentFile]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const progress: number[] = [];

    const result = await compactOrphanDriveAssets([referencedHash], now, (entry) => {
      if (entry.stage === 'cleaning') progress.push(entry.current);
    });

    expect(result).toEqual({ deletedHashes: [oldHash], retainedHashes: [] });
    expect(progress).toEqual([0, 1]);
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain('/files/old-file');
    expect(vi.mocked(fetch).mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(await db.driveAssets.get(oldHash)).toBeUndefined();
  });

  it('keeps an orphan if it changes or becomes recent before deletion', async () => {
    const hash = 'd'.repeat(64);
    const original = remoteFile(hash, 'changing-file', '2025-01-01T00:00:00.000Z');
    const updated = remoteFile(hash, 'changing-file', '2026-05-31T00:00:00.000Z');
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([original]))
      .mockResolvedValueOnce(listResponse([updated]));

    const result = await compactOrphanDriveAssets(
      [],
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(result).toEqual({ deletedHashes: [], retainedHashes: [hash] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

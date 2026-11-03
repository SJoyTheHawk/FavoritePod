import { z } from 'zod';
import type { Thumbnail } from './types';

const ClockSchema = z.string().min(1).max(128);

const GroupSchema = z
  .object({
    id: z.string().min(1).max(128),
    parentId: z.string().min(1).max(128).nullable(),
    orderKey: z.string().min(1).max(128),
    title: z.string().min(1).max(1000),
    clock: z
      .object({
        parentId: ClockSchema,
        orderKey: ClockSchema,
        title: ClockSchema,
      })
      .strict(),
    deleted: ClockSchema.optional(),
  })
  .strict();

const ItemSchema = z
  .object({
    id: z.string().min(1).max(128),
    groupId: z.string().min(1).max(128),
    orderKey: z.string().min(1).max(128),
    url: z.string().min(1).max(65_536),
    title: z.string().min(1).max(1000),
    previewHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    faviconUrl: z.string().max(32_768).optional(),
    clock: z
      .object({
        groupId: ClockSchema,
        orderKey: ClockSchema,
        url: ClockSchema,
        title: ClockSchema,
        previewHash: ClockSchema,
        faviconUrl: ClockSchema,
      })
      .strict(),
    deleted: ClockSchema.optional(),
  })
  .strict();

export const CURRENT_EXPORT_VERSION = 1;
export const SUPPORTED_IMPORT_VERSIONS = [1] as const;
export const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;
export const MAX_MANIFEST_SIZE = 20 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_RECORDS = 10_000;

export const ExportBaseSchema = z.object({
  format: z.literal('visual-launcher'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().datetime(),
});

export const ExportDataV1Schema = z
  .object({
    format: z.literal('visual-launcher'),
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    exportedBy: z.string().min(1).max(128),
    groups: z.array(GroupSchema).max(MAX_RECORDS),
    items: z.array(ItemSchema).max(MAX_RECORDS),
  })
  .strict();

export type ExportDataV1 = z.infer<typeof ExportDataV1Schema>;

export interface ArchiveProgress {
  stage: 'validating' | 'writing';
  current: number;
  total: number;
}

export type ImportProgressCallback = (progress: ArchiveProgress) => void;

export interface ImportArchive {
  data: ExportDataV1;
  thumbnails: Map<string, Thumbnail>;
  filename: string;
}

export type ImportMode = 'copy' | 'update' | 'replace';

export interface ImportResult {
  importedGroups: number;
  importedItems: number;
}

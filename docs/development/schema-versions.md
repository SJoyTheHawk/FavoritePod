# FavoritePod Schema Version Guide

## Export Schema Versions

This document tracks changes to the ZIP export format and how to handle imports across versions.

---

## Version 1 (Initial Release)

**Introduced**: v1.0.0  
**Status**: Current

### Structure
```
launcher-export.zip
├── launcher.json
└── previews/
    ├── <sha256-hash>.jpg
    └── <sha256-hash>.jpg
```

### launcher.json Schema
```typescript
interface ExportDataV1 {
  format: 'visual-launcher';
  schemaVersion: 1;
  exportedAt: string;           // ISO 8601 timestamp
  exportedBy?: string;          // Device ID (optional)
  groups: GroupV1[];
  items: ItemV1[];
}

interface GroupV1 {
  id: string;                   // UUID
  parentId: string | null;      // Supports nested groups
  orderKey: string;             // Fractional index
  title: string;
  clock: { parentId: string; orderKey: string; title: string };
  deleted?: string;             // HLC tombstone
}

interface ItemV1 {
  id: string;                   // UUID
  groupId: string;              // Reference to Group.id
  orderKey: string;             // Fractional index
  url: string;                  // http:, https:, or file: only
  title: string;
  previewHash?: string;         // SHA-256 hex string
  faviconUrl?: string;
  clock: {
    groupId: string;
    orderKey: string;
    url: string;
    title: string;
    previewHash: string;
    faviconUrl: string;
  };
  deleted?: string;             // HLC tombstone
}
```

Version 1 preserves the current local `Group` and `Item` records, including
nested groups, field clocks, deletion tombstones, and saved favicons. The older
draft shape with flat groups and `createdAt`/`updatedAt` fields predates the live
data model and is not the Phase 7 export format.

### Validation Rules
- `format` must be exactly `'visual-launcher'`
- `schemaVersion` must be `1`
- All URLs must use `http:`, `https:`, or `file:` schemes
- `faviconUrl`, when present, must be an HTTP(S) URL or a base64 raster image
- `previewHash` files must exist in `previews/` directory
- Maximum archive size: 100 MB
- Maximum items: 10,000
- Maximum groups: 10,000
- Maximum image size: 5 MB each

---

## Future Versions (Planned)

### Version 2 (With Drive Sync)

**Expected**: v2.0.0  
**Changes**:
- Add export metadata that records sync state and source details
- Add sync-specific fields as the Drive contract is finalized

```typescript
interface ExportDataV2 {
  format: 'visual-launcher';
  schemaVersion: 2;
  exportedAt: string;
  exportedBy: string;           // Required in v2
  syncEnabled: boolean;         // Was this from a synced library?
  groups: GroupV2[];
  items: ItemV2[];
}

interface GroupV2 {
  id: string;
  parentId: string | null;
  orderKey: string;             // Fractional index (e.g., "a0V")
  title: string;
  clock: {                      // Preserved from version 1
    parentId: string;           // HLC timestamp
    orderKey: string;
    title: string;
  };
  deleted?: string;             // HLC tombstone
}

// Similar for ItemV2...
```

### Version 3 (With Tags/Custom Fields)

**Expected**: v3.0.0  
**Changes**: TBD
- Possible: Add tags array
- Possible: Add custom metadata fields
- Possible: Add collections/smart groups

---

## Import Version Handling

### Implementation Strategy

The Phase 7 implementation lives in `src/core/archive.ts`, `src/core/export.ts`,
and `src/core/import.ts`. It emits schema version 1 and currently accepts only
version 1. `parseImportFile(file, onProgress)` validates the archive and returns
preview data; `importArchive(archive, mode, onProgress)` applies `copy`, `update`,
or `replace` in an IndexedDB transaction. Replace mode snapshots the current
library before writing. The earlier example below records the original design
sketch; use the implementation API above for current code.

**src/core/import.ts**:
```typescript
import { z } from 'zod';

// Base schema (version detection)
const ExportBaseSchema = z.object({
  format: z.literal('visual-launcher'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
});

// Version-specific schemas
const ExportSchemaV1 = z.object({
  format: z.literal('visual-launcher'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  groups: z.array(z.any()), // Full schema in implementation
  items: z.array(z.any()),
});

const ExportSchemaV2 = z.object({
  // Future: Define when v2 is implemented
  schemaVersion: z.literal(2),
  // ... v2 fields
});

// Version registry
const SUPPORTED_VERSIONS = [1, 2] as const;
const CURRENT_EXPORT_VERSION = 1;

export async function importFromZip(
  file: File,
  mode: ImportMode
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // 1. Read ZIP
    const arrayBuffer = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(arrayBuffer));
    
    // 2. Parse launcher.json
    const launcherJson = unzipped['launcher.json'];
    if (!launcherJson) {
      throw new Error('Missing launcher.json in ZIP');
    }
    
    const jsonStr = strFromU8(launcherJson);
    const rawData = JSON.parse(jsonStr);
    
    // 3. Detect version
    const baseResult = ExportBaseSchema.safeParse(rawData);
    if (!baseResult.success) {
      throw new Error('Invalid export format');
    }
    
    const version = baseResult.data.schemaVersion;
    
    // 4. Check if version is supported
    if (!SUPPORTED_VERSIONS.includes(version as any)) {
      throw new Error(
        `Unsupported schema version ${version}. ` +
        `This version of FavoritePod supports versions: ${SUPPORTED_VERSIONS.join(', ')}. ` +
        `Please update the extension to import this file.`
      );
    }
    
    // 5. Parse with version-specific schema
    let normalizedData: NormalizedImportData;
    
    switch (version) {
      case 1:
        normalizedData = await parseV1(rawData, unzipped);
        break;
      
      case 2:
        // Future: Implement when v2 is released
        normalizedData = await parseV2(rawData, unzipped);
        break;
      
      default:
        throw new Error(`Version ${version} handler not implemented`);
    }
    
    // 6. Import normalized data
    return await importNormalizedData(normalizedData, mode);
    
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Normalized format (all versions convert to this)
interface NormalizedImportData {
  groups: Group[];
  items: Item[];
  thumbnails: Map<string, Blob>;
  metadata: {
    sourceVersion: number;
    exportedAt: string;
    exportedBy?: string;
  };
}

async function parseV1(
  data: any,
  unzipped: Record<string, Uint8Array>
): Promise<NormalizedImportData> {
  // Validate with zod
  const validated = ExportSchemaV1.parse(data);
  
  // Validate URLs
  for (const item of validated.items) {
    if (!isValidUrl(item.url)) {
      throw new Error(`Invalid URL: ${item.url}`);
    }
  }
  
  // Extract thumbnails
  const thumbnails = new Map<string, Blob>();
  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.startsWith('previews/')) {
      const hash = path.replace('previews/', '').replace('.jpg', '');
      
      try {
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        await createImageBitmap(blob); // Validate image
        thumbnails.set(hash, blob);
      } catch {
        console.warn(`Corrupted image: ${path}`);
      }
    }
  }
  
  return {
    groups: validated.groups,
    items: validated.items,
    thumbnails,
    metadata: {
      sourceVersion: 1,
      exportedAt: validated.exportedAt,
      exportedBy: validated.exportedBy,
    }
  };
}

// Future: Implement when v2 is released
async function parseV2(
  data: any,
  unzipped: Record<string, Uint8Array>
): Promise<NormalizedImportData> {
  // Parse v2 format
  // Convert HLC fields to v1 format (or keep if current version supports)
  // Handle nested groups
  // Handle tombstones
  
  throw new Error('V2 import not yet implemented');
}

async function importNormalizedData(
  data: NormalizedImportData,
  mode: ImportMode
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  
  await db.transaction('rw', [db.groups, db.items, db.thumbnails], async () => {
    if (mode === 'replace') {
      await db.groups.clear();
      await db.items.clear();
      // Keep thumbnails (cleanup separately)
    }
    
    // Import groups
    for (const group of data.groups) {
      await db.groups.put(group);
    }
    
    // Import items
    let imported = 0;
    for (const item of data.items) {
      await db.items.put(item);
      imported++;
    }
    
    // Import thumbnails
    for (const [hash, blob] of data.thumbnails.entries()) {
      const img = await createImageBitmap(blob);
      await db.thumbnails.put({
        hash,
        blob,
        size: blob.size,
        width: img.width,
        height: img.height,
        createdAt: Date.now()
      });
    }
    
    return { imported, errors };
  });
  
  return { imported: data.items.length, errors };
}
```

### Version Upgrade Path

Exports use `CURRENT_EXPORT_VERSION` and include `exportedAt`, `exportedBy`, all
selected group and item records, and each referenced preview image. The current
importer accepts version 1 only. When a future format is added, register its
version-specific schema and parser; do not accept a version until its migration
path is implemented and tested.

---

## Migration Testing Checklist

When releasing a new schema version, test:

### Forward Compatibility (Old → New)
- [ ] v1 export imports correctly into v2 extension
- [ ] All data preserved (groups, items, thumbnails)
- [ ] New v2 fields get sensible defaults
- [ ] No data loss

### Backward Compatibility (New → Old)
- [ ] v2 export fails gracefully in v1 extension with clear error message
- [ ] Error message tells user to update extension
- [ ] No corruption of existing v1 data

### Round-trip Testing
- [ ] Export from v1 → Import into v2 → Export from v2 → Import into v1 (should fail with clear message)
- [ ] Export from v2 → Import into v2 → Export again → Compare (should be identical)

---

## Best Practices

### When to Increment Schema Version

**Increment schemaVersion when**:
- Adding required fields
- Changing field types
- Changing validation rules
- Removing fields (deprecated)
- Changing file structure

**Don't increment for**:
- Adding optional fields (use `field?: type` and handle undefined)
- Internal implementation changes that don't affect export format
- Bug fixes that don't change format

### Deprecation Policy

When removing fields:
1. Mark as deprecated in current version (keep in schema as optional)
2. Increment version in next release
3. Remove field entirely
4. Document migration path

### Documentation

For each version change:
1. Update this document (schema-versions.md)
2. Add migration guide in CHANGELOG
3. Update code-guide.md import/export sections
4. Add migration tests

---

## Version History

| Version | Release | Changes |
|---------|---------|---------|
| 1 | v1.0.0 | Current records with nested groups, HLC clocks, and tombstones |
| 2 | v2.0.0 (planned) | Drive sync metadata and sync-specific fields |
| 3 | v3.0.0 (planned) | TBD (tags? custom fields?) |


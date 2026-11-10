# FavoritePod data formats

Application release **1.0.0**, ZIP schema **1**, Drive state schema **1**, and
IndexedDB version **4** are separate version numbers. Changing the release
version does not imply a data-format migration.

## ZIP export schema 1

The current exporter emits version 1, and the importer accepts only version 1.
The authoritative definitions are in [archive.ts](../../src/core/archive.ts).

```text
favoritepod-export.zip
├── launcher.json
└── previews/
    └── <sha256>.jpg
```

| launcher.json field | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| format              | The literal `visual-launcher`                                                  |
| schemaVersion       | `1`                                                                            |
| exportedAt          | ISO date/time                                                                  |
| exportedBy          | Exporting device ID                                                            |
| groups              | Group records with parent, order, title, and field clocks                      |
| items               | Favorite records with group, order, URL, title, preview/icon, and field clocks |

[types.ts](../../src/core/types.ts) defines the records. Nested groups, field clocks,
and optional deletion tombstones are already part of schema 1. The exporter
selects active records; tombstones remain supported by the schema.

Previews are JPEGs named by their content hash. Settings, OAuth credentials,
original local files, and on-disk small-preview derivatives are not exported.

## Validation and import

[parseImportFile](../../src/core/import.ts) checks ZIP paths, duplicate entries,
schema, record references, hierarchy, URLs, preview hashes, and image validity
before returning an import preview. Unknown versions fail with an update message.

Current limits:

- Archive and total uncompressed contents: 100 MiB.
- launcher.json: 20 MiB.
- Each preview: 5 MiB, at most 8192 pixels per dimension and 40 million pixels.
- Up to 10,000 groups and 10,000 favorites; copy import includes its added folder
  in the group limit.

[importArchive](../../src/core/import.ts) applies one of three modes:

| Mode    | Behavior                                                               |
| ------- | ---------------------------------------------------------------------- |
| copy    | Create fresh IDs and place the imported groups under an import folder  |
| update  | Merge records using field clocks                                       |
| replace | Snapshot the current library, then replace its records transactionally |

[export.ts](../../src/core/export.ts) supports the full library or selected groups
with descendants and the ancestor structure needed to preserve hierarchy.
[Import/export tests](../../src/core/__tests__/import-export.test.ts) cover the
supported format and failure cases.

## Other formats

Drive uses per-device JSON state and separate preview assets. Its schema is
defined by [DriveDeviceState](../../src/core/types.ts) and validated in
[drive-files.ts](../../src/core/drive-files.ts).

IndexedDB migrations are defined in [db.ts](../../src/core/db.ts). Internal
database versions do not change ZIP compatibility automatically.

Chrome bookmark HTML is a separate exchange format, handled by
[parse-chrome-bookmarks.ts](../../src/core/parse-chrome-bookmarks.ts) and
[export-chrome.ts](../../src/core/export-chrome.ts); it carries no preview images.

## Changing a format

Introduce a new version only when its schema, importer/migration, and failure
behavior are implemented and tested. Check old exports, round trips, unsupported
versions, transaction rollback, and preview integrity. Document compatibility in
this guide and the [changelog](../../CHANGELOG.md). There is no implemented ZIP
schema 2 or 3.

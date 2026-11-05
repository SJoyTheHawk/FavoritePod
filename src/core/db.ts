import Dexie, { type Table } from 'dexie';
import type {
  DeviceFile,
  DriveAssetFile,
  Group,
  Item,
  KeyValueRecord,
  LibrarySnapshot,
  Thumbnail,
} from './types';

export class FavoritePodDB extends Dexie {
  groups!: Table<Group, string>;
  items!: Table<Item, string>;
  thumbnails!: Table<Thumbnail, string>;
  syncMeta!: Table<KeyValueRecord, string>;
  snapshots!: Table<LibrarySnapshot, number>;
  deviceFiles!: Table<DeviceFile, string>;
  driveAssets!: Table<DriveAssetFile, string>;
  settings!: Table<KeyValueRecord, string>;

  constructor() {
    super('FavoritePod');
    this.version(1).stores({
      groups: 'id,parentId,orderKey,deleted',
      items: 'id,groupId,orderKey,deleted,url,previewHash',
      thumbnails: 'hash,size,createdAt',
      syncMeta: 'key',
      snapshots: '++id,createdAt',
      deviceFiles: 'deviceId,lastSync',
      settings: 'key',
    });
    this.version(2)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table<Item, string>('items')
          .toCollection()
          .modify((item) => {
            item.clock.faviconUrl ??= item.clock.url;
          });
      });
    this.version(3).stores({ driveAssets: 'hash,lastSync' });
    this.version(4)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction.table('syncMeta').delete('drive.storageQuota');
      });
  }
}

export const db = new FavoritePodDB();

import Dexie, { type Table } from 'dexie';
import type {
  DeviceFile,
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
  }
}

export const db = new FavoritePodDB();

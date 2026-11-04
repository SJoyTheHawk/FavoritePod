export type HLC = string;

export type GroupField = 'parentId' | 'orderKey' | 'title';
export type ItemField =
  'groupId' | 'orderKey' | 'url' | 'title' | 'previewHash' | 'faviconUrl';

export interface Group {
  id: string;
  parentId: string | null;
  orderKey: string;
  title: string;
  clock: Record<GroupField, HLC>;
  deleted?: HLC;
}

export interface Item {
  id: string;
  groupId: string;
  orderKey: string;
  url: string;
  title: string;
  previewHash?: string;
  faviconUrl?: string;
  clock: Record<ItemField, HLC>;
  deleted?: HLC;
}

export interface Thumbnail {
  hash: string;
  blob: Blob;
  smallBlob?: Blob;
  size: number;
  width: number;
  height: number;
  createdAt: number;
}

export interface KeyValueRecord {
  key: string;
  value: unknown;
}

export interface DeviceFile {
  deviceId: string;
  fileId?: string;
  name?: string;
  modifiedTime?: string;
  lastSync: number;
  revision: number;
}

/** Versioned JSON content stored in Drive's appDataFolder for one device. */
export interface DriveDeviceState {
  schemaVersion: 1;
  deviceId: string;
  revision: number;
  lastUpdate: string;
  groups: Group[];
  items: Item[];
  tombstones: {
    groups: Record<string, HLC>;
    items: Record<string, HLC>;
  };
}

/** Local cache of the Drive file that stores one content-addressed preview. */
export interface DriveAssetFile {
  hash: string;
  fileId: string;
  name: string;
  modifiedTime: string;
  lastSync: number;
  size: number;
}

export interface LibrarySnapshot {
  id?: number;
  createdAt: number;
  groups: Group[];
  items: Item[];
  thumbnails: Thumbnail[];
}

export interface LibraryState {
  groups: Group[];
  items: Item[];
}

export interface ThumbnailInput {
  blob: Blob;
  width: number;
  height: number;
  smallBlob?: Blob;
}

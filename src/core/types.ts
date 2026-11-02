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
  lastSync: number;
  revision: number;
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
}

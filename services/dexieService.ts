
/* 
 * [Context]: Local database service using Dexie. 
 * [Logic]: We extend the Dexie class to manage local storage for media assets generated or used within the app.
 * [Note for future AI]: This is crucial for the Infinite Canvas to persist image/video data across sessions.
 */
// [Fix]: Switched to named import for Dexie to resolve type inference issues with inherited methods like version().
import { Dexie, type Table } from 'dexie';

export interface MediaAsset {
  id?: number;
  nodeId: string;
  type: 'image' | 'video';
  data: string; // Base64 or Blob URL
  createdAt: number;
}

export class SoraCanvasDB extends Dexie {
  assets!: Table<MediaAsset>;

  constructor() {
    super('SoraCanvasDB');
    // Define the database schema using the version method inherited from Dexie
    this.version(1).stores({
      assets: '++id, nodeId, type, createdAt'
    });
  }

  async saveAsset(nodeId: string, type: 'image' | 'video', data: string) {
    // Overwrite old asset for this node to keep DB clean
    await this.assets.where('nodeId').equals(nodeId).delete();
    return await this.assets.add({
      nodeId,
      type,
      data,
      createdAt: Date.now()
    });
  }

  async getAsset(nodeId: string) {
    return await this.assets.where('nodeId').equals(nodeId).first();
  }

  async clearAll() {
    return await this.assets.clear();
  }
}

export const db = new SoraCanvasDB();

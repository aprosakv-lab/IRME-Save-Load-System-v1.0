import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { WorldStorage } from './storage';

// sync-yjs.ts
// - Creates a Y.Doc per worldId
// - Uses a Y.Map 'objects' for object state (keyed by object.id)
// - Mirrors changes between Y.Doc and WorldStorage

export class YjsSyncClient {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private objectsMap: Y.Map<any>;
  private storage: WorldStorage;

  constructor(storage: WorldStorage, websocketUrl = 'wss://demos.yjs.dev') {
    this.storage = storage;
    this.doc = new Y.Doc();
    const worldId = storage.idb.dbName || 'default_world';
    this.provider = new WebsocketProvider(websocketUrl, worldId, this.doc);
    this.objectsMap = this.doc.getMap('objects');

    this.objectsMap.observe(event => {
      event.changes.keys.forEach(async (change, key) => {
        const val = this.objectsMap.get(key);
        if (!val) return; // deletion or undefined
        try {
          // mirror into storage (avoid loops by checking timestamps externally)
          await this.storage.saveObject({ ...val, id: key });
        } catch (err) {
          console.error('Error saving mirrored object to storage', err);
        }
      });
    });

    // Pull initial state from storage into Y.Doc
    this.bootstrapFromStorage().catch(console.error);
  }

  async bootstrapFromStorage() {
    const objs = await this.storage.listObjects();
    for (const o of objs) {
      this.objectsMap.set(o.id, o);
    }
  }

  async applyLocalChange(obj: any) {
    // write to both storage and Y.Doc
    await this.storage.saveObject(obj);
    this.doc.transact(() => {
      this.objectsMap.set(obj.id, obj);
    });
  }

  async destroy() {
    this.provider.destroy();
    this.doc.destroy();
  }
}

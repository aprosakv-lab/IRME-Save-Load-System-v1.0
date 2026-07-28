// Pequeno wrapper promisificado para IndexedDB (browser)
export interface IDBOptions {
  dbName: string;
  version?: number;
  stores?: { name: string; options?: IDBObjectStoreParameters; indices?: { name: string; keyPath: string | string[]; options?: IDBIndexParameters }[] }[];
}

export class IDBHelper {
  private dbPromise: Promise<IDBDatabase>;

  constructor(private opts: IDBOptions) {
    this.dbPromise = this.openDB();
  }

  private openDB(): Promise<IDBDatabase> {
    const { dbName, version = 1, stores = [] } = this.opts;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        for (const s of stores) {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, s.options || { keyPath: 'id' });
            if (s.indices) {
              for (const idx of s.indices) {
                store.createIndex(idx.name, idx.keyPath as any, idx.options);
              }
            }
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private tx<T>(storeNames: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
    return this.dbPromise.then((db) => {
      return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        Promise.resolve(run(tx)).then((v) => {
          tx.oncomplete = () => resolve(v);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('tx aborted'));
        }).catch((err) => {
          tx.abort();
          reject(err);
        });
      });
    });
  }

  put(storeName: string, value: any): Promise<void> {
    return this.tx([storeName], 'readwrite', (tx) => {
      const store = tx.objectStore(storeName);
      store.put(value);
    });
  }

  get<T = any>(storeName: string, key: string): Promise<T | undefined> {
    return this.tx([storeName], 'readonly', (tx) => {
      return new Promise<T | undefined>((resolve, reject) => {
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  delete(storeName: string, key: string): Promise<void> {
    return this.tx([storeName], 'readwrite', (tx) => {
      tx.objectStore(storeName).delete(key);
    });
  }

  getAll<T = any>(storeName: string): Promise<T[]> {
    return this.tx([storeName], 'readonly', (tx) => {
      return new Promise<T[]>((resolve, reject) => {
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  clear(storeName: string): Promise<void> {
    return this.tx([storeName], 'readwrite', (tx) => {
      tx.objectStore(storeName).clear();
    });
  }

  iterate<T = any>(storeName: string, callback: (val: T) => boolean | void): Promise<void> {
    return this.tx([storeName], 'readonly', (tx) => {
      return new Promise<void>((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) {
            resolve();
            return;
          }
          try {
            const stop = callback(cur.value);
            if (stop === true) { resolve(); return; }
            cur.continue();
          } catch (err) { reject(err); }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }
}

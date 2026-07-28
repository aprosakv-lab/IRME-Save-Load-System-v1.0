import { IDBHelper } from './idb';
import type { WorldMeta, WorldObject, Snapshot, GLBAsset, WorldBundle, AgentState } from './types';

const DEFAULT_STORES = [
  { name: 'meta', options: { keyPath: 'id' } },
  { name: 'objects', options: { keyPath: 'id' } },
  { name: 'assets', options: { keyPath: 'id' } },
  { name: 'assetBlobs', options: { keyPath: 'id' } },
  { name: 'snapshots', options: { keyPath: 'id' } },
  { name: 'backups', options: { keyPath: 'id' } },
  { name: 'timeline', options: { keyPath: 'id' } },
  { name: 'agents', options: { keyPath: 'agentId' } },
];

export interface StorageOptions {
  worldId: string;
  dbName?: string;
  autoBackupIntervalMs?: number | null;
  backupLimit?: number;
}

export class WorldStorage {
  public idb: IDBHelper;
  private opts: StorageOptions;
  private backupTimer?: number;

  constructor(opts: StorageOptions) {
    this.opts = opts;
    const dbName = opts.dbName || `irme_world_${opts.worldId}`;
    this.idb = new IDBHelper({
      dbName,
      version: 1,
      stores: DEFAULT_STORES,
    });
    if (opts.autoBackupIntervalMs && opts.autoBackupIntervalMs > 0) {
      this.startAutoBackup(opts.autoBackupIntervalMs, opts.backupLimit || 5);
    }
  }

  async saveMeta(meta: WorldMeta): Promise<void> {
    await this.idb.put('meta', { id: 'world', ...meta, updatedAt: new Date().toISOString() });
  }

  async getMeta(): Promise<WorldMeta | undefined> {
    return this.idb.get('meta', 'world');
  }

  async saveObject(obj: WorldObject): Promise<void> {
    const copy = { ...obj, updatedAt: Date.now() } as any;
    await this.idb.put('objects', copy);
    await this.idb.put('timeline', {
      id: `t-${Date.now()}-${obj.id}`,
      tipo: 'OBJETO_UPDATE',
      dados: { id: obj.id },
      tick: (obj.tickCriacao ?? 0),
      timestamp: new Date().toISOString(),
    });
  }

  async getObject(id: string): Promise<WorldObject | undefined> {
    return this.idb.get('objects', id);
  }

  async listObjects(): Promise<WorldObject[]> {
    return this.idb.getAll('objects');
  }

  async saveAssetMeta(asset: GLBAsset): Promise<void> {
    await this.idb.put('assets', asset);
  }

  async saveAssetBlob(id: string, blob: Blob): Promise<void> {
    await this.idb.put('assetBlobs', { id, blob });
    const meta = await this.idb.get('assets', id) as any;
    if (meta) {
      meta.size = blob.size;
      meta.createdAt = meta.createdAt || new Date().toISOString();
      await this.idb.put('assets', meta);
    } else {
      await this.idb.put('assets', { id, filename: id, size: blob.size, createdAt: new Date().toISOString() });
    }
  }

  async getAssetBlob(id: string): Promise<Blob | undefined> {
    const rec = await this.idb.get('assetBlobs', id) as any;
    return rec?.blob;
  }

  async listAssets(): Promise<GLBAsset[]> {
    return this.idb.getAll('assets');
  }

  async createSnapshot(snapshot: Snapshot): Promise<void> {
    await this.idb.put('snapshots', snapshot);
    await this.idb.put('timeline', {
      id: `snap-${snapshot.id}`,
      tipo: 'SNAPSHOT',
      dados: { id: snapshot.id, tick: snapshot.tick },
      tick: snapshot.tick,
      timestamp: snapshot.timestamp,
    });
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return this.idb.getAll('snapshots');
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    return this.idb.get('snapshots', id);
  }

  async createBackupBundle(note?: string): Promise<void> {
    const meta = await this.getMeta();
    const objects = await this.listObjects();
    const assets = await this.listAssets();
    const snapshots = await this.listSnapshots();
    const bundle: WorldBundle = {
      meta: meta as any,
      objects,
      abexos: [],
      timeline: await this.idb.getAll('timeline'),
      snapshots,
      assets: [],
      agents: await this.idb.getAll('agents'),
    };
    const id = `backup-${Date.now()}`;
    await this.idb.put('backups', {
      id,
      createdAt: new Date().toISOString(),
      note,
      bundle,
    });
    const backups = await this.idb.getAll('backups');
    const limit = (this.opts.backupLimit !== undefined) ? this.opts.backupLimit : 5;
    if (backups.length > limit) {
      backups.sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt));
      const toDelete = backups.slice(0, backups.length - limit);
      for (const d of toDelete) { await this.idb.delete('backups', d.id); }
    }
  }

  async listBackups(): Promise<any[]> {
    return this.idb.getAll('backups');
  }

  startAutoBackup(intervalMs: number, limit = 5) {
    if (this.backupTimer) window.clearInterval(this.backupTimer);
    this.opts.backupLimit = limit;
    this.backupTimer = window.setInterval(() => {
      this.createBackupBundle('auto').catch(console.error);
    }, intervalMs) as unknown as number;
  }

  stopAutoBackup() {
    if (this.backupTimer) {
      window.clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  async saveAgentState(agent: AgentState) {
    await this.idb.put('agents', agent);
  }
  async getAgentState(agentId: string) {
    return this.idb.get('agents', agentId);
  }
  async listAgents() {
    return this.idb.getAll('agents');
  }

  async exportBundle(includeBlobs = false): Promise<WorldBundle & { blobs?: { id: string; blob: Blob }[] }> {
    const meta = await this.getMeta();
    const objects = await this.listObjects();
    const abexos = []; 
    const timeline = await this.idb.getAll('timeline');
    const snapshots = await this.listSnapshots();
    const assets = await this.listAssets();
    const agents = await this.listAgents();
    const bundle: any = { meta, objects, abexos, timeline, snapshots, assets, agents };
    if (includeBlobs) {
      const blobs: { id: string; blob: Blob }[] = [];
      for (const a of assets) {
        const blob = await this.getAssetBlob(a.id);
        if (blob) blobs.push({ id: a.id, blob });
      }
      return { ...bundle, blobs };
    }
    return bundle;
  }
}

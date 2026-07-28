import JSZip from 'jszip';
import type { WorldStorage } from './storage';
import type { GLBAsset, AgentState } from './types';
import { AgentRegistry } from './ai-restore';

export async function importIRME(storage: WorldStorage, fileBlob: Blob, options?: { restoreAgents?: boolean }) {
  const zip = await JSZip.loadAsync(fileBlob as Blob);
  const worldJson = zip.file('world.json') ? JSON.parse(await zip.file('world.json')!.async('string')) : {};

  const objectsFile = zip.file('objects/objects.json');
  if (objectsFile) {
    const objects = JSON.parse(await objectsFile.async('string'));
    for (const obj of objects) {
      obj.updatedAt = obj.updatedAt || Date.now();
      await storage.saveObject(obj);
    }
  }

  const snapFolder = zip.folder('snapshots');
  if (snapFolder) {
    const files = Object.values(snapFolder.files) as any[];
    for (const f of files) {
      if (f.name.endsWith('.json')) {
        const s = JSON.parse(await f.async('string'));
        await storage.createSnapshot(s);
      }
    }
  }

  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    for (const name in assetsFolder.files) {
      const f = assetsFolder.files[name];
      if (f.name.endsWith('.meta.json')) {
        const meta = JSON.parse(await f.async('string')) as GLBAsset;
        await storage.saveAssetMeta(meta);
      } else if (f.name.endsWith('.glb')) {
        const id = f.name.replace(/\.glb$/, '');
        const blob = await f.async('blob');
        await storage.saveAssetBlob(id, blob);
      }
    }
  }

  const timelineFile = zip.file('timeline.json');
  if (timelineFile) {
    const timeline = JSON.parse(await timelineFile.async('string'));
    for (const ev of timeline) {
      await storage.idb.put('timeline', ev as any);
    }
  }

  const agentsFile = zip.file('agents.json');
  if (agentsFile) {
    const agents = JSON.parse(await agentsFile.async('string')) as AgentState[];
    for (const a of agents) {
      await storage.saveAgentState(a);
      if (options?.restoreAgents) {
        const reg = AgentRegistry.instance();
        await reg.restoreAgentFromState(a);
      }
    }
  }

  if (worldJson.meta) {
    await storage.saveMeta(worldJson.meta);
  }
}

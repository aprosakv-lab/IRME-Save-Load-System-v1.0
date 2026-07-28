import JSZip from 'jszip';
import type { WorldBundle } from './types';
import type { WorldStorage } from './storage';

// Export .IRME (zip) with structure:
// - world.json (meta + summary)
// - objects/objects.json
// - snapshots/*.json
// - assets/*.meta.json
// - assets/*.glb
// - timeline.json
// - agents.json
// - ydoc.bin (optional, Yjs binary state)

export async function exportIRME(storage: WorldStorage, includeBlobs = true, ydocBinary?: Uint8Array): Promise<Blob> {
  const zip = new JSZip();
  const bundle = await storage.exportBundle(includeBlobs);

  zip.file('world.json', JSON.stringify({ meta: bundle.meta, summary: { objectCount: bundle.objects.length, assetCount: bundle.assets.length, snapshotCount: bundle.snapshots.length, createdAt: bundle.meta?.createdAt } }, null, 2));

  zip.folder('objects')?.file('objects.json', JSON.stringify(bundle.objects, null, 2));

  const snapFolder = zip.folder('snapshots');
  for (const s of (bundle.snapshots || [])) {
    snapFolder?.file(`${s.id}.json`, JSON.stringify(s));
  }

  const assetsFolder = zip.folder('assets');
  for (const a of (bundle.assets || [])) {
    assetsFolder?.file(`${a.id}.meta.json`, JSON.stringify(a));
  }

  if (includeBlobs && (bundle as any).blobs) {
    for (const b of (bundle as any).blobs) {
      assetsFolder?.file(`${b.id}.glb`, b.blob as Blob);
    }
  }

  zip.file('timeline.json', JSON.stringify(bundle.timeline || [], null, 2));
  zip.file('agents.json', JSON.stringify(bundle.agents || [], null, 2));

  if (ydocBinary) {
    zip.file('ydoc.bin', ydocBinary);
  }

  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return content;
}

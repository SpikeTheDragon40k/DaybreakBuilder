import { ContentRegistry, downloadIndex, type RegistryWarning } from "@dndbuilder/engine";
import { getPlatform, packs, settings, type PackMeta, type StoredFile } from "../platform";

// Content shipped with the app: system elements (and the SRD pack, when present).
const bundledCore = import.meta.glob("../../../../content/core/**/*.xml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const bundledSrd = import.meta.glob("../../../../content/srd/**/*.xml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const bundledIndexes = import.meta.glob("../../../../content/indexes/*.index", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Indexes the app ships (by their published URL); installing one doesn't need to fetch it. */
const shippedIndex = (url: string): string | undefined =>
  Object.entries(bundledIndexes).find(([path]) => url.endsWith(path.slice(path.lastIndexOf("/content/"))))?.[1];

export interface ContentSourceSummary {
  id: string;
  name: string;
  kind: "bundled" | "pack" | "custom";
  fileCount: number;
  enabled: boolean;
  meta?: PackMeta;
}

export interface LoadedContent {
  registry: ContentRegistry;
  sources: ContentSourceSummary[];
  warnings: RegistryWarning[];
  customFolder?: string;
}

function shortPath(p: string): string {
  return p.replace(/^(\.\.\/)+content\//, "");
}

export async function loadAllContent(): Promise<LoadedContent> {
  const registry = new ContentRegistry();
  const sources: ContentSourceSummary[] = [];

  for (const [path, xml] of Object.entries(bundledCore)) registry.addXml(xml, shortPath(path));
  sources.push({ id: "bundled:core", name: "Core rules (built in)", kind: "bundled", fileCount: Object.keys(bundledCore).length, enabled: true });
  if (Object.keys(bundledSrd).length) {
    const enabled = settings.get("srdEnabled", true);
    if (enabled) for (const [path, xml] of Object.entries(bundledSrd)) registry.addXml(xml, shortPath(path));
    sources.push({ id: "bundled:srd", name: "System Reference Document 5.1 (built in, CC-BY-4.0)", kind: "bundled", fileCount: Object.keys(bundledSrd).length, enabled });
  }

  for (const meta of await packs.list()) {
    sources.push({ id: meta.id, name: meta.name, kind: "pack", fileCount: meta.fileCount, enabled: meta.enabled, meta });
    if (!meta.enabled) continue;
    for (const f of await packs.files(meta.id)) registry.addXml(f.content, `${meta.name}/${f.path}`);
  }

  let customFolder: string | undefined;
  const platform = await getPlatform();
  if (platform.readCustomFolder) {
    try {
      const custom = await platform.readCustomFolder();
      customFolder = custom.folder;
      for (const f of custom.files) registry.addXml(f.content, `custom/${f.path}`);
      sources.push({ id: "custom", name: "Custom folder", kind: "custom", fileCount: custom.files.length, enabled: true });
    } catch (e) {
      registry.warnings.push({ message: `Could not read custom content folder: ${(e as Error).message}` });
    }
  }

  registry.finalize();
  return { registry, sources, warnings: registry.warnings, customFolder };
}

export function packIdForUrl(url: string): string {
  return `index:${url}`;
}

export async function installIndex(
  url: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ meta: PackMeta; errors: { url: string; message: string }[] }> {
  const platform = await getPlatform();
  const result = await downloadIndex(url, {
    fetchText: async (u) => shippedIndex(u) ?? platform.fetchText(u),
    onProgress: (d, t) => onProgress?.(d, t),
  });
  if (result.files.length === 0) {
    throw new Error(result.errors[0]?.message ?? "The index did not list any element files.");
  }
  const id = packIdForUrl(url);
  const existing = (await packs.list()).find((p) => p.id === id);
  const meta: PackMeta = {
    id,
    name: result.info.name ?? url.split("/").pop() ?? url,
    description: result.info.description,
    indexUrl: url,
    kind: "index",
    fileCount: result.files.length,
    updatedAt: new Date().toISOString(),
    enabled: existing?.enabled ?? true,
  };
  await packs.put(meta, result.files.map((f) => ({ path: f.path, content: f.content })));
  return { meta, errors: result.errors };
}

export async function importLocalFiles(name: string, files: StoredFile[]): Promise<PackMeta> {
  const id = `files:${name}:${Date.now()}`;
  const meta: PackMeta = {
    id,
    name,
    kind: "files",
    fileCount: files.length,
    updatedAt: new Date().toISOString(),
    enabled: true,
  };
  await packs.put(meta, files);
  return meta;
}

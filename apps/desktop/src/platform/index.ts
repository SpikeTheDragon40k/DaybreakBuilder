import type { CharacterState } from "@dndbuilder/engine";
import type { Party } from "../state/party";
import { idbAll, idbDelete, idbGet, idbPut } from "./idb";

export interface StoredFile {
  path: string;
  content: string;
}

export interface PackMeta {
  id: string;
  name: string;
  description?: string;
  /** Root index URL for downloaded packs (used for updates). */
  indexUrl?: string;
  kind: "index" | "files";
  fileCount: number;
  updatedAt: string;
  enabled: boolean;
}

export interface CharacterMeta {
  id: string;
  name: string;
  summary: string;
  level: number;
  updatedAt: string;
  /** Filled in by `characters.list` from the saved state; not stored in the meta. */
  portrait?: string;
}

interface CharacterRecord {
  meta: CharacterMeta;
  state: CharacterState;
}

export interface PickedFile {
  name: string;
  content: string;
}

export interface Platform {
  kind: "tauri" | "web";
  fetchText(url: string): Promise<string>;
  pickTextFiles(extensions: string[], multiple: boolean): Promise<PickedFile[]>;
  saveTextFile(defaultName: string, content: string, extension: string): Promise<boolean>;
  saveBinaryFile(defaultName: string, data: Uint8Array, extension: string, mime: string): Promise<boolean>;
  /** Desktop only: XML files from the user's custom content folder. */
  readCustomFolder?(): Promise<{ folder: string; files: StoredFile[] }>;
  openCustomFolder?(): Promise<void>;
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Storage (IndexedDB in both the browser and the desktop webview)

export const packs = {
  async list(): Promise<PackMeta[]> {
    const all = await idbAll<PackMeta>("packs");
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },
  async files(id: string): Promise<StoredFile[]> {
    return (await idbGet<StoredFile[]>("packFiles", id)) ?? [];
  },
  async put(meta: PackMeta, files: StoredFile[]): Promise<void> {
    await idbPut("packFiles", meta.id, files);
    await idbPut("packs", meta.id, meta);
  },
  async update(meta: PackMeta): Promise<void> {
    await idbPut("packs", meta.id, meta);
  },
  async remove(id: string): Promise<void> {
    await idbDelete("packFiles", id);
    await idbDelete("packs", id);
  },
};

export const characters = {
  async list(): Promise<CharacterMeta[]> {
    const all = await idbAll<CharacterRecord>("characters");
    return all.map((r) => ({ ...r.meta, portrait: r.state.portrait })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async load(id: string): Promise<CharacterState | undefined> {
    return (await idbGet<CharacterRecord>("characters", id))?.state;
  },
  async save(meta: CharacterMeta, state: CharacterState): Promise<void> {
    const { portrait: _, ...stored } = meta;
    await idbPut<CharacterRecord>("characters", meta.id, { meta: stored, state });
  },
  async remove(id: string): Promise<void> {
    await idbDelete("characters", id);
  },
};

export const parties = {
  async list(): Promise<Party[]> {
    const all = await idbAll<Party>("parties");
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },
  async save(party: Party): Promise<void> {
    await idbPut("parties", party.id, party);
  },
  async remove(id: string): Promise<void> {
    await idbDelete("parties", id);
  },
};

export const settings = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`dndbuilder:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`dndbuilder:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

// ---------------------------------------------------------------------------
// Platform services

const web: Platform = {
  kind: "web",
  async fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  },
  pickTextFiles(extensions, multiple) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = multiple;
      input.accept = extensions.map((e) => `.${e}`).join(",");
      input.onchange = async () => {
        const list = [...(input.files ?? [])];
        resolve(await Promise.all(list.map(async (f) => ({ name: f.name, content: await f.text() }))));
      };
      input.click();
    });
  },
  async saveTextFile(defaultName, content) {
    downloadBlob(defaultName, new Blob([content], { type: "text/plain;charset=utf-8" }));
    return true;
  },
  async saveBinaryFile(defaultName, data, _extension, mime) {
    downloadBlob(defaultName, new Blob([data as BlobPart], { type: mime }));
    return true;
  },
};

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createTauriPlatform(): Promise<Platform> {
  const { invoke } = await import("@tauri-apps/api/core");
  const dialog = await import("@tauri-apps/plugin-dialog");
  const http = await import("@tauri-apps/plugin-http");
  return {
    kind: "tauri",
    async fetchText(url) {
      const res = await http.fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.text();
    },
    async pickTextFiles(extensions, multiple) {
      const picked = await dialog.open({ multiple, filters: [{ name: "Files", extensions }] });
      if (!picked) return [];
      const paths = Array.isArray(picked) ? picked : [picked];
      return Promise.all(
        paths.map(async (p) => ({ name: p.split(/[\\/]/).pop() ?? p, content: await invoke<string>("read_text_file", { path: p }) })),
      );
    },
    async saveTextFile(defaultName, content, extension) {
      const path = await dialog.save({ defaultPath: defaultName, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
      if (!path) return false;
      await invoke("write_text_file", { path, content });
      return true;
    },
    async saveBinaryFile(defaultName, data, extension) {
      const path = await dialog.save({ defaultPath: defaultName, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
      if (!path) return false;
      await invoke("write_binary_file", { path, data: Array.from(data) });
      return true;
    },
    async readCustomFolder() {
      return invoke<{ folder: string; files: StoredFile[] }>("read_custom_content");
    },
    async openCustomFolder() {
      await invoke("open_custom_content_folder");
    },
  };
}

let platformPromise: Promise<Platform> | null = null;

export function getPlatform(): Promise<Platform> {
  if (!platformPromise) platformPromise = isTauri ? createTauriPlatform() : Promise.resolve(web);
  return platformPromise;
}

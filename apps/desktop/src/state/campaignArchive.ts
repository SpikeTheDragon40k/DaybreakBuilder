import type { CharacterState } from "@daybreakbuilder/engine";
import { unzipSync, zipSync, strFromU8, strToU8, type Zippable } from "fflate";
import type { CharacterMeta, StoredFile } from "../platform";
import { characters as characterStore } from "../platform";
import { CAMPAIGN_FILE, parseCampaignMeta, serializeCampaignMeta, type CampaignRef, type CampaignStore } from "./campaign";

/**
 * A campaign as one `.zip` file: the campaign folder as it is on disk (so the
 * unzipped archive is also a usable Obsidian vault), plus the party's
 * characters in a hidden `.daybreakbuilder` folder, since characters live in
 * the app's own storage rather than in the campaign.
 */
export const ARCHIVE_EXTENSION = "zip";
const CHARACTERS_DIR = ".daybreakbuilder/characters/";
const MANIFEST = ".daybreakbuilder/export.json";
const MAX_ENTRIES = 20000;

export interface ArchivedCharacter {
  meta: Omit<CharacterMeta, "portrait">;
  state: CharacterState;
}

export interface CampaignArchive {
  name: string;
  files: StoredFile[];
  images: { path: string; data: Uint8Array }[];
  characters: ArchivedCharacter[];
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;

/** Paths kept inside the archive: relative, no `..`, no absolute or drive paths. */
export function safeArchivePath(path: string): string | null {
  const p = path.replace(/\\/g, "/");
  if (!p || p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === ".." || s === ".")) return null;
  return parts.filter(Boolean).join("/") || null;
}

export function buildCampaignArchive(archive: CampaignArchive, appVersion: string): Uint8Array {
  const entries: Zippable = {};
  for (const f of archive.files) {
    const p = safeArchivePath(f.path);
    if (p) entries[p] = strToU8(f.content);
  }
  // Images are already compressed; storing them saves time for nothing lost.
  for (const img of archive.images) {
    const p = safeArchivePath(img.path);
    if (p) entries[p] = [img.data, { level: 0 }];
  }
  for (const c of archive.characters) entries[`${CHARACTERS_DIR}${c.meta.id}.json`] = strToU8(`${JSON.stringify(c, null, 2)}\n`);
  entries[MANIFEST] = strToU8(
    `${JSON.stringify({ format: "daybreakbuilder-campaign-export", version: 1, app: appVersion, name: archive.name, exportedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  return zipSync(entries, { level: 6 });
}

/**
 * Read an exported campaign, or any zip of a notes folder (an Obsidian vault).
 * When everything sits in one top-level folder, that folder is the campaign.
 */
export function readCampaignArchive(data: Uint8Array, fallbackName: string): CampaignArchive {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(data);
  } catch {
    throw new Error("This file isn't a zip archive.");
  }
  let paths = Object.keys(raw).filter((p) => !p.endsWith("/"));
  if (paths.length > MAX_ENTRIES) throw new Error("The archive has too many files.");
  // A zip made by zipping the folder itself: strip the common top folder.
  const tops = new Set(paths.map((p) => p.split("/")[0]));
  let prefix = "";
  if (tops.size === 1 && paths.every((p) => p.includes("/"))) prefix = `${[...tops][0]}/`;
  const folderName = prefix ? prefix.slice(0, -1) : fallbackName;

  const files: StoredFile[] = [];
  const images: CampaignArchive["images"] = [];
  const characters: ArchivedCharacter[] = [];
  paths = paths.map((p) => p.slice(prefix.length));
  for (const [i, original] of Object.keys(raw).filter((p) => !p.endsWith("/")).entries()) {
    const path = safeArchivePath(paths[i]);
    if (!path) continue;
    const bytes = raw[original];
    if (path.startsWith(CHARACTERS_DIR) && path.endsWith(".json")) {
      try {
        const c = JSON.parse(strFromU8(bytes)) as ArchivedCharacter;
        if (c?.meta && typeof c.meta.id === "string" && c.state && typeof c.state === "object") characters.push(c);
      } catch {
        /* skip a damaged character */
      }
      continue;
    }
    const hidden = path.split("/").some((s) => s.startsWith("."));
    if (hidden || path.startsWith("__MACOSX/")) continue;
    if (path === CAMPAIGN_FILE || /\.md$/i.test(path)) files.push({ path, content: strFromU8(bytes) });
    else if (IMAGE_EXT.test(path)) images.push({ path, data: bytes });
  }
  if (!files.length && !images.length) throw new Error("No notes or campaign found in this archive.");
  const meta = files.find((f) => f.path === CAMPAIGN_FILE);
  const name = parseCampaignMeta(meta?.content, folderName).name;
  return { name, files, images, characters };
}

export function archiveFileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Campaign";
  return `${safe}.${ARCHIVE_EXTENSION}`;
}

// ---------------------------------------------------------------------------
// Export and import through a campaign store

/** Everything in a stored campaign, with the party's characters. */
export async function exportCampaign(store: CampaignStore, ref: CampaignRef): Promise<{ data: Uint8Array; characters: number }> {
  const files = await store.read(ref);
  const meta = parseCampaignMeta(files.find((f) => f.path === CAMPAIGN_FILE)?.content, ref.name);
  const images = await Promise.all(
    (await store.listImages(ref)).map(async (path) => ({ path, data: new Uint8Array(await (await store.readImage(ref, path)).arrayBuffer()) })),
  );
  const chars: ArchivedCharacter[] = [];
  const metas = await characterStore.list();
  for (const id of meta.party.memberIds) {
    const m = metas.find((x) => x.id === id);
    const state = m && (await characterStore.load(id));
    if (m && state) {
      const { portrait: _, ...stored } = m;
      chars.push({ meta: stored, state });
    }
  }
  const data = buildCampaignArchive({ name: meta.name, files, images, characters: chars }, __APP_VERSION__);
  return { data, characters: chars.length };
}

export interface ImportResult {
  ref: CampaignRef;
  notes: number;
  images: number;
  /** Characters added to the app. */
  added: number;
  /** Characters already in the app (by id), left as they are. */
  kept: number;
}

/** A new campaign from an archive. Characters already in the app are not overwritten. */
export async function importCampaign(store: CampaignStore, archive: CampaignArchive): Promise<ImportResult> {
  const files = archive.files.some((f) => f.path === CAMPAIGN_FILE)
    ? archive.files
    : [{ path: CAMPAIGN_FILE, content: serializeCampaignMeta(parseCampaignMeta(undefined, archive.name)) }, ...archive.files];
  const ref = await store.create(archive.name, files);
  for (const img of archive.images) await store.writeImage(ref, img.path, img.data);
  const existing = new Set((await characterStore.list()).map((c) => c.id));
  let added = 0;
  for (const c of archive.characters) {
    if (existing.has(c.meta.id)) continue;
    await characterStore.save(c.meta, c.state);
    added++;
  }
  return { ref, notes: archive.files.filter((f) => f.path !== CAMPAIGN_FILE).length, images: archive.images.length, added, kept: archive.characters.length - added };
}

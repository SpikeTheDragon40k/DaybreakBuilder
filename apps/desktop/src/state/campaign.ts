import type { Combat } from "@daybreakbuilder/engine";
import { isTauri, settings, type StoredFile } from "../platform";
import { idbAll, idbDelete, idbGet, idbPut } from "../platform/idb";
import { newEncounter, type Party, type PartyEncounter } from "./party";

/** A campaign in the list: a folder on disk (desktop) or a record in browser storage. */
export interface CampaignRef {
  /** The folder path on desktop; a generated id in the browser. */
  id: string;
  name: string;
}

export const CAMPAIGN_FILE = "campaign.json";
const FORMAT = "daybreakbuilder-campaign";

/** What `campaign.json` holds: the campaign's name and its party (members, planned encounter, initiative). */
export interface CampaignMeta {
  format: typeof FORMAT;
  version: 1;
  name: string;
  party: { memberIds: string[]; encounter?: PartyEncounter; combat?: Combat };
  createdAt: string;
  updatedAt: string;
}

export function newCampaignMeta(name: string, party?: Partial<CampaignMeta["party"]>): CampaignMeta {
  const now = new Date().toISOString();
  return { format: FORMAT, version: 1, name, party: { memberIds: [], encounter: newEncounter(), ...party }, createdAt: now, updatedAt: now };
}

/** Read `campaign.json`, tolerating a missing or hand-edited file. */
export function parseCampaignMeta(text: string | undefined, fallbackName: string): CampaignMeta {
  let raw: Partial<CampaignMeta> = {};
  try {
    raw = text ? (JSON.parse(text) as Partial<CampaignMeta>) : {};
  } catch {
    raw = {};
  }
  const base = newCampaignMeta(typeof raw.name === "string" && raw.name.trim() ? raw.name : fallbackName);
  const party = raw.party && typeof raw.party === "object" ? raw.party : base.party;
  return {
    ...base,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    party: {
      memberIds: Array.isArray(party.memberIds) ? party.memberIds.filter((x): x is string => typeof x === "string") : [],
      encounter: party.encounter ?? newEncounter(),
      combat: party.combat,
    },
  };
}

export function serializeCampaignMeta(meta: CampaignMeta): string {
  return `${JSON.stringify(meta, null, 2)}\n`;
}

/** The campaign's party in the shape the party overview and initiative tracker use. */
export function campaignParty(id: string, meta: CampaignMeta): Party {
  return { id, name: meta.name, memberIds: meta.party.memberIds, notes: "", encounter: meta.party.encounter, combat: meta.party.combat, updatedAt: meta.updatedAt };
}

export function withParty(meta: CampaignMeta, party: Party): CampaignMeta {
  return { ...meta, party: { memberIds: party.memberIds, encounter: party.encounter, combat: party.combat } };
}

export const PARTY_NOTES_TITLE = "Party notes";

/** The files a campaign made from a party saved before campaigns starts with. */
export function campaignFromParty(party: Party): { name: string; files: StoredFile[] } {
  const meta = newCampaignMeta(party.name || "Campaign", { memberIds: party.memberIds, encounter: party.encounter ?? newEncounter(), combat: party.combat });
  const files: StoredFile[] = [{ path: CAMPAIGN_FILE, content: serializeCampaignMeta({ ...meta, createdAt: party.updatedAt || meta.createdAt }) }];
  if (party.notes.trim()) files.push({ path: `Notes/${PARTY_NOTES_TITLE}.md`, content: `${party.notes.trim()}\n` });
  return { name: meta.name, files };
}

// ---------------------------------------------------------------------------
// Storage

export interface CampaignStore {
  kind: "disk" | "browser";
  list(): Promise<CampaignRef[]>;
  create(name: string, files?: StoredFile[]): Promise<CampaignRef>;
  /** Desktop: use an existing folder (an Obsidian vault, a synced folder…) as a campaign. */
  openFolder?(): Promise<CampaignRef | null>;
  /** Desktop: drop from the list, keeping the folder. Browser: delete. */
  forget(ref: CampaignRef): Promise<void>;
  rename(ref: CampaignRef, name: string): Promise<void>;
  read(ref: CampaignRef): Promise<StoredFile[]>;
  write(ref: CampaignRef, path: string, content: string): Promise<void>;
  move(ref: CampaignRef, from: string, to: string): Promise<void>;
  /** Desktop: into the campaign's `.trash` folder. Browser: delete. */
  trash(ref: CampaignRef, path: string): Promise<void>;
  reveal?(ref: CampaignRef): Promise<void>;
}

const FOLDERS_KEY = "campaignFolders";

/** Desktop: campaigns are folders; the list of known folders is a setting. */
async function diskStore(): Promise<CampaignStore> {
  const { invoke } = await import("@tauri-apps/api/core");
  const dialog = await import("@tauri-apps/plugin-dialog");
  const known = () => settings.get<CampaignRef[]>(FOLDERS_KEY, []);
  const remember = (ref: CampaignRef) => settings.set(FOLDERS_KEY, [...known().filter((r) => r.id !== ref.id), ref]);
  const store: CampaignStore = {
    kind: "disk",
    async list() {
      return known().sort((a, b) => a.name.localeCompare(b.name));
    },
    async create(name, files) {
      const id = await invoke<string>("campaign_create", { name });
      const ref = { id, name };
      for (const f of files ?? [{ path: CAMPAIGN_FILE, content: serializeCampaignMeta(newCampaignMeta(name)) }]) await store.write(ref, f.path, f.content);
      remember(ref);
      return ref;
    },
    async openFolder() {
      const dir = await dialog.open({ directory: true, multiple: false, title: "Open a campaign folder" });
      if (typeof dir !== "string") return null;
      const folderName = dir.split(/[\\/]/).filter(Boolean).pop() ?? "Campaign";
      const files = await store.read({ id: dir, name: folderName });
      const meta = files.find((f) => f.path === CAMPAIGN_FILE);
      const ref = { id: dir, name: parseCampaignMeta(meta?.content, folderName).name };
      if (!meta) await store.write(ref, CAMPAIGN_FILE, serializeCampaignMeta(newCampaignMeta(folderName)));
      remember(ref);
      return ref;
    },
    async forget(ref) {
      settings.set(FOLDERS_KEY, known().filter((r) => r.id !== ref.id));
    },
    async rename(ref, name) {
      if (known().some((r) => r.id === ref.id)) remember({ ...ref, name });
    },
    read: (ref) => invoke<StoredFile[]>("campaign_read", { root: ref.id }),
    write: (ref, path, content) => invoke("campaign_write", { root: ref.id, path, content }),
    move: (ref, from, to) => invoke("campaign_rename", { root: ref.id, from, to }),
    trash: (ref, path) => invoke("campaign_trash", { root: ref.id, path }),
    reveal: (ref) => invoke("reveal_folder", { path: ref.id }),
  };
  return store;
}

interface BrowserCampaign {
  ref: CampaignRef;
  files: Record<string, string>;
}

/** Browser (no file system): each campaign is one IndexedDB record holding its files. */
export function browserStore(newId: () => string): CampaignStore {
  const get = async (ref: CampaignRef): Promise<BrowserCampaign> =>
    (await idbGet<BrowserCampaign>("campaigns", ref.id)) ?? { ref, files: {} };
  const change = async (ref: CampaignRef, fn: (files: Record<string, string>) => void) => {
    const c = await get(ref);
    const files = { ...c.files };
    fn(files);
    await idbPut("campaigns", ref.id, { ...c, files });
  };
  const store: CampaignStore = {
    kind: "browser",
    async list() {
      const all = await idbAll<BrowserCampaign>("campaigns");
      return all.map((c) => c.ref).sort((a, b) => a.name.localeCompare(b.name));
    },
    async create(name, files) {
      const ref = { id: newId(), name };
      const list = files ?? [{ path: CAMPAIGN_FILE, content: serializeCampaignMeta(newCampaignMeta(name)) }];
      await idbPut<BrowserCampaign>("campaigns", ref.id, { ref, files: Object.fromEntries(list.map((f) => [f.path, f.content])) });
      return ref;
    },
    async forget(ref) {
      await idbDelete("campaigns", ref.id);
    },
    async rename(ref, name) {
      const c = await get(ref);
      await idbPut("campaigns", ref.id, { ...c, ref: { ...c.ref, name } });
    },
    async read(ref) {
      return Object.entries((await get(ref)).files).map(([path, content]) => ({ path, content }));
    },
    write: (ref, path, content) => change(ref, (f) => void (f[path] = content)),
    async move(ref, from, to) {
      await change(ref, (f) => {
        if (to in f && from.toLowerCase() !== to.toLowerCase()) throw new Error(`${to} already exists`);
        const content = f[from];
        delete f[from];
        if (content !== undefined) f[to] = content;
      });
    },
    trash: (ref, path) => change(ref, (f) => void delete f[path]),
  };
  return store;
}

let storePromise: Promise<CampaignStore> | null = null;

export function getCampaignStore(newId: () => string): Promise<CampaignStore> {
  if (!storePromise) storePromise = isTauri ? diskStore() : Promise.resolve(browserStore(newId));
  return storePromise;
}

const MIGRATED_KEY = "partiesMovedToCampaigns";

let moving: Promise<number> | null = null;

/**
 * Parties saved before campaigns each become a campaign, once. The parties
 * themselves are left in storage untouched, as a backup.
 */
export function moveOldParties(store: CampaignStore, oldParties: () => Promise<Party[]>): Promise<number> {
  // Once per app run, even if the page mounts twice.
  moving ??= (async () => {
    if (settings.get(MIGRATED_KEY, false)) return 0;
    const list = await oldParties();
    for (const p of list) {
      const { name, files } = campaignFromParty(p);
      await store.create(name, files);
    }
    settings.set(MIGRATED_KEY, true);
    return list.length;
  })();
  return moving;
}

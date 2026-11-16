import { parseNote, renameNote as renameInNotes, serializeNote, type Note } from "@daybreakbuilder/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { CAMPAIGN_FILE, parseCampaignMeta, serializeCampaignMeta, type CampaignMeta, type CampaignRef, type CampaignStore } from "./campaign";

const SAVE_DELAY = 500;

export interface OpenCampaign {
  meta: CampaignMeta;
  notes: Note[];
  error: string | null;
  /** Notes waiting to be written. */
  saving: boolean;
  updateMeta(fn: (m: CampaignMeta) => CampaignMeta): void;
  updateNote(path: string, fn: (n: Note) => Note): void;
  createNote(note: Note): Promise<void>;
  /** Rename a note and fix the links to it; returns the renamed note and how many other notes changed. */
  renameNote(path: string, title: string): Promise<{ note: Note; changed: number } | null>;
  deleteNote(path: string): Promise<void>;
  reload(): Promise<void>;
  /** Write pending edits now. */
  flush(): Promise<void>;
}

/**
 * A campaign loaded into memory. Edits show at once and are written after a
 * short pause; when the window regains focus the files are read again, so
 * changes made in another program (Obsidian, a sync tool) show up.
 */
export function useCampaign(store: CampaignStore, campaign: CampaignRef): { open: OpenCampaign | null; error: string | null } {
  const [state, setState] = useState<{ meta: CampaignMeta; notes: Note[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = useRef<{ meta: CampaignMeta; notes: Note[] } | null>(null);
  /** File contents as last read from or written to storage. */
  const onDisk = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const writes = useRef(new Map<string, () => Promise<void>>());

  const set = useCallback((next: { meta: CampaignMeta; notes: Note[] }) => {
    current.current = next;
    setState(next);
  }, []);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const writeNow = useCallback(
    async (path: string, content: string) => {
      if (onDisk.current.get(path) === content) return;
      await store.write(campaign, path, content);
      onDisk.current.set(path, content);
    },
    [store, campaign],
  );

  const flush = useCallback(async () => {
    const pending = [...writes.current.entries()];
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    writes.current.clear();
    setSaving(false);
    for (const [, run] of pending) await run().catch(fail);
  }, []);

  const schedule = useCallback(
    (path: string, content: () => string) => {
      const run = () => writeNow(path, content());
      writes.current.set(path, run);
      clearTimeout(timers.current.get(path));
      setSaving(true);
      timers.current.set(
        path,
        setTimeout(() => {
          timers.current.delete(path);
          writes.current.delete(path);
          if (!writes.current.size) setSaving(false);
          run().catch(fail);
        }, SAVE_DELAY),
      );
    },
    [writeNow],
  );

  const load = useCallback(
    async (merge: boolean) => {
      const files = await store.read(campaign);
      const prev = current.current;
      const pending = writes.current;
      const metaFile = files.find((f) => f.path === CAMPAIGN_FILE);
      let meta = parseCampaignMeta(metaFile?.content, campaign.name);
      if (merge && prev && (pending.has(CAMPAIGN_FILE) || metaFile?.content === onDisk.current.get(CAMPAIGN_FILE))) meta = prev.meta;
      const notes: Note[] = [];
      for (const f of files) {
        if (!f.path.toLowerCase().endsWith(".md")) continue;
        const mine = prev?.notes.find((n) => n.path === f.path);
        // Keep what is in memory when it is being saved or nothing changed outside the app.
        if (merge && mine && (pending.has(f.path) || onDisk.current.get(f.path) === f.content)) notes.push(mine);
        else notes.push(parseNote(f.path, f.content));
        onDisk.current.set(f.path, f.content);
      }
      // Notes created here and not written yet.
      if (merge && prev) for (const n of prev.notes) if (pending.has(n.path) && !notes.some((x) => x.path === n.path)) notes.push(n);
      if (metaFile) onDisk.current.set(CAMPAIGN_FILE, metaFile.content);
      notes.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
      set({ meta, notes });
    },
    [store, campaign, set],
  );

  useEffect(() => {
    let alive = true;
    onDisk.current = new Map();
    current.current = null;
    setState(null);
    setError(null);
    load(false).catch((e) => alive && fail(e));
    const onFocus = () => void load(true).catch(fail);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      void flush();
    };
  }, [load, flush]);

  // Save before the window closes.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("beforeunload", onHide);
    return () => window.removeEventListener("beforeunload", onHide);
  }, [flush]);

  if (!state) return { open: null, error };

  const noteText = (path: string) => () => {
    const n = current.current?.notes.find((x) => x.path === path);
    return n ? serializeNote(n) : (onDisk.current.get(path) ?? "");
  };

  const open: OpenCampaign = {
    ...state,
    error,
    saving,
    updateMeta(fn) {
      const c = current.current;
      if (!c) return;
      const meta = { ...fn(c.meta), updatedAt: new Date().toISOString() };
      set({ ...c, meta });
      schedule(CAMPAIGN_FILE, () => serializeCampaignMeta(current.current?.meta ?? meta));
      if (meta.name !== c.meta.name) void store.rename(campaign, meta.name);
    },
    updateNote(path, fn) {
      const c = current.current;
      if (!c) return;
      set({ ...c, notes: c.notes.map((n) => (n.path === path ? fn(n) : n)) });
      schedule(path, noteText(path));
    },
    async createNote(note) {
      const c = current.current;
      if (!c) return;
      set({ ...c, notes: [...c.notes, note].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })) });
      await writeNow(note.path, serializeNote(note)).catch(fail);
    },
    async renameNote(path, title) {
      await flush();
      const c = current.current;
      if (!c) return null;
      const r = renameInNotes(c.notes, path, title);
      if (r.renamed.path === path) return { note: r.renamed, changed: 0 };
      try {
        await store.move(campaign, path, r.renamed.path);
      } catch (e) {
        fail(e);
        return null;
      }
      onDisk.current.set(r.renamed.path, onDisk.current.get(path) ?? "");
      onDisk.current.delete(path);
      set({ ...c, notes: r.notes.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })) });
      for (const p of [r.renamed.path, ...r.changed]) {
        const n = r.notes.find((x) => x.path === p);
        if (n) await writeNow(p, serializeNote(n)).catch(fail);
      }
      return { note: r.renamed, changed: r.changed.length };
    },
    async deleteNote(path) {
      clearTimeout(timers.current.get(path));
      timers.current.delete(path);
      writes.current.delete(path);
      const c = current.current;
      if (!c) return;
      try {
        if (onDisk.current.has(path)) await store.trash(campaign, path);
      } catch (e) {
        fail(e);
        return;
      }
      onDisk.current.delete(path);
      set({ ...c, notes: c.notes.filter((n) => n.path !== path) });
    },
    reload: () => load(true).catch(fail),
    flush,
  };
  return { open, error };
}


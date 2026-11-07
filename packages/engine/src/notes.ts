/**
 * Campaign notes: Markdown files with YAML front matter and `[[wiki links]]`,
 * laid out so a campaign folder also works as an Obsidian vault.
 *
 * Only a handful of front matter keys are managed here (type, tags and the
 * session and quest fields); anything else a note's front matter holds is
 * kept exactly as written.
 */

export const NOTE_TYPES = ["general", "npc", "location", "item", "faction", "session", "quest", "table"] as const;
export type KnownNoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<KnownNoteType, string> = {
  general: "Note",
  npc: "NPC",
  location: "Location",
  item: "Item",
  faction: "Faction",
  session: "Session",
  quest: "Quest",
  table: "Random table",
};

export const QUEST_STATUSES = ["open", "done", "failed"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export interface SessionFields {
  number?: number;
  /** Real-world date, YYYY-MM-DD. */
  date?: string;
  inGameDate?: string;
  /** Names of the characters who played. */
  present: string[];
  xp?: number;
  loot?: string;
}

/** One top-level front matter entry as written: its key and its full text (key line plus continuation lines). */
export interface FrontMatterEntry {
  key: string;
  raw: string;
}

export interface Note {
  /** Path inside the campaign folder, with forward slashes ("Notes/Mira the Smith.md"). */
  path: string;
  title: string;
  /** One of NOTE_TYPES, or whatever another tool wrote (kept as is). */
  type: string;
  tags: string[];
  session: SessionFields;
  status: QuestStatus;
  body: string;
  /** Front matter as read, so keys the app does not manage survive a save. */
  frontMatter: FrontMatterEntry[];
}

// ---------------------------------------------------------------------------
// Front matter (a small YAML subset: scalars, quoted strings and lists)

const KEY_LINE = /^([^\s#:-][^:]*?)\s*:(?:\s+(.*)|\s*)$/;

/** Split a file into front matter entries and body. Files without front matter have no entries. */
export function splitFrontMatter(text: string): { entries: FrontMatterEntry[]; body: string } {
  const src = text.replace(/^﻿/, "");
  const m = /^---[ \t]*\r?\n([\s\S]*?)(?:^|\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { entries: [], body: src };
  const entries: FrontMatterEntry[] = [];
  for (const line of m[1].split(/\r?\n/)) {
    const key = KEY_LINE.exec(line);
    if (key && !/^\s/.test(line)) entries.push({ key: key[1].trim(), raw: line });
    else if (entries.length && line.trim() !== "") entries[entries.length - 1].raw += `\n${line}`;
    else if (line.trim() !== "") entries.push({ key: "", raw: line });
  }
  return { entries, body: src.slice(m[0].length) };
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  // Plain scalars can end in a comment.
  return t.replace(/\s+#.*$/, "");
}

function splitInlineList(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(unquote).filter((x) => x !== "");
}

/** The value of an entry: a string, a list of strings, or null when empty. */
export function entryValue(e: FrontMatterEntry): string | string[] | null {
  const [first, ...rest] = e.raw.split("\n");
  const inline = (KEY_LINE.exec(first)?.[2] ?? "").trim();
  if (inline.startsWith("[") && inline.endsWith("]")) return splitInlineList(inline.slice(1, -1));
  if (inline === "" || inline.startsWith("#")) {
    const items = rest.filter((l) => /^\s*-(\s|$)/.test(l)).map((l) => unquote(l.replace(/^\s*-\s?/, "")));
    if (items.length) return items.filter((x) => x !== "");
    if (rest.some((l) => l.trim())) return rest.map((l) => l.trim()).join(" ");
    return null;
  }
  if (inline === "|" || inline === ">" || /^[|>][+-]?$/.test(inline)) {
    const lines = rest.map((l) => l.replace(/^\s{1,2}/, ""));
    return inline.startsWith("|") ? lines.join("\n") : lines.join(" ");
  }
  return unquote(inline);
}

function needsQuotes(s: string): boolean {
  return (
    s === "" ||
    s !== s.trim() ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /:\s|\s#|:$/.test(s) ||
    /\n/.test(s) ||
    /^(true|false|yes|no|on|off|null|~)$/i.test(s) ||
    /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s)
  );
}

function scalar(v: string | number): string {
  if (typeof v === "number") return String(v);
  return needsQuotes(v) ? JSON.stringify(v) : v;
}

function entry(key: string, value: string | number | string[]): string {
  if (Array.isArray(value)) return `${key}:\n${value.map((v) => `  - ${scalar(v)}`).join("\n")}`;
  return `${key}: ${scalar(value)}`;
}

// ---------------------------------------------------------------------------
// Notes

const MANAGED = ["type", "tags", "status", "session", "date", "in_game_date", "present", "xp", "loot"] as const;

const asList = (v: string | string[] | null): string[] =>
  v === null ? [] : Array.isArray(v) ? v : v.split(/[,\s]+/).filter(Boolean);
const asString = (v: string | string[] | null): string | undefined => (v === null ? undefined : Array.isArray(v) ? v.join(", ") : v);
const asNumber = (v: string | string[] | null): number | undefined => {
  const s = asString(v);
  if (s === undefined || s.trim() === "") return undefined;
  const n = Number(s.replace(/[_,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
/** A list of names: a YAML list, or one string separated by commas. */
const names = (v: string | string[] | null): string[] =>
  (v === null ? [] : Array.isArray(v) ? v : v.split(",")).map((x) => stripLink(x)).filter(Boolean);
/** "[[Mira]]" → "Mira" (Obsidian writes links in list properties that way). */
const stripLink = (s: string) => s.replace(/^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/, "$1").trim();

export function titleFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

export function parseNote(path: string, text: string): Note {
  const { entries, body } = splitFrontMatter(text);
  const get = (key: string) => {
    const e = entries.find((x) => x.key.toLowerCase() === key);
    return e ? entryValue(e) : null;
  };
  const type = (asString(get("type")) ?? "general").trim().toLowerCase() || "general";
  const status = (asString(get("status")) ?? "open").trim().toLowerCase();
  return {
    path,
    title: titleFromPath(path),
    type,
    tags: asList(get("tags")).map((t) => t.replace(/^#/, "")),
    session: {
      number: asNumber(get("session")),
      date: asString(get("date")),
      inGameDate: asString(get("in_game_date")),
      present: names(get("present")),
      xp: asNumber(get("xp")),
      loot: asString(get("loot")),
    },
    status: (QUEST_STATUSES as readonly string[]).includes(status) ? (status as QuestStatus) : "open",
    body,
    frontMatter: entries,
  };
}

/** The managed front matter of a note, in the order new keys are written. */
function managedEntries(n: Note): Map<string, string | number | string[]> {
  const out = new Map<string, string | number | string[]>();
  const had = (k: string) => n.frontMatter.some((e) => e.key.toLowerCase() === k);
  if (n.type !== "general" || had("type")) out.set("type", n.type);
  if (n.tags.length) out.set("tags", n.tags);
  if (n.type === "quest" || had("status")) out.set("status", n.status);
  if (n.type === "session" || had("session")) {
    const s = n.session;
    if (s.number !== undefined) out.set("session", s.number);
    if (s.date) out.set("date", s.date);
    if (s.inGameDate) out.set("in_game_date", s.inGameDate);
    if (s.present.length) out.set("present", s.present);
    if (s.xp !== undefined) out.set("xp", s.xp);
    if (s.loot) out.set("loot", s.loot);
  }
  return out;
}

export function serializeNote(n: Note): string {
  const managed = managedEntries(n);
  const lines: string[] = [];
  const written = new Set<string>();
  for (const e of n.frontMatter) {
    const key = e.key.toLowerCase();
    if (!(MANAGED as readonly string[]).includes(key)) {
      lines.push(e.raw);
      continue;
    }
    const v = managed.get(key);
    if (v === undefined || written.has(key)) continue;
    // Keep the value exactly as written when it has not changed.
    const before = entryValue(e);
    const same = JSON.stringify(Array.isArray(v) ? v : String(v)) === JSON.stringify(Array.isArray(before) ? before : before === null ? null : String(before));
    lines.push(same ? e.raw : entry(e.key, v));
    written.add(key);
  }
  for (const [key, v] of managed) if (!written.has(key)) lines.push(entry(key, v));
  if (!lines.length) return n.body;
  return `---\n${lines.join("\n")}\n---\n${n.body}`;
}

export const FOLDERS: Record<string, string> = { session: "Sessions", quest: "Quests", table: "Tables" };

export function folderForType(type: string): string {
  return FOLDERS[type] ?? "Notes";
}

/** A title that is also a valid file name on Windows, macOS and Linux (and a valid link target). */
export function safeTitle(title: string): string {
  const t = title
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 120)
    .trim();
  if (!t || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) return t ? `${t} note` : "Untitled";
  return t;
}

/** `title`, or `title 2`, `title 3`… if a note already has it (titles are unique case-insensitively, like file names). */
export function uniqueTitle(title: string, notes: Note[], except?: string): string {
  const taken = new Set(notes.filter((n) => n.path !== except).map((n) => n.title.toLowerCase()));
  const base = safeTitle(title);
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export function nextSessionNumber(notes: Note[]): number {
  return Math.max(0, ...notes.filter((n) => n.type === "session").map((n) => n.session.number ?? 0)) + 1;
}

export function newNote(type: string, title: string, notes: Note[], fields: Partial<Pick<Note, "tags" | "body" | "status">> & { session?: Partial<SessionFields> } = {}): Note {
  const t = uniqueTitle(title, notes);
  return {
    path: `${folderForType(type)}/${t}.md`,
    title: t,
    type,
    tags: fields.tags ?? [],
    session: { present: [], ...fields.session },
    status: fields.status ?? "open",
    body: fields.body ?? "",
    frontMatter: [],
  };
}

/** The same note under a new title, in the same folder. */
export function retitle(n: Note, title: string): Note {
  const dir = n.path.includes("/") ? n.path.slice(0, n.path.lastIndexOf("/") + 1) : "";
  return { ...n, title, path: `${dir}${title}.md` };
}

// ---------------------------------------------------------------------------
// Links

export interface WikiLink {
  from: number;
  to: number;
  target: string;
  heading?: string;
  alias?: string;
  embed: boolean;
}

const LINK_RE = /(!?)\[\[([^[\]\n]+?)\]\]/g;

export function parseLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of text.matchAll(LINK_RE)) {
    const inner = m[2];
    const bar = inner.indexOf("|");
    const ref = bar === -1 ? inner : inner.slice(0, bar);
    const hash = ref.indexOf("#");
    const target = (hash === -1 ? ref : ref.slice(0, hash)).trim();
    if (!target) continue;
    out.push({
      from: m.index,
      to: m.index + m[0].length,
      target,
      heading: hash === -1 ? undefined : ref.slice(hash + 1).trim() || undefined,
      alias: bar === -1 ? undefined : inner.slice(bar + 1).trim() || undefined,
      embed: m[1] === "!",
    });
  }
  return out;
}

const norm = (s: string) => s.trim().replace(/\.md$/i, "").replace(/\\/g, "/").toLowerCase();

/** The note a link target names: by title, or by path when it has a folder ("Notes/Mira"). Shortest path wins a tie. */
export function resolveNote(target: string, notes: Note[]): Note | undefined {
  const t = norm(target);
  if (!t) return undefined;
  const byPath = (n: Note) => norm(n.path);
  const matches = t.includes("/")
    ? notes.filter((n) => byPath(n) === t || byPath(n).endsWith(`/${t}`))
    : notes.filter((n) => n.title.toLowerCase() === t);
  return matches.sort((a, b) => a.path.length - b.path.length)[0];
}

/**
 * Rename a note's links: every link in `text` that points at the note at `path`
 * (resolved against `notes`, the notes before the rename) is pointed at `newTitle`,
 * keeping its heading, alias and folder prefix.
 */
export function renameLinksInText(text: string, notes: Note[], path: string, newTitle: string): string {
  let out = "";
  let at = 0;
  for (const l of parseLinks(text)) {
    if (resolveNote(l.target, notes)?.path !== path) continue;
    const slash = l.target.lastIndexOf("/");
    const target = slash === -1 ? newTitle : `${l.target.slice(0, slash + 1)}${newTitle}`;
    const inner = `${target}${l.heading ? `#${l.heading}` : ""}${l.alias ? `|${l.alias}` : ""}`;
    out += `${text.slice(at, l.from)}${l.embed ? "!" : ""}[[${inner}]]`;
    at = l.to;
  }
  return out + text.slice(at);
}

/**
 * Rename a note and fix every link to it. Returns all notes after the rename
 * (the renamed one under its new path) and the paths whose contents changed.
 */
export function renameNote(notes: Note[], path: string, title: string): { notes: Note[]; renamed: Note; changed: string[] } {
  const note = notes.find((n) => n.path === path);
  if (!note) throw new Error(`No note at ${path}`);
  const newTitle = uniqueTitle(title, notes, path);
  const renamed = retitle(note, newTitle);
  const changed: string[] = [];
  const next = notes.map((n) => {
    let body = renameLinksInText(n.body, notes, path, newTitle);
    // A note whose first line is its title as a heading ("# Mira") keeps them matching.
    if (n.path === path) body = body.replace(new RegExp(`^(#\\s+)${escapeRegExp(note.title)}[ \\t]*$`, "m"), (m, h: string, offset: number) => (body.slice(0, offset).trim() ? m : `${h}${newTitle}`));
    const base = n.path === path ? renamed : n;
    if (body === n.body) return base;
    if (n.path !== path) changed.push(n.path);
    return { ...base, body };
  });
  return { notes: next, renamed: next.find((n) => n.path === renamed.path) ?? renamed, changed };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Backlink {
  note: Note;
  /** Lines of the linking note that mention the target. */
  lines: string[];
}

/** Notes that link to `note`, with the lines the links are on. */
export function backlinks(notes: Note[], note: Note): Backlink[] {
  const out: Backlink[] = [];
  for (const n of notes) {
    if (n.path === note.path) continue;
    const lines = n.body
      .split("\n")
      .filter((line) => parseLinks(line).some((l) => resolveNote(l.target, notes)?.path === note.path))
      .map((l) => l.trim());
    if (lines.length) out.push({ note: n, lines });
  }
  return out.sort((a, b) => a.note.title.localeCompare(b.note.title, undefined, { numeric: true }));
}

/** Link targets in the notes that match no note (yet). */
export function unresolvedTargets(notes: Note[]): string[] {
  const out = new Set<string>();
  for (const n of notes) for (const l of parseLinks(n.body)) if (!resolveNote(l.target, notes)) out.add(l.target);
  return [...out];
}

// ---------------------------------------------------------------------------
// Search

export interface SearchSnippet {
  text: string;
  /** [start, end) offsets of matches in `text`. */
  ranges: [number, number][];
}

export interface SearchHit {
  note: Note;
  score: number;
  titleRanges: [number, number][];
  snippets: SearchSnippet[];
}

/** Lowercase without accents, one character per character so offsets still line up. */
function fold(s: string): string {
  let out = "";
  for (const ch of s) {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const lower = (base.length === 1 ? base : ch).toLowerCase();
    // Keep the string length the same as the input (in UTF-16 units).
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/** Search terms: words, or "quoted phrases". */
export function searchTerms(query: string): string[] {
  const out: string[] = [];
  for (const m of query.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = fold((m[1] ?? m[2]).trim());
    if (t) out.push(t);
  }
  return out;
}

function ranges(text: string, terms: string[]): [number, number][] {
  const f = fold(text);
  const out: [number, number][] = [];
  for (const t of terms) for (let i = f.indexOf(t); i !== -1; i = f.indexOf(t, i + t.length)) out.push([i, i + t.length]);
  out.sort((a, b) => a[0] - b[0]);
  // Merge overlaps.
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

const SNIPPET = 160;

/** Text with each `[[link]]` replaced by what it shows (its alias, or its target). */
export function plainLinks(text: string): string {
  return text.replace(/!?\[\[([^[\]\n|#]*)(?:#[^[\]\n|]*)?(?:\|([^[\]\n]*))?\]\]/g, (_, target: string, alias?: string) => (alias ?? target).trim());
}

function snippet(line: string, terms: string[]): SearchSnippet {
  let text = plainLinks(line).trim();
  let r = ranges(text, terms);
  if (text.length > SNIPPET && r.length) {
    const start = Math.max(0, Math.min(r[0][0] - 40, text.length - SNIPPET));
    const cut = text.slice(start, start + SNIPPET);
    const prefix = start > 0 ? "…" : "";
    const suffix = start + SNIPPET < text.length ? "…" : "";
    text = `${prefix}${cut}${suffix}`;
    r = ranges(text, terms);
  }
  return { text, ranges: r };
}

export interface SearchFilter {
  type?: string;
  tag?: string;
}

/**
 * Full-text search over notes: every term must appear in the title, tags or
 * text. Title matches rank first. An empty query lists the notes the filter
 * keeps, by title.
 */
export function searchNotes(notes: Note[], query: string, filter: SearchFilter = {}): SearchHit[] {
  const terms = searchTerms(query);
  const tag = filter.tag?.toLowerCase();
  const kept = notes.filter((n) => (!filter.type || n.type === filter.type) && (!tag || n.tags.some((t) => t.toLowerCase() === tag)));
  if (!terms.length) {
    return kept
      .map((note) => ({ note, score: 0, titleRanges: [], snippets: [] }))
      .sort((a, b) => a.note.title.localeCompare(b.note.title, undefined, { numeric: true }));
  }
  const hits: SearchHit[] = [];
  for (const note of kept) {
    const title = fold(note.title);
    const tags = note.tags.map(fold).join(" ");
    const body = fold(note.body);
    if (!terms.every((t) => title.includes(t) || tags.includes(t) || body.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 10;
      if (tags.includes(t)) score += 5;
      for (let i = body.indexOf(t); i !== -1 && score < 1000; i = body.indexOf(t, i + t.length)) score += 1;
    }
    const lines = note.body.split("\n").filter((l) => terms.some((t) => fold(l).includes(t)));
    hits.push({ note, score, titleRanges: ranges(note.title, terms), snippets: lines.slice(0, 3).map((l) => snippet(l, terms)) });
  }
  return hits.sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title, undefined, { numeric: true }));
}

/** Every tag used in the notes, most used first. */
export function allTags(notes: Note[]): string[] {
  const count = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// ---------------------------------------------------------------------------
// Templates (the Obsidian convention: notes in a Templates folder)

export const TEMPLATES_FOLDER = "Templates";

export function isTemplate(n: Pick<Note, "path">): boolean {
  return n.path.toLowerCase().startsWith(`${TEMPLATES_FOLDER.toLowerCase()}/`);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fill a template's {{title}}, {{date}} and {{time}}. */
export function fillTemplate(text: string, title: string, now = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return text.replace(/\{\{\s*(title|date|time)\s*\}\}/gi, (_, k: string) => (k.toLowerCase() === "title" ? title : k.toLowerCase() === "date" ? date : time));
}

/** A new note made from a template: its type, tags, other front matter and text, under a new title. */
export function noteFromTemplate(template: Note, title: string, notes: Note[], now = new Date()): Note {
  const n = newNote(template.type, title, notes);
  return {
    ...n,
    tags: [...template.tags],
    status: template.status,
    session: { ...template.session, present: [...template.session.present] },
    frontMatter: template.frontMatter.map((e) => ({ ...e, raw: fillTemplate(e.raw, n.title, now) })),
    body: fillTemplate(template.body, n.title, now),
  };
}

/** The template for a type, if the campaign has one named after it ("NPC", "Session"…) or of that type. */
export function templateForType(type: string, notes: Note[]): Note | undefined {
  const templates = notes.filter(isTemplate);
  const label = (NOTE_TYPE_LABELS[type as KnownNoteType] ?? type).toLowerCase();
  return templates.find((t) => t.title.toLowerCase() === label) ?? templates.find((t) => t.type === type);
}

export const STARTER_TEMPLATES: { title: string; type: string; body: string }[] = [
  { title: "NPC", type: "npc", body: "**Role:** \n**Where:** \n\n## Look and manner\n\n## Wants\n\n## Knows\n\n## Secrets\n" },
  { title: "Location", type: "location", body: "**Region:** \n\n## What the party sees\n\n## People here\n\n## Hooks\n" },
  { title: "Faction", type: "faction", body: "**Leader:** \n**Base:** \n\n## Goals\n\n## Allies and enemies\n\n## What the party owes them\n" },
  { title: "Item", type: "item", body: "**Owner:** \n\n## Description\n\n## History\n" },
  { title: "Session", type: "session", body: "## Recap\n\n## Scenes\n\n- \n\n## Loose ends\n\n- [ ] \n" },
  { title: "Quest", type: "quest", body: "**Given by:** \n**Reward:** \n\n## Goal\n\n## Leads\n\n- [ ] \n" },
  { title: "Random table", type: "table", body: "| d6 | Result |\n| --- | --- |\n| 1 | |\n| 2 | |\n| 3 | |\n| 4 | |\n| 5 | |\n| 6 | |\n" },
];

/** Starter templates the campaign doesn't have yet, as notes in the Templates folder. */
export function starterTemplates(notes: Note[]): Note[] {
  const taken = new Set(notes.map((n) => n.path.toLowerCase()));
  return STARTER_TEMPLATES.filter((t) => !taken.has(`${TEMPLATES_FOLDER}/${t.title}.md`.toLowerCase())).map((t) => ({
    path: `${TEMPLATES_FOLDER}/${t.title}.md`,
    title: t.title,
    type: t.type,
    tags: [],
    session: { present: [] },
    status: "open",
    body: t.body,
    frontMatter: [],
  }));
}

// ---------------------------------------------------------------------------
// Images

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"];
export const ATTACHMENTS_FOLDER = "Attachments";

export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return path.includes(".") && IMAGE_EXTENSIONS.includes(ext);
}

/**
 * The image a link or Markdown image points at: by file name anywhere in the
 * campaign (`![[map.png]]`), or by path from the campaign or the note's folder.
 */
export function resolveAsset(target: string, assets: string[], fromNote?: string): string | undefined {
  let t = target.trim().replace(/\\/g, "/");
  try {
    t = decodeURI(t);
  } catch {
    /* keep as written */
  }
  t = t.replace(/^\.\//, "").replace(/^\//, "").toLowerCase();
  if (!t) return undefined;
  const byLower = assets.map((a) => [a, a.toLowerCase()] as const);
  if (t.includes("/")) {
    const dir = fromNote?.includes("/") ? fromNote.slice(0, fromNote.lastIndexOf("/") + 1).toLowerCase() : "";
    return (byLower.find(([, a]) => a === t) ?? byLower.find(([, a]) => a === dir + t) ?? byLower.find(([, a]) => a.endsWith(`/${t}`)))?.[0];
  }
  return byLower.filter(([, a]) => a === t || a.endsWith(`/${t}`)).sort((a, b) => a[0].length - b[0].length)[0]?.[0];
}

/** Where a new image goes: the Attachments folder, under a free, file-safe name. */
export function attachmentPath(fileName: string, assets: string[]): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "png";
  const stem = safeTitle(dot > 0 ? fileName.slice(0, dot) : fileName) || "image";
  const taken = new Set(assets.map((a) => (a.split("/").pop() ?? a).toLowerCase()));
  let name = `${stem}.${ext}`;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${stem} ${i}.${ext}`;
  return `${ATTACHMENTS_FOLDER}/${name}`;
}

// ---------------------------------------------------------------------------
// Graph

export interface GraphNode {
  path: string;
  title: string;
  type: string;
  /** Links in and out. */
  degree: number;
}

export interface NoteGraph {
  nodes: GraphNode[];
  /** Pairs of node indexes, each pair once. */
  edges: [number, number][];
}

/** Notes and the links between them (templates left out). */
export function noteGraph(notes: Note[]): NoteGraph {
  const list = notes.filter((n) => !isTemplate(n));
  const index = new Map(list.map((n, i) => [n.path, i]));
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  const degree = list.map(() => 0);
  list.forEach((n, i) => {
    for (const l of parseLinks(n.body)) {
      const target = resolveNote(l.target, list);
      const j = target ? index.get(target.path) : undefined;
      if (j === undefined || j === i) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(i < j ? [i, j] : [j, i]);
      degree[i]++;
      degree[j]++;
    }
  });
  return { nodes: list.map((n, i) => ({ path: n.path, title: n.title, type: n.type, degree: degree[i] })), edges };
}

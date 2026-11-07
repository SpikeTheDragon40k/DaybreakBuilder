/**
 * Random tables written in campaign notes, and the dice expressions inside
 * their results ("2d6 goblins"). A table is the first Markdown table in a
 * note (with a d6/d20/d100 column of numbers or ranges, or one result per
 * row) or, failing that, the first bulleted or numbered list.
 */
import { parseLinks, resolveNote, type Note } from "./notes.js";

/** A random number in [0, 1). */
export type Rng = () => number;

export interface TableEntry {
  min: number;
  max: number;
  text: string;
}

export interface RandomTable {
  /** Size of the die rolled (the highest number in the table, or the number of entries). */
  die: number;
  entries: TableEntry[];
}

const RANGE = /^\s*(\d+)\s*(?:[-–—]\s*(\d+)|\+)?\s*$/;
const DIE_HEADER = /^\s*\d*d(\d+)\s*$/i;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** "00" on a d100 means 100. */
const num = (s: string, die: number) => (Number(s) === 0 && die === 100 ? 100 : Number(s));

function fromMarkdownTable(lines: string[]): RandomTable | null {
  const start = lines.findIndex((l, i) => /^\s*\|/.test(l) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? ""));
  if (start === -1) return null;
  const header = cells(lines[start]);
  const rows: string[][] = [];
  for (let i = start + 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
  if (!rows.length) return null;
  const headerDie = DIE_HEADER.exec(header[0] ?? "");
  const numbered = header.length > 1 && rows.every((r) => RANGE.test(r[0] ?? ""));
  if (headerDie || numbered) {
    const die = headerDie ? Number(headerDie[1]) : 0;
    const entries: TableEntry[] = [];
    for (const r of rows) {
      const m = RANGE.exec(r[0] ?? "");
      if (!m) continue;
      const min = num(m[1], die);
      const max = m[2] !== undefined ? num(m[2], die) : r[0].includes("+") ? Math.max(min, die) : min;
      entries.push({ min, max, text: r.slice(1).filter(Boolean).join(" — ") });
    }
    if (!entries.length) return null;
    return { die: Math.max(die, ...entries.map((e) => e.max)), entries };
  }
  const texts = rows.map((r) => r.filter(Boolean).join(" — ")).filter(Boolean);
  return texts.length ? { die: texts.length, entries: texts.map((text, i) => ({ min: i + 1, max: i + 1, text })) } : null;
}

function fromList(lines: string[]): RandomTable | null {
  const items: string[] = [];
  let started = false;
  for (const l of lines) {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(l);
    if (m) {
      items.push(m[1].trim());
      started = true;
    } else if (started && l.trim() === "") break;
    else if (started) break;
  }
  return items.length ? { die: items.length, entries: items.map((text, i) => ({ min: i + 1, max: i + 1, text })) } : null;
}

export function parseRandomTable(body: string): RandomTable | null {
  const lines = body.split(/\r?\n/);
  return fromMarkdownTable(lines) ?? fromList(lines);
}

export function rollDie(sides: number, rng: Rng): number {
  return 1 + Math.floor(rng() * Math.max(1, sides));
}

/** The entry for a roll; a roll that falls in a gap takes the nearest entry below it. */
export function entryFor(table: RandomTable, roll: number): TableEntry {
  const hit = table.entries.find((e) => roll >= e.min && roll <= e.max);
  if (hit) return hit;
  const below = table.entries.filter((e) => e.max < roll).sort((a, b) => b.max - a.max)[0];
  return below ?? table.entries[0];
}

const DICE = /\b(\d{0,2})d(\d{1,3})(?:\s*([+\-×x*])\s*(\d{1,4}))?\b/g;

/** Roll the dice expressions in a text: "2d6 goblins" → "7 goblins (2d6)". */
export function rollDiceIn(text: string, rng: Rng): string {
  return text.replace(DICE, (whole, n: string, sides: string, op?: string, k?: string) => {
    const count = Math.min(100, n ? Number(n) : 1);
    const s = Number(sides);
    if (!count || !s) return whole;
    let total = 0;
    for (let i = 0; i < count; i++) total += rollDie(s, rng);
    if (op && k) {
      const v = Number(k);
      total = op === "+" ? total + v : op === "-" ? total - v : total * v;
    }
    return `${total} (${whole.replace(/\s+/g, "")})`;
  });
}

export interface TableRoll {
  table: string;
  roll: number;
  die: number;
  text: string;
}

/**
 * Roll a table note. Dice in the result are rolled too, and a result that links
 * to another table note ("[[Gems]]") rolls that table in its place (up to a
 * few levels deep, so tables can't loop forever).
 */
export function rollNoteTable(note: Note, notes: Note[], rng: Rng, depth = 0): TableRoll | null {
  const table = parseRandomTable(note.body);
  if (!table) return null;
  const roll = rollDie(table.die, rng);
  const raw = entryFor(table, roll).text;
  // Dice outside links are rolled here; a link to another table is replaced by that table's (already rolled) result.
  let text = "";
  let at = 0;
  for (const l of parseLinks(raw)) {
    text += rollDiceIn(raw.slice(at, l.from), rng);
    const target = depth < 4 ? resolveNote(l.target, notes) : undefined;
    const inner = target && target.path !== note.path ? rollNoteTable(target, notes, rng, depth + 1) : null;
    text += inner ? inner.text : raw.slice(l.from, l.to);
    at = l.to;
  }
  text += rollDiceIn(raw.slice(at), rng);
  return { table: note.title, roll, die: table.die, text };
}

/** A small seeded generator for repeatable tests (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

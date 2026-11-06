/**
 * Initiative tracker: turn order, rounds, hit points, conditions with
 * durations and concentration for an encounter. Dice are rolled at the table;
 * the GM types initiative results (or uses the fixed 10 + bonus).
 *
 * Player characters keep their hit points and conditions in their own Play
 * state (see play.ts); the tracker only stores turn order, initiative and
 * condition durations for them.
 */
import { getSetter, type ElementDef } from "./model.js";
import type { ContentRegistry } from "./registry.js";

export interface TrackedCondition {
  name: string;
  /** Rounds left, counted down at the start of the affected creature's turn; absent = until removed. */
  rounds?: number;
}

export interface Combatant {
  id: string;
  kind: "character" | "monster";
  name: string;
  /** Saved character (kind "character"). */
  characterId?: string;
  /** Creature or stat block element in the loaded content, for the stat block. */
  elementId?: string;
  /** Rolled initiative total; null until entered. */
  initiative: number | null;
  initiativeBonus: number;
  ac: number;
  /** Monsters only; characters use their Play state. */
  maxHp: number;
  hp: number;
  tempHp: number;
  conditions: TrackedCondition[];
  concentrating: boolean;
  /** Legendary actions per round, if any. */
  legendary?: { max: number; used: number };
  defeated: boolean;
  note: string;
}

export interface Combat {
  /** 0 before the first turn. */
  round: number;
  /** Id of the combatant whose turn it is (null before the first turn). */
  turnId: string | null;
  combatants: Combatant[];
  /** Newest last. */
  log: string[];
}

export const COMBAT_LOG_LIMIT = 100;

export function newCombat(): Combat {
  return { round: 0, turnId: null, combatants: [], log: [] };
}

export function newCombatant(id: string, fields: Partial<Combatant> & Pick<Combatant, "name" | "kind">): Combatant {
  return {
    id,
    initiative: null,
    initiativeBonus: 0,
    ac: 10,
    maxHp: 0,
    hp: 0,
    tempHp: 0,
    conditions: [],
    concentrating: false,
    defeated: false,
    note: "",
    ...fields,
  };
}

export function logCombat(c: Combat, text: string): Combat {
  return { ...c, log: [...c.log, text].slice(-COMBAT_LOG_LIMIT) };
}

/** Turn order: highest initiative first; ties go to the higher bonus, then by name. Missing initiative goes last. */
export function turnOrder(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort(
    (a, b) =>
      (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) || b.initiativeBonus - a.initiativeBonus || a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

/** The fixed initiative some GMs use for monsters: 10 + bonus. */
export function fixedInitiative(c: Combatant): number {
  return 10 + c.initiativeBonus;
}

export function updateCombatant(c: Combat, id: string, fn: (x: Combatant) => Combatant): Combat {
  return { ...c, combatants: c.combatants.map((x) => (x.id === id ? fn(x) : x)) };
}

/**
 * Start of a creature's turn: condition durations count down (and run out),
 * legendary actions come back.
 */
function startTurn(c: Combat, id: string): Combat {
  const who = c.combatants.find((x) => x.id === id);
  if (!who) return c;
  const ended: string[] = [];
  const conditions = who.conditions.flatMap((cond) => {
    if (cond.rounds === undefined) return [cond];
    const rounds = cond.rounds - 1;
    if (rounds <= 0) {
      ended.push(cond.name);
      return [];
    }
    return [{ ...cond, rounds }];
  });
  let next = updateCombatant(c, id, (x) => ({ ...x, conditions, legendary: x.legendary ? { ...x.legendary, used: 0 } : undefined }));
  next = { ...next, turnId: id };
  if (ended.length) next = logCombat(next, `${who.name}: ${ended.join(", ")} ended.`);
  return next;
}

/** Next creature in the order (skipping defeated ones); a new round after the last. */
export function nextTurn(c: Combat): Combat {
  const order = turnOrder(c.combatants).filter((x) => !x.defeated && x.initiative !== null);
  if (order.length === 0) return c;
  const at = order.findIndex((x) => x.id === c.turnId);
  if (c.round === 0) return startTurn(logCombat({ ...c, round: 1 }, `Round 1: ${order[0].name} goes first.`), order[0].id);
  // The creature whose turn it was is gone: carry on from the top of the order.
  if (at === -1) return startTurn(c, order[0].id);
  if (at === order.length - 1) {
    const round = c.round + 1;
    return startTurn(logCombat({ ...c, round }, `Round ${round}.`), order[0].id);
  }
  return startTurn(c, order[at + 1].id);
}

/** Back one turn (durations are not given back; fix them by hand if needed). */
export function previousTurn(c: Combat): Combat {
  const order = turnOrder(c.combatants).filter((x) => !x.defeated && x.initiative !== null);
  const at = order.findIndex((x) => x.id === c.turnId);
  if (at === -1 || c.round === 0) return c;
  if (at === 0) {
    if (c.round <= 1) return c;
    return { ...c, round: c.round - 1, turnId: order[order.length - 1].id };
  }
  return { ...c, turnId: order[at - 1].id };
}

/** Concentration save after taking damage (2024 and 2014): DC 10 or half the damage, whichever is higher (max 30). */
export function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

/** Damage to a monster: temporary hit points first; at 0 it is marked defeated. */
export function damageMonster(c: Combat, id: string, amount: number): Combat {
  const who = c.combatants.find((x) => x.id === id);
  const dmg = Math.max(0, Math.floor(amount));
  if (!who || dmg === 0) return c;
  const fromTemp = Math.min(who.tempHp, dmg);
  const hp = Math.max(0, who.hp - (dmg - fromTemp));
  let next = updateCombatant(c, id, (x) => ({ ...x, tempHp: x.tempHp - fromTemp, hp, defeated: hp === 0 ? true : x.defeated }));
  let text = `${who.name} takes ${dmg} damage (${hp}/${who.maxHp} HP)`;
  if (hp === 0) text += " and drops";
  else if (who.concentrating) text += `; Constitution save DC ${concentrationDc(dmg)} to keep concentrating`;
  next = logCombat(next, `${text}.`);
  return next;
}

export function healMonster(c: Combat, id: string, amount: number): Combat {
  const who = c.combatants.find((x) => x.id === id);
  const n = Math.max(0, Math.floor(amount));
  if (!who || n === 0) return c;
  const hp = Math.min(who.maxHp, who.hp + n);
  return logCombat(
    updateCombatant(c, id, (x) => ({ ...x, hp, defeated: hp > 0 ? false : x.defeated })),
    `${who.name} heals ${n} (${hp}/${who.maxHp} HP).`,
  );
}

// ---------------------------------------------------------------------------
// Monsters from the loaded content

export interface MonsterTemplate {
  elementId: string;
  name: string;
  source: string;
  challenge: string;
  ac: number;
  hp: number;
  initiativeBonus: number;
}

const firstNumber = (s: string | undefined) => {
  const m = /-?\d+/.exec(s ?? "");
  return m ? Number(m[0]) : undefined;
};
const modifier = (score: number | undefined) => (score === undefined ? 0 : Math.floor((score - 10) / 2));

/** Stat block text ("<b>AC</b> 15", "<b>Initiative</b> +2 (12)", "<b>HP</b> 52 (8d8 + 16)", "<b>CR</b> 2"). */
function fromStatBlock(html: string): { ac?: number; hp?: number; init?: number; cr?: string } {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const num = (label: string) => {
    const m = new RegExp(`\\b${label}\\s*([+−-]?\\s*\\d+)`).exec(text);
    return m ? Number(m[1].replace(/[−\s]/g, (ch) => (ch === "−" ? "-" : ""))) : undefined;
  };
  const cr = /\bCR\s*([\d/]+)/.exec(text)?.[1];
  return { ac: num("AC"), hp: num("HP"), init: num("Initiative"), cr };
}

/**
 * Creatures that can be added to an encounter: companion-style creatures
 * (stats in setters) and stat blocks written as text (AC, HP, Initiative).
 * One entry per name and source; a structured creature wins over a text one.
 */
export function monsterTemplates(registry: ContentRegistry): MonsterTemplate[] {
  const out = new Map<string, MonsterTemplate>();
  const key = (el: ElementDef) => `${el.name.toLowerCase()}|${el.source}`;
  for (const el of registry.ofType("Information")) {
    if (!/\bAC\b/.test(el.description) || !/\bHP\b/.test(el.description)) continue;
    const s = fromStatBlock(el.description);
    if (s.ac === undefined || s.hp === undefined) continue;
    out.set(key(el), { elementId: el.id, name: el.name, source: el.source, challenge: s.cr ?? "", ac: s.ac, hp: s.hp, initiativeBonus: s.init ?? 0 });
  }
  for (const el of registry.ofType("Companion")) {
    const ac = firstNumber(getSetter(el, "ac"));
    const hp = firstNumber(getSetter(el, "hp"));
    if (ac === undefined || hp === undefined) continue;
    const text = out.get(key(el));
    out.set(key(el), {
      // Prefer the stat block for display when there is one.
      elementId: text?.elementId ?? el.id,
      name: el.name,
      source: el.source,
      challenge: getSetter(el, "challenge") ?? text?.challenge ?? "",
      ac,
      hp,
      initiativeBonus: text?.initiativeBonus ?? modifier(firstNumber(getSetter(el, "dexterity"))),
    });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Letter label for the n-th (0-based) monster of a kind: A…Z, then AA, AB… like spreadsheet columns. */
export function monsterLetter(n: number): string {
  let s = "";
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/**
 * Monsters for an encounter. Several of a kind are told apart by letters
 * ("Goblin A", "Goblin B"…), continuing after any already in the encounter,
 * so they match the letters on the minis or tokens at the table.
 */
export function monsterCombatants(
  t: Omit<MonsterTemplate, "elementId" | "source" | "challenge"> & { elementId?: string },
  count: number,
  newId: () => string,
  existing: Combatant[] = [],
): Combatant[] {
  const same = existing.filter((x) => x.kind === "monster" && (x.name === t.name || x.name.startsWith(`${t.name} `)));
  const lettered = count > 1 || same.length > 0;
  return Array.from({ length: Math.max(1, count) }, (_, i) =>
    newCombatant(newId(), {
      kind: "monster",
      name: lettered ? `${t.name} ${monsterLetter(same.length + i)}` : t.name,
      elementId: t.elementId,
      ac: t.ac,
      maxHp: t.hp,
      hp: t.hp,
      initiativeBonus: t.initiativeBonus,
    }),
  );
}

/** Add monsters of one kind; a lone unlettered one of the same kind becomes "… A" so the letters line up. */
export function addMonsters(
  c: Combat,
  t: Omit<MonsterTemplate, "elementId" | "source" | "challenge"> & { elementId?: string },
  count: number,
  newId: () => string,
): Combat {
  let combatants = c.combatants;
  const lone = combatants.filter((x) => x.kind === "monster" && x.name === t.name);
  if (lone.length === 1 && !combatants.some((x) => x.kind === "monster" && x.name.startsWith(`${t.name} `))) {
    combatants = combatants.map((x) => (x.id === lone[0].id ? { ...x, name: `${t.name} A` } : x));
  }
  const added = monsterCombatants(t, count, newId, combatants);
  return logCombat({ ...c, combatants: [...combatants, ...added] }, `Added ${added.map((x) => x.name).join(", ")}.`);
}

import type { Ability } from "./model.js";

export type EquipSlot = "armor" | "main" | "offhand" | "worn";

export interface InventoryItem {
  /** Stable per-character identifier. */
  uid: string;
  /** Element id of the item (Item, Weapon, Armor or Magic Item). */
  id: string;
  quantity: number;
  equipped?: EquipSlot;
  attuned?: boolean;
  /** Optional custom name / notes. */
  name?: string;
  notes?: string;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface CharacterDetails {
  gender: string;
  age: string;
  height: string;
  weight: string;
  eyes: string;
  skin: string;
  hair: string;
  backstory: string;
  traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  allies: string;
  organization: string;
  notes: string;
}

export type AbilityMethod = "point-buy" | "standard-array" | "manual";

/**
 * Everything the user decided. All derived data (granted features, stats,
 * available choices) is recomputed from this by `resolveCharacter`.
 */
export interface CharacterState {
  format: "dndbuilder-character";
  version: 1;
  name: string;
  playerName: string;
  experience: number;
  /** Portrait image as a data URL (PNG or JPEG), or "" for none. */
  portrait: string;
  details: CharacterDetails;
  abilityMethod: AbilityMethod;
  /** Base ability scores before racial bonuses, ASIs etc. */
  abilities: Record<Ability, number>;
  /**
   * Class element id for each character level. levels[0] is the starting
   * class (may be "" until chosen); the character level is levels.length.
   */
  levels: string[];
  hitPoints: {
    method: "average" | "rolled";
    /** Rolled hit die results keyed by character level (level 1 always takes the maximum). */
    rolls: Record<number, number>;
  };
  /**
   * Choices for select rules, keyed by `selectionKey(path, ruleName)`. One
   * entry per slot (select number); null = not chosen.
   */
  selections: Record<string, (string | null)[]>;
  /** Explicitly toggled options (element type "Option"); others use their default. */
  options: Record<string, boolean>;
  inventory: InventoryItem[];
  currency: Currency;
  /** Sources the user excluded, by source element name. */
  excludedSources: string[];
  /** Prepared spell ids per caster name (for casters that prepare spells). */
  preparedSpells: Record<string, string[]>;
}

export function newCharacter(): CharacterState {
  return {
    format: "dndbuilder-character",
    version: 1,
    name: "New Character",
    playerName: "",
    experience: 0,
    portrait: "",
    details: {
      gender: "",
      age: "",
      height: "",
      weight: "",
      eyes: "",
      skin: "",
      hair: "",
      backstory: "",
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
      allies: "",
      organization: "",
      notes: "",
    },
    abilityMethod: "point-buy",
    abilities: { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 },
    levels: [""],
    hitPoints: { method: "average", rolls: {} },
    selections: {},
    options: {},
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    excludedSources: [],
    preparedSpells: {},
  };
}

/** Separator between element ids in a node path. */
export const PATH_SEP = "/";

/**
 * Key under which a select rule's choices are stored. Several selects on one
 * element may share a name at different levels (e.g. "Cantrip (Wizard)" at 1, 4
 * and 10), so the level is part of the key when above 1.
 */
export function selectionKey(path: string, ruleName: string, level = 1): string {
  return level > 1 ? `${path}|${ruleName}@${level}` : `${path}|${ruleName}`;
}

export function characterLevel(state: CharacterState): number {
  return Math.max(1, state.levels.length);
}

/** Number of levels taken in each class, in order of first appearance. */
export function classLevels(state: CharacterState): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of state.levels) if (id) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function pointBuySpent(abilities: Record<Ability, number>): number | null {
  let total = 0;
  for (const v of Object.values(abilities)) {
    const c = POINT_BUY_COST[v];
    if (c === undefined) return null;
    total += c;
  }
  return total;
}

/** Shallow-validate and upgrade a parsed JSON character file. */
export function loadCharacterJson(data: unknown): CharacterState {
  if (!data || typeof data !== "object") throw new Error("Not a character file");
  const d = data as Partial<CharacterState>;
  if (d.format !== "dndbuilder-character") throw new Error("Not a dndbuilder character file");
  const base = newCharacter();
  return {
    ...base,
    ...d,
    details: { ...base.details, ...(d.details ?? {}) },
    abilities: { ...base.abilities, ...(d.abilities ?? {}) },
    hitPoints: { ...base.hitPoints, ...(d.hitPoints ?? {}) },
    currency: { ...base.currency, ...(d.currency ?? {}) },
    levels: Array.isArray(d.levels) && d.levels.length ? d.levels : base.levels,
    selections: d.selections ?? {},
    options: d.options ?? {},
    inventory: d.inventory ?? [],
    excludedSources: d.excludedSources ?? [],
    preparedSpells: d.preparedSpells ?? {},
    portrait: typeof d.portrait === "string" ? d.portrait : "",
    version: 1,
  };
}

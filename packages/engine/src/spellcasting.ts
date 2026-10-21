/**
 * Spellcasting: casters, spell lists, slots and prepared spells.
 *
 * A caster is an element with a <spellcasting name=… ability=…> node (usually
 * a class or subclass). Three preparation styles exist in content:
 *
 *  - "known":     spells chosen through selects are always available (bard, sorcerer…)
 *  - "spellbook": spells chosen through selects form a book; a subset is prepared (wizard)
 *  - "list":      the whole class list is available to prepare (cleric, druid…),
 *                 marked by <list known="true">.
 */
import { getSetter, type ElementDef } from "./model.js";
import { matchesSupports } from "./expressions.js";
import { hiddenByRules } from "./editions.js";
import type { ResolvedCharacter, ResolvedNode, SelectionPoint } from "./resolver.js";

export type PrepareMode = "known" | "spellbook" | "list";

export interface Caster {
  name: string;
  ability: string;
  node: ResolvedNode;
  /** Level of the progression the caster belongs to (class level). */
  level: number;
  mode: PrepareMode;
  /** Supports expression of spells on this caster's list, including extensions. */
  listExpression?: string;
  /** Individual spells added to the list by extensions. */
  extraSpellIds: string[];
}

export function spellLevel(el: ElementDef): number {
  const n = parseInt(getSetter(el, "level") ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

export function findCasters(rc: ResolvedCharacter): Caster[] {
  const out: Caster[] = [];
  for (const node of rc.nodes) {
    const sc = node.element.spellcasting;
    if (!sc || sc.extend || !sc.name || out.some((c) => c.name.toLowerCase() === sc.name.toLowerCase())) continue;
    const exprs: string[] = sc.list ? [sc.list] : [];
    const extraSpellIds: string[] = [];
    for (const n of rc.nodes) {
      const ext = n.element.spellcasting;
      if (!ext || !ext.extend) continue;
      if (!ext.all && ext.name.toLowerCase() !== sc.name.toLowerCase()) continue;
      for (const e of ext.extendLists) {
        if (/^ID_\w+(\s*,\s*ID_\w+)*$/.test(e.expression)) extraSpellIds.push(...e.expression.split(",").map((s) => s.trim()));
        else exprs.push(e.expression);
      }
      if (ext.list) exprs.push(ext.list);
    }
    out.push({
      name: sc.name,
      ability: sc.ability,
      node,
      level: node.level,
      mode: !sc.prepare ? "known" : sc.listKnown ? "list" : "spellbook",
      listExpression: exprs.length === 0 ? undefined : exprs.length === 1 ? exprs[0] : exprs.map((e) => `(${e})`).join("||"),
      extraSpellIds,
    });
  }
  return out;
}

export function findCaster(rc: ResolvedCharacter, name: string | undefined): Caster | undefined {
  if (!name) return undefined;
  return findCasters(rc).find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/**
 * Spell levels the caster can cast at a given progression level, derived from
 * its "<name>:spellcasting:slots:N" stat rules. Returns [] if none.
 */
export function slotLevelsAt(rc: ResolvedCharacter, caster: Caster, level: number): number[] {
  const prefix = `${caster.name.toLowerCase()}:spellcasting:slots:`;
  let max = 0;
  for (const node of rc.nodes) {
    for (const r of node.element.rules) {
      if (r.kind !== "stat" || !r.name.startsWith(prefix) || r.level > level) continue;
      const n = parseInt(r.name.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** Values for $(spellcasting:list) and $(spellcasting:slots) in a select's supports. */
export function spellcastingVariables(rc: ResolvedCharacter, point: SelectionPoint): {
  vars: (name: string) => string | undefined;
  caster?: Caster;
  extraIds: string[];
  slotLevels: number[];
} {
  let casterName = point.rule.spellcasting;
  if (!casterName) {
    for (let n: ResolvedNode | undefined = point.owner; n; n = n.parent) {
      if (n.element.spellcasting && !n.element.spellcasting.extend) {
        casterName = n.element.spellcasting.name;
        break;
      }
    }
  }
  const caster = findCaster(rc, casterName);
  const slotLevels = caster ? slotLevelsAt(rc, caster, point.rule.level) : [];
  const vars = (name: string): string | undefined => {
    if (name === "spellcasting:list") return caster?.listExpression ? `(${caster.listExpression})` : casterName;
    if (name === "spellcasting:slots") return slotLevels.length ? `(${slotLevels.join("||")})` : "(99)";
    return undefined;
  };
  return { vars, caster, extraIds: caster?.extraSpellIds ?? [], slotLevels };
}

/** Standard multiclass spellcaster slot table, indexed by caster level (1-20). */
export const MULTICLASS_SLOTS: number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const MULTICLASS_SLOT_GRANTS = [
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_FULL",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_HALF",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_HALF_UP",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_THIRD",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_THIRD_UP",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_FOURTH",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_FOURTH_UP",
  "ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_FIFTH",
];

/**
 * With two or more classes contributing to the multiclass caster level, spell
 * slots come from the shared multiclass table instead of each class.
 */
export function multiclassSpellSlots(rc: ResolvedCharacter): { casterLevel: number; slots: number[] } | null {
  let contributors = 0;
  for (const id of MULTICLASS_SLOT_GRANTS) contributors += rc.ids.get(id) ?? 0;
  if (contributors < 2) return null;
  const casterLevel = Math.max(0, Math.min(20, rc.stats.get("multiclass:spellcasting:level")));
  const row = MULTICLASS_SLOTS[casterLevel] ?? [];
  return { casterLevel, slots: Array.from({ length: 9 }, (_, i) => row[i] ?? 0) };
}

export interface CasterSpell {
  element: ElementDef;
  level: number;
  /** Always prepared (granted as prepared, or a cantrip). */
  alwaysPrepared: boolean;
  /** Chosen through a select (as opposed to granted). */
  chosen: boolean;
}

function spellCaster(node: ResolvedNode): { caster?: string; always: boolean } {
  if (node.via.kind === "select") {
    return { caster: node.via.point.rule.spellcasting, always: node.via.point.rule.prepared === true };
  }
  if (node.via.kind === "grant") {
    return {
      caster: node.via.rule.setters.spellcasting,
      always: (node.via.rule.setters.prepared ?? "").toLowerCase() === "true",
    };
  }
  return { always: false };
}

/** Spells the character knows for a caster (chosen or granted). Unattributed spells go to the first caster. */
export function casterSpells(rc: ResolvedCharacter, caster: Caster, casters = findCasters(rc)): CasterSpell[] {
  const out = new Map<string, CasterSpell>();
  for (const node of rc.nodes) {
    if (node.element.type !== "Spell") continue;
    const { caster: name, always } = spellCaster(node);
    const owner = name ? casters.find((c) => c.name.toLowerCase() === name.toLowerCase()) : casters[0];
    if (!owner || owner.name.toLowerCase() !== caster.name.toLowerCase()) continue;
    const level = spellLevel(node.element);
    const existing = out.get(node.element.id);
    out.set(node.element.id, {
      element: node.element,
      level,
      alwaysPrepared: (existing?.alwaysPrepared ?? false) || always || level === 0,
      chosen: (existing?.chosen ?? false) || node.via.kind === "select",
    });
  }
  return [...out.values()].sort((a, b) => a.level - b.level || a.element.name.localeCompare(b.element.name));
}

/** Spells a "list" caster may prepare: everything on its list at levels it has slots for. */
export function preparableSpells(rc: ResolvedCharacter, caster: Caster): ElementDef[] {
  if (caster.mode === "known") return [];
  if (caster.mode === "spellbook") return casterSpells(rc, caster).filter((s) => s.level > 0).map((s) => s.element);
  const levels = new Set(slotLevelsAt(rc, caster, caster.level));
  const out: ElementDef[] = [];
  for (const el of rc.registry.ofType("Spell")) {
    const lv = spellLevel(el);
    if (lv === 0 || !levels.has(lv)) continue;
    if (rc.state.excludedSources.includes(el.source) || hiddenByRules(rc.registry, rc.state, el)) continue;
    const onList =
      caster.extraSpellIds.includes(el.id) || (caster.listExpression ? matchesSupports(caster.listExpression, el) : false);
    if (onList) out.push(el);
  }
  return out.sort((a, b) => spellLevel(a) - spellLevel(b) || a.name.localeCompare(b.name));
}

export function preparedLimit(rc: ResolvedCharacter, caster: Caster): number | undefined {
  const stat = `${caster.name.toLowerCase()}:spellcasting:prepare`;
  return rc.stats.has(stat) ? Math.max(1, rc.stats.get(stat)) : undefined;
}

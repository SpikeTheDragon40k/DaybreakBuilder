import type { CharacterState, EquipSlot, InventoryItem } from "./character.js";
import { hiddenByRules } from "./editions.js";
import { evaluateString } from "./expressions.js";
import { getSetter, type ElementDef } from "./model.js";
import type { ContentRegistry } from "./registry.js";

/**
 * Generic magic items ("Weapon, +1", "Shield (+1)", "Armor of Resistance")
 * are made from a base item the player chooses, as in Aurora: the `type`
 * setter says Weapon or Armor, and the `weapon` / `armor` setter filters
 * which base items fit (ids they support, or names).
 */
export interface BaseItemFilter {
  type: "Weapon" | "Armor";
  /** Expression over the base item's supports, id and name; empty means any. */
  filter: string;
  /** Aurora's hint, e.g. "Any Simple or Martial" or "Shield". */
  hint?: string;
}

export function baseItemFilter(el: ElementDef): BaseItemFilter | undefined {
  if (el.type !== "Magic Item") return undefined;
  const typeSetter = el.setters.find((s) => s.name.toLowerCase() === "type");
  const type = typeSetter?.value.trim().toLowerCase();
  if (type !== "weapon" && type !== "armor") return undefined;
  return {
    type: type === "weapon" ? "Weapon" : "Armor",
    filter: getSetter(el, type) ?? "",
    hint: typeSetter?.attrs.addition || undefined,
  };
}

function fitsFilter(candidate: ElementDef, filter: string): boolean {
  const word = (w: string) => {
    const lower = w.toLowerCase();
    return candidate.id === w || candidate.name.toLowerCase() === lower || candidate.supports.some((s) => s.toLowerCase() === lower) || armorKind(candidate) === lower;
  };
  return evaluateString(filter, { id: word, word }, false);
}

/**
 * Base items a generic magic item can be made from; with the character, only
 * those from its sources and rules edition (a 2024 character gets the 2024 Shield).
 */
export function baseItemCandidates(
  registry: ContentRegistry,
  el: ElementDef,
  state?: Pick<CharacterState, "rules" | "excludedSources">,
): ElementDef[] {
  const f = baseItemFilter(el);
  if (!f) return [];
  return registry
    .ofType(f.type)
    .filter((c) => fitsFilter(c, f.filter) && (!state || (!state.excludedSources.includes(c.source) && !hiddenByRules(registry, state, c))))
    .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

/** "{{parent}} +{{enhancement}}" with the base item and the magic item's setters filled in. */
function formatName(magic: ElementDef, base: ElementDef): string {
  const format = getSetter(magic, "name-format");
  if (!format) return `${magic.name} (${base.name})`;
  return format.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (m, key: string) => (key === "parent" ? base.name : getSetter(magic, key) ?? m)).trim();
}

/** Setters that describe what the base item must be, not the finished item. */
const FILTER_SETTERS = new Set(["type", "armor", "weapon", "name-format", "category"]);

/** The magic item made from its base: the base's stats and rules with the magic item's on top. */
export function withBaseItem(magic: ElementDef, base: ElementDef): ElementDef {
  const own = magic.setters.filter((s) => !FILTER_SETTERS.has(s.name.toLowerCase()));
  const overridden = new Set(own.map((s) => s.name.toLowerCase()));
  return {
    ...magic,
    type: base.type,
    name: formatName(magic, base),
    supports: [...new Set([...base.supports, ...magic.supports])],
    setters: [...base.setters.filter((s) => !overridden.has(s.name.toLowerCase())), ...own],
    rules: [...base.rules, ...magic.rules],
  };
}

export interface ResolvedItem {
  /** What the item is in play: a generic magic item merged with its chosen base. */
  element: ElementDef;
  /** The base item, when one is chosen. */
  base?: ElementDef;
  /** A generic magic item still waiting for its base item. */
  needsBase: boolean;
}

export function resolveItem(registry: ContentRegistry, item: Pick<InventoryItem, "id" | "base">): ResolvedItem | undefined {
  const el = registry.get(item.id);
  if (!el) return undefined;
  if (!baseItemFilter(el)) return { element: el, needsBase: false };
  const base = item.base ? registry.get(item.base) : undefined;
  return base ? { element: withBaseItem(el, base), base, needsBase: false } : { element: el, needsBase: true };
}

/** The item element in play (see `resolveItem`). */
export function itemElement(registry: ContentRegistry, item: Pick<InventoryItem, "id" | "base">): ElementDef | undefined {
  return resolveItem(registry, item)?.element;
}

export function itemName(registry: ContentRegistry, item: Pick<InventoryItem, "id" | "base" | "name">): string {
  return item.name || itemElement(registry, item)?.name || item.id;
}

const ARMOR_GROUP = /^id_internal_armor_group_(light|medium|heavy|shield)$/;

/**
 * "light", "medium", "heavy" or "shield" for armor, "" otherwise. Reads the
 * `armor` setter ("Shield", or the group id generic magic armor uses) and
 * the armor group in supports.
 */
export function armorKind(el: ElementDef | undefined): string {
  if (!el) return "";
  const setter = (getSetter(el, "armor") ?? "").trim().toLowerCase();
  if (/^(light|medium|heavy|shield)$/.test(setter)) return setter;
  const group = ARMOR_GROUP.exec(setter)?.[1];
  if (group) return group;
  for (const s of el.supports) {
    const m = ARMOR_GROUP.exec(s.toLowerCase());
    if (m) return m[1];
  }
  return "";
}

/** A weapon, or a generic magic weapon whose base isn't chosen yet. */
export function isWeaponItem(el: ElementDef): boolean {
  return el.type === "Weapon" || baseItemFilter(el)?.type === "Weapon" || (getSetter(el, "category") ?? "").toLowerCase().startsWith("weapon");
}

export function isTwoHanded(el: ElementDef): boolean {
  return (
    /\btwohand\b/i.test(getSetter(el, "slot") ?? "") || el.supports.some((s) => s.toUpperCase() === "ID_INTERNAL_WEAPON_PROPERTY_TWOHANDED")
  );
}

/** Slots an item can be equipped in. */
export function equipSlots(el: ElementDef | undefined): EquipSlot[] {
  if (!el) return ["worn"];
  const kind = armorKind(el);
  if (kind === "shield") return ["offhand"];
  if (el.type === "Armor" || kind || baseItemFilter(el)?.type === "Armor") return ["armor"];
  if (isWeaponItem(el)) return ["main", "offhand"];
  return ["worn", "main", "offhand"];
}

/**
 * Equips an inventory item (or unequips it, with no slot). Whatever held the
 * slot is taken off, except that a one-handed weapon in the main hand moves
 * to a free off hand, so two weapons can be wielded together. A two-handed
 * weapon needs both hands, so it and the off hand exclude each other.
 */
export function equipItem(registry: ContentRegistry, inventory: InventoryItem[], uid: string, slot: EquipSlot | undefined): void {
  const it = inventory.find((x) => x.uid === uid);
  if (!it) return;
  const el = (i: InventoryItem) => itemElement(registry, i);
  const holding = (s: EquipSlot) => inventory.find((x) => x !== it && x.equipped === s);
  const oneHandedWeapon = (i: InventoryItem | undefined) => {
    const e = i && el(i);
    return !!e && isWeaponItem(e) && !isTwoHanded(e);
  };
  if (slot === "main") {
    const main = holding("main");
    if (main) main.equipped = oneHandedWeapon(main) && oneHandedWeapon(it) && !holding("offhand") ? "offhand" : undefined;
    const mine = el(it);
    if (mine && isTwoHanded(mine)) for (const x of inventory) if (x !== it && x.equipped === "offhand") x.equipped = undefined;
  } else if (slot === "offhand" || slot === "armor") {
    const held = holding(slot);
    if (held) held.equipped = undefined;
    const main = holding("main");
    const mainEl = main && el(main);
    if (slot === "offhand" && mainEl && isTwoHanded(mainEl)) main.equipped = undefined;
  }
  it.equipped = slot;
}

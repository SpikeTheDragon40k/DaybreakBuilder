import { getSetter, type Ability, type ElementDef } from "./model.js";
import { itemElement, resolveItem } from "./items.js";
import type { ResolvedCharacter } from "./resolver.js";
import type { StatPart } from "./stats.js";
import { formatDistance, formatNumber, METERS_PER_FOOT, type UnitSystem } from "./units.js";

export interface AttackRow {
  /** Inventory uid, or "unarmed" for the unarmed strike. */
  key: string;
  name: string;
  ability: Ability;
  /** Total attack bonus. */
  attack: number;
  attackBreakdown: StatPart[];
  /** Damage dice and modifier, e.g. "1d8+3". */
  damage: string;
  /** Two-handed damage of a versatile weapon. */
  versatile?: string;
  damageType: string;
  /** Distances in feet: reach for melee, normal/long range for ranged and thrown weapons. */
  reach?: number;
  range?: { normal: number; long: number };
  properties: string[];
  proficient: boolean;
  equipped?: "main" | "offhand";
}

const PROPERTIES: [string, string][] = [
  ["AMMUNITION", "Ammunition"],
  ["FINESSE", "Finesse"],
  ["HEAVY", "Heavy"],
  ["LIGHT", "Light"],
  ["LOADING", "Loading"],
  ["REACH", "Reach"],
  ["THROWN", "Thrown"],
  ["TWOHANDED", "Two-handed"],
  ["VERSATILE", "Versatile"],
  ["SPECIAL", "Special"],
];

/** Fighting styles that change attack math but carry no stat rules in the content. */
const DUELING = /^(fighting style: )?dueling$/i;
const TWO_WEAPON = /^(fighting style: )?two-weapon fighting$/i;

function hasFeature(rc: ResolvedCharacter, pattern: RegExp): boolean {
  return rc.nodes.some((n) => (n.element.type === "Class Feature" || n.element.type === "Feat") && pattern.test(n.element.name));
}

function supports(el: ElementDef, id: string): boolean {
  return el.supports.some((s) => s.toUpperCase() === id);
}

function weaponProperties(el: ElementDef): string[] {
  const out = PROPERTIES.filter(([id]) => supports(el, `ID_INTERNAL_WEAPON_PROPERTY_${id}`)).map(([, name]) => name);
  if (out.length) return out;
  // Content without property ids: read the "properties" setter ("Finesse, Light, Thrown (range 20/60)").
  const text = getSetter(el, "properties") ?? "";
  return PROPERTIES.map(([, name]) => name).filter((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
}

function isRanged(el: ElementDef): boolean {
  return el.supports.some((s) => /^ID_INTERNAL_WEAPON_CATEGORY_\w+_RANGED$/i.test(s) || /^(simple|martial) ranged$/i.test(s));
}

function parseRange(text: string | undefined): { normal: number; long: number } | undefined {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text ?? "");
  return m ? { normal: Number(m[1]), long: Number(m[2]) } : undefined;
}

function formatDamage(dice: string, bonus: number): string {
  if (!dice) return bonus > 0 ? String(bonus) : "0";
  if (bonus === 0) return dice;
  return `${dice}${bonus > 0 ? "+" : "−"}${Math.abs(bonus)}`;
}

/** Element is something you attack with: a weapon, or a magic item that carries weapon damage. */
export function isWeapon(el: ElementDef): boolean {
  return el.type === "Weapon" || (el.type === "Magic Item" && !!getSetter(el, "damage"));
}

/** Attack lines for the weapons in the inventory (equipped ones first), plus the unarmed strike. */
export function buildAttacks(rc: ResolvedCharacter): AttackRow[] {
  const s = rc.stats;
  const prof = s.get("proficiency");
  const mod = (a: Ability) => s.abilityModifier(a);
  const dueling = hasFeature(rc, DUELING);
  const twoWeapon = hasFeature(rc, TWO_WEAPON);
  const offhandWeapon = rc.state.inventory.some((i) => {
    const el = i.equipped === "offhand" ? itemElement(rc.registry, i) : undefined;
    return !!el && isWeapon(el);
  });

  const rows: AttackRow[] = [];
  const items = rc.state.inventory
    .map((item, index) => ({ item, index, ...resolveItem(rc.registry, item) }))
    .filter((x): x is typeof x & { element: ElementDef } => !!x.element && isWeapon(x.element))
    .sort((a, b) => rank(a.item.equipped) - rank(b.item.equipped) || a.index - b.index);

  for (const { item, element: el, base } of items) {
    const properties = weaponProperties(el);
    const ranged = isRanged(el);
    const finesse = properties.includes("Finesse");
    const ability: Ability = finesse ? (mod("dexterity") >= mod("strength") ? "dexterity" : "strength") : ranged ? "dexterity" : "strength";
    const profId = getSetter(el, "proficiency");
    const proficient = !profId || (rc.ids.get(profId) ?? 0) > 0;
    const enhancement = Number(getSetter(el, "enhancement") ?? 0) || 0;
    const kind = ranged ? "ranged" : "melee";
    // Stats name the weapon ("longsword:attack"), so a +1 Longsword still counts as a longsword.
    const name = (base ?? el).name.toLowerCase();

    const attackBreakdown: StatPart[] = [{ source: ability.charAt(0).toUpperCase() + ability.slice(1), value: mod(ability) }];
    if (proficient) attackBreakdown.push({ source: "Proficiency", value: prof });
    if (enhancement) attackBreakdown.push({ source: "Magic", value: enhancement });
    attackBreakdown.push(...s.breakdown(`${kind}:attack`), ...s.breakdown(`${name}:attack`));
    const attack = mod(ability) + (proficient ? prof : 0) + enhancement + s.get(`${kind}:attack`) + s.get(`${name}:attack`);

    const offhand = item.equipped === "offhand";
    let abilityDamage = mod(ability);
    // Off-hand attacks add the ability modifier only when it is negative, unless you have Two-Weapon Fighting.
    if (offhand && abilityDamage > 0 && !twoWeapon) abilityDamage = 0;
    let bonus = abilityDamage + enhancement + s.get(`${kind}:damage`) + s.get(`${name}:damage`);
    const oneHandedMelee = !ranged && !properties.includes("Two-handed");
    if (dueling && oneHandedMelee && !offhand && !offhandWeapon) bonus += 2;

    const versatileDice = getSetter(el, "versatile") ?? /versatile \(([^)]+)\)/i.exec(getSetter(el, "properties") ?? "")?.[1];
    const dice = getSetter(el, "damage") ?? "";
    const damageSetter = el.setters.find((x) => x.name.toLowerCase() === "damage");
    const damageType = damageSetter?.attrs.type ?? damageTypeFromSupports(el);
    const range = parseRange(getSetter(el, "range")) ?? parseRange(/range ([\d/ ]+)/i.exec(getSetter(el, "properties") ?? "")?.[1]);

    rows.push({
      key: item.uid,
      name: item.name || el.name,
      ability,
      attack,
      attackBreakdown,
      damage: formatDamage(dice, bonus),
      // Versatile damage needs both hands, so Dueling does not apply to it.
      versatile: versatileDice && !offhand ? formatDamage(versatileDice, bonus - (dueling && !offhandWeapon ? 2 : 0)) : undefined,
      damageType,
      reach: ranged ? undefined : properties.includes("Reach") ? 10 : 5,
      range,
      properties,
      proficient,
      equipped: item.equipped === "main" || item.equipped === "offhand" ? item.equipped : undefined,
    });
  }

  const str = mod("strength");
  rows.push({
    key: "unarmed",
    name: "Unarmed Strike",
    ability: "strength",
    attack: str + prof + s.get("melee:attack"),
    attackBreakdown: [{ source: "Strength", value: str }, { source: "Proficiency", value: prof }, ...s.breakdown("melee:attack")],
    damage: String(Math.max(0, 1 + str + s.get("melee:damage"))),
    damageType: "bludgeoning",
    reach: 5,
    properties: [],
    proficient: true,
  });
  return rows;
}

function rank(slot: string | undefined): number {
  return slot === "main" ? 0 : slot === "offhand" ? 1 : 2;
}

function damageTypeFromSupports(el: ElementDef): string {
  const id = el.supports.find((x) => /^ID_INTERNAL_DAMAGE_TYPE_/i.test(x));
  return id ? id.replace(/^ID_INTERNAL_DAMAGE_TYPE_/i, "").toLowerCase() : "";
}

/** Damage type, reach or range and notable properties, e.g. "slashing · reach 5 ft. · versatile 1d10+3". */
export function attackDetails(a: AttackRow, units: UnitSystem = "imperial"): string {
  const range = (r: { normal: number; long: number }) =>
    units === "metric"
      ? `${formatNumber(r.normal * METERS_PER_FOOT)}/${formatNumber(r.long * METERS_PER_FOOT)} m`
      : `${r.normal}/${r.long} ft.`;
  const parts: string[] = [];
  if (a.damageType) parts.push(a.damageType);
  if (a.range) parts.push(`range ${range(a.range)}`);
  if (a.reach !== undefined) parts.push(`reach ${formatDistance(a.reach, units)}`);
  if (a.versatile) parts.push(`versatile ${a.versatile}`);
  const shown = a.properties.filter((p) => p !== "Versatile" && p !== "Reach" && p !== "Thrown");
  if (shown.length) parts.push(shown.join(", ").toLowerCase());
  if (a.equipped === "offhand") parts.push("off hand");
  if (!a.proficient) parts.push("not proficient");
  return parts.join(" · ");
}

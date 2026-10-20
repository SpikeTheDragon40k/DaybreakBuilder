/**
 * Companions (familiars, beast companions, steel defenders…).
 *
 * A companion is an element of type "Companion", usually chosen through a
 * select. Its base ability scores and stat block come from setters; content
 * modifies it through "companion:*" statistics (companion:ac,
 * companion:hp:max, companion:strength, companion:perception:proficiency…).
 * Actions, traits and reactions are listed by id in setters.
 */
import { ABILITIES, SKILLS, getSetter, type Ability, type ElementDef } from "./model.js";
import type { ContentRegistry } from "./registry.js";
import type { StatValues } from "./stats.js";

export interface CompanionFeature {
  id: string;
  name: string;
  text: string;
}

export interface CompanionSheet {
  id: string;
  name: string;
  summary: string;
  challenge: string;
  proficiencyBonus: number;
  abilities: { ability: Ability; score: number; modifier: number }[];
  armorClass: number;
  maxHp: number;
  hitPointsText: string;
  initiative: number;
  speed: { walk: number; climb: number; swim: number; fly: number; burrow: number };
  savingThrows: { name: string; total: number; proficient: boolean }[];
  /** Skills with a proficiency or bonus. */
  skills: { name: string; total: number }[];
  senses: string;
  languages: string;
  defenses: string[];
  traits: CompanionFeature[];
  actions: CompanionFeature[];
  reactions: CompanionFeature[];
  attackBonus: number;
  damageBonus: number;
}

const PROFICIENCY_BY_CR: [number, number][] = [
  [29, 9],
  [25, 8],
  [21, 7],
  [17, 6],
  [13, 5],
  [9, 4],
  [5, 3],
];

export function companionProficiency(el: ElementDef): number {
  const explicit = parseInt(getSetter(el, "proficiency") ?? "", 10);
  if (Number.isFinite(explicit)) return explicit;
  const cr = parseFloat((getSetter(el, "challenge") ?? "0").replace(/^1\/\d+$/, "0"));
  for (const [min, prof] of PROFICIENCY_BY_CR) if (cr >= min) return prof;
  return 2;
}

export function companionBaseAbilities(el: ElementDef): Record<Ability, number> {
  const out = {} as Record<Ability, number>;
  for (const a of ABILITIES) {
    const v = parseInt(getSetter(el, a) ?? "", 10);
    out[a] = Number.isFinite(v) ? v : 10;
  }
  return out;
}

function featureList(registry: ContentRegistry, ids: string | undefined): CompanionFeature[] {
  if (!ids) return [];
  return ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => {
      const el = registry.get(id);
      if (!el) return { id, name: id, text: "" };
      const text = el.sheet?.descriptions[0]?.text ?? el.description.replace(/<[^>]+>/g, "").trim();
      return { id, name: el.sheet?.alt ?? el.name, text };
    });
}

export function buildCompanionSheet(el: ElementDef, stats: StatValues, registry: ContentRegistry): CompanionSheet {
  const s = (name: string) => stats.get(`companion:${name}`);
  const prof = s("proficiency");
  const mod = (a: Ability) => stats.abilityModifier(`companion:${a}` as Ability);
  const savingThrows = ABILITIES.map((a) => {
    const p = s(`${a}:save:proficiency`);
    return { name: a.charAt(0).toUpperCase() + a.slice(1), total: mod(a) + p + s(`${a}:save:misc`), proficient: p > 0 };
  });
  const skills = SKILLS.map(({ name, ability }) => {
    const key = name.toLowerCase();
    const p = s(`${key}:proficiency`);
    const misc = s(`${key}:misc`);
    return { name, total: mod(ability) + p + misc, include: p !== 0 || misc !== 0 };
  })
    .filter((x) => x.include)
    .map(({ name, total }) => ({ name, total }));
  const defenses = [
    ["Damage vulnerabilities", getSetter(el, "vulnerabilities") ?? getSetter(el, "damageVulnerabilities")],
    ["Damage resistances", getSetter(el, "resistances") ?? getSetter(el, "damageResistances")],
    ["Damage immunities", getSetter(el, "immunities") ?? getSetter(el, "damageImmunities")],
    ["Condition immunities", getSetter(el, "conditionImmunities")],
  ]
    .filter(([, v]) => v && v !== "—")
    .map(([k, v]) => `${k}: ${v}`);
  const size = getSetter(el, "size") ?? "";
  const type = getSetter(el, "type") ?? "";
  const alignment = getSetter(el, "alignment") ?? "";
  return {
    id: el.id,
    name: el.name,
    summary: getSetter(el, "short") ?? [size, type.toLowerCase()].filter(Boolean).join(" ") + (alignment ? `, ${alignment}` : ""),
    challenge: getSetter(el, "challenge") ?? "",
    proficiencyBonus: prof,
    abilities: ABILITIES.map((a) => ({ ability: a, score: stats.get(`companion:${a}:score`), modifier: mod(a) })),
    armorClass: s("ac"),
    maxHp: s("hp:max"),
    hitPointsText: getSetter(el, "hp") ?? "",
    initiative: mod("dexterity") + s("initiative") + s("initiative:misc"),
    speed: { walk: s("speed"), climb: s("speed:climb"), swim: s("speed:swim"), fly: s("speed:fly"), burrow: s("speed:burrow") },
    savingThrows,
    skills,
    senses: getSetter(el, "senses") ?? "",
    languages: getSetter(el, "languages") ?? "—",
    defenses,
    traits: featureList(registry, getSetter(el, "traits")),
    actions: featureList(registry, getSetter(el, "actions")),
    reactions: featureList(registry, getSetter(el, "reactions")),
    attackBonus: s("attack"),
    damageBonus: s("damage"),
  };
}

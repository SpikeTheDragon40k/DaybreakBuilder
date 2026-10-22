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
import type { ResolvedCompanion, ResolvedNode } from "./resolver.js";
import type { StatValues } from "./stats.js";

export interface CompanionFeature {
  id: string;
  name: string;
  text: string;
}

export interface CompanionSheet {
  id: string;
  name: string;
  /** The feature, spell or invocation that grants it ("Primal Companion", "Find Familiar"). */
  grantedBy: string;
  summary: string;
  challenge: string;
  proficiencyBonus: number;
  abilities: { ability: Ability; score: number; modifier: number }[];
  armorClass: number;
  maxHp: number;
  hitPointsText: string;
  /** Hit dice such as "5d8", when the stat block gives them. */
  hitDice: string;
  initiative: number;
  speed: { walk: number; climb: number; swim: number; fly: number; burrow: number };
  savingThrows: { name: string; total: number; proficient: boolean }[];
  /** Skills with a proficiency or bonus. */
  skills: { name: string; total: number }[];
  /** Senses with the passive Perception worked out from the companion's own Perception. */
  senses: string;
  passivePerception: number;
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

/** What a companion's text refers to as "your …": the character's numbers. */
export interface CompanionOwner {
  stats: StatValues;
  /** Class levels by lower-case class name. */
  classLevels: Map<string, number>;
  /** Spell attack bonus and save DC of the class the companion belongs to, if it casts. */
  spellAttack?: number;
  spellDc?: number;
}

const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);

/**
 * Put the character's numbers into a companion's text, the way the stat
 * blocks ask: "your spell attack modifier to hit" becomes "+6 to hit" and
 * "1d8 + 2 + your Wisdom modifier" becomes "1d8 + 5". Phrases the character
 * has no number for (no spellcasting, unknown class) are left as written.
 */
export function companionText(text: string, owner: CompanionOwner): string {
  const { stats } = owner;
  const prof = stats.get("proficiency");
  let out = text
    .replace(/\byour spell attack (?:modifier|bonus)\b/gi, (m) => (owner.spellAttack === undefined ? m : signed(owner.spellAttack)))
    .replace(/\byour spell save DC\b/gi, (m) => (owner.spellDc === undefined ? m : String(owner.spellDc)))
    .replace(/\byour (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier\b/gi, (_, a: string) =>
      String(stats.abilityModifier(a.toLowerCase() as Ability)),
    )
    .replace(/\byour proficiency bonus\b|\bPB\b/g, String(prof))
    .replace(/\byour (\w+) level\b/gi, (m, cls: string) => {
      const lv = owner.classLevels.get(cls.toLowerCase());
      return lv === undefined ? m : String(lv);
    });
  // Work out the sums the substitutions left behind: "3 × 2", "2 + 3", "+1 plus 3".
  out = out.replace(/(?<![\w.])(\d+)\s*[×x*]\s*(\d+)(?!\w|\.\d)/g, (_, a: string, b: string) => String(Number(a) * Number(b)));
  const op = String.raw`(\s*\+\s*|\s+[-−]\s+|\s+plus\s+|\s+minus\s+)`;
  out = out.replace(new RegExp(String.raw`(?<![\w.])([+\-−]?)(\d+)((?:${op}-?\d+(?!\w|\.\d))+)`, "g"), (_, sign: string, first: string, rest: string) => {
    let total = (sign && sign !== "+" ? -1 : 1) * Number(first);
    for (const [, o, n] of rest.matchAll(new RegExp(`${op}(-?\\d+)`, "g"))) total += (/[-−]|minus/.test(o) ? -1 : 1) * Number(n);
    return sign ? signed(total) : String(total);
  });
  // "1d8 + -1" after a negative modifier.
  return out.replace(/\+\s*-(\d)/g, "- $1");
}

/** Hit dice from the stat block's hit points text: "… Hit Dice [d8s] equal to your Ranger level" or "11 (2d8 + 2)". */
function hitDiceOf(hp: string, classLevels: Map<string, number>): string {
  const scaling = /\[(d\d+)s?\][^.;)]*?equal to your (\w+) level/i.exec(hp);
  if (scaling) {
    const lv = classLevels.get(scaling[2].toLowerCase());
    return lv === undefined ? "" : `${lv}${scaling[1]}`;
  }
  return /\((\d+d\d+)/.exec(hp)?.[1] ?? "";
}

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

function featureList(registry: ContentRegistry, ids: string | undefined, owner: CompanionOwner): CompanionFeature[] {
  if (!ids) return [];
  return ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => {
      const el = registry.get(id);
      if (!el) return { id, name: id, text: "" };
      const raw = el.sheet?.descriptions[0]?.text ?? el.description.replace(/<[^>]+>/g, "");
      // One line per paragraph, without the XML file's indentation.
      const text = raw
        .split(/\s*[\r\n]+\s*/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      return { id, name: el.sheet?.alt ?? el.name, text: companionText(text, owner) };
    });
}

/** Name of the select (or granting element) that gave the character this companion. */
function grantedBy(node: ResolvedNode): string {
  if (node.via.kind === "select") return node.via.point.rule.name;
  const parent = node.parent?.element;
  return parent ? parent.sheet?.alt ?? parent.name : "";
}

export function buildCompanionSheet(
  companion: ResolvedCompanion,
  registry: ContentRegistry,
  owner: Omit<CompanionOwner, "stats">,
): CompanionSheet {
  const { node, stats } = companion;
  const el = node.element;
  const who: CompanionOwner = { ...owner, stats };
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
  const perception = mod("wisdom") + s("perception:proficiency") + s("perception:misc");
  const passivePerception = 10 + perception + s("perception:passive");
  const rawSenses = companionText(getSetter(el, "senses") ?? "", who);
  const senses = /passive perception/i.test(rawSenses)
    ? rawSenses.replace(/(passive perception)[^,;]*/i, `$1 ${passivePerception}`)
    : [rawSenses, `passive Perception ${passivePerception}`].filter(Boolean).join(", ");
  const size = getSetter(el, "size") ?? "";
  const type = getSetter(el, "type") ?? "";
  const alignment = getSetter(el, "alignment") ?? "";
  return {
    id: el.id,
    name: el.name,
    grantedBy: grantedBy(node),
    summary: getSetter(el, "short") ?? [size, type.toLowerCase()].filter(Boolean).join(" ") + (alignment ? `, ${alignment}` : ""),
    challenge: getSetter(el, "challenge") ?? "",
    proficiencyBonus: prof,
    abilities: ABILITIES.map((a) => ({ ability: a, score: stats.get(`companion:${a}:score`), modifier: mod(a) })),
    armorClass: s("ac"),
    maxHp: s("hp:max"),
    hitPointsText: getSetter(el, "hp") ?? "",
    hitDice: hitDiceOf(getSetter(el, "hp") ?? "", owner.classLevels),
    initiative: mod("dexterity") + s("initiative") + s("initiative:misc"),
    speed: { walk: s("speed"), climb: s("speed:climb"), swim: s("speed:swim"), fly: s("speed:fly"), burrow: s("speed:burrow") },
    savingThrows,
    skills,
    senses,
    passivePerception,
    languages: getSetter(el, "languages") ?? "—",
    defenses,
    traits: featureList(registry, getSetter(el, "traits"), who),
    actions: featureList(registry, getSetter(el, "actions"), who),
    reactions: featureList(registry, getSetter(el, "reactions"), who),
    attackBonus: s("attack"),
    damageBonus: s("damage"),
  };
}

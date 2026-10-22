import { ABILITIES, ABILITY_ABBR, SKILLS, featCategory, getSetter, type Ability, type ElementDef, type FeatCategory } from "./model.js";
import { meetsRequirements, type ResolvedCharacter, type ResolvedNode } from "./resolver.js";
import type { StatPart } from "./stats.js";
import { buildCompanionSheet, type CompanionSheet } from "./companion.js";
import { buildAttacks, type AttackRow } from "./attacks.js";
import {
  casterSpells,
  findCasters,
  multiclassSpellSlots,
  preparableSpells,
  preparedLimit,
  spellLevel,
  type PrepareMode,
} from "./spellcasting.js";

export interface AbilityRow {
  ability: Ability;
  abbr: string;
  base: number;
  score: number;
  modifier: number;
  breakdown: StatPart[];
}

export interface CheckRow {
  name: string;
  ability: Ability;
  total: number;
  proficient: boolean;
  expertise: boolean;
  breakdown: StatPart[];
}

export interface FeatureRow {
  id: string;
  name: string;
  type: string;
  source: string;
  /** Sheet text with {{stat}} placeholders substituted. */
  text: string;
  usage?: string;
  action?: string;
  origin: string;
  /** Feat category such as "Origin" (2024 rules). */
  category?: FeatCategory;
}

export interface SpellcastingRow {
  name: string;
  ability: string;
  mode: PrepareMode;
  attack: number;
  dc: number;
  prepare: boolean;
  slots: number[];
  cantripsKnown?: number;
  spellsKnown?: number;
  /** Maximum number of prepared spells, if the caster prepares. */
  prepareCount?: number;
  preparedCount: number;
  spells: { id: string; name: string; level: number; alwaysPrepared: boolean; prepared: boolean }[];
}

export interface CharacterSheet {
  name: string;
  level: number;
  classSummary: string;
  race?: string;
  subrace?: string;
  background?: string;
  alignment?: string;
  deity?: string;
  size?: string;
  proficiencyBonus: number;
  abilities: AbilityRow[];
  savingThrows: CheckRow[];
  skills: CheckRow[];
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  armorClass: number;
  armorClassBreakdown: StatPart[];
  initiative: number;
  speed: { walk: number; climb: number; swim: number; fly: number; burrow: number };
  maxHp: number;
  hpBreakdown: StatPart[];
  hitDice: string;
  vision: { name: string; range: number }[];
  proficiencies: { armor: string[]; weapons: string[]; tools: string[]; skills: string[]; savingThrows: string[]; other: string[] };
  languages: string[];
  attacks: AttackRow[];
  features: FeatureRow[];
  spellcasting: SpellcastingRow[];
  /** The first of `companions`, kept for older callers. */
  companion: CompanionSheet | null;
  /** Every companion the character has: a beast companion, a familiar, a steel defender… */
  companions: CompanionSheet[];
  /** Names of companion choices still open ("Primal Companion"); flagged on the sheet, never blocking. */
  pendingCompanions: string[];
  /** Shared slots when several classes contribute to the multiclass caster level. */
  multiclassSpellcasting: { casterLevel: number; slots: number[] } | null;
  conditions: string[];
  warnings: string[];
}

const FEATURE_TYPES = new Set([
  "Racial Trait",
  "Class Feature",
  "Archetype Feature",
  "Feat",
  "Feat Feature",
  "Background Feature",
  "Archetype",
  "Dragonmark",
]);

function first(rc: ResolvedCharacter, type: string): ElementDef | undefined {
  return rc.nodes.find((n) => n.element.type === type)?.element;
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

/** Replace {{stat}} and $(stat) placeholders with values. */
export function substitute(rc: ResolvedCharacter, text: string): string {
  const repl = (name: string): string => {
    const key = name.trim().toLowerCase();
    if (rc.stats.has(key)) return String(rc.stats.get(key));
    const inline = rc.inline.get(key);
    if (inline !== undefined) return inline;
    return `{{${name}}}`;
  };
  return text.replace(/\{\{([^}]+)\}\}/g, (_, n: string) => repl(n)).replace(/\$\(([^)]+)\)/g, (_, n: string) => repl(n));
}

function optionalSubstitute(rc: ResolvedCharacter, text: string | undefined): string | undefined {
  return text === undefined ? undefined : substitute(rc, text);
}

function originOf(node: ResolvedNode): string {
  for (let n = node.parent; n; n = n.parent) {
    const t = n.element.type;
    if (t === "Race" || t === "Sub Race" || t === "Class" || t === "Multiclass" || t === "Background" || t === "Feat" || t === "Archetype") {
      return n.element.name;
    }
  }
  return "";
}

export function buildSheet(rc: ResolvedCharacter): CharacterSheet {
  const s = rc.stats;
  const abilities: AbilityRow[] = ABILITIES.map((a) => ({
    ability: a,
    abbr: ABILITY_ABBR[a].toUpperCase(),
    base: rc.state.abilities[a],
    score: s.abilityScore(a),
    modifier: s.abilityModifier(a),
    breakdown: s.breakdown(`${a}:score`),
  }));
  const prof = s.get("proficiency");

  const savingThrows: CheckRow[] = ABILITIES.map((a) => {
    const p = s.get(`${a}:save:proficiency`);
    const misc = s.get(`${a}:save:misc`);
    return {
      name: a.charAt(0).toUpperCase() + a.slice(1),
      ability: a,
      total: s.abilityModifier(a) + p + misc,
      proficient: p > 0,
      expertise: prof > 0 && p >= prof * 2,
      breakdown: [{ source: "Ability", value: s.abilityModifier(a) }, ...s.breakdown(`${a}:save:proficiency`), ...s.breakdown(`${a}:save:misc`)],
    };
  });

  const skills: CheckRow[] = SKILLS.map(({ name, ability }) => {
    const key = name.toLowerCase();
    const p = s.get(`${key}:proficiency`);
    const misc = s.get(`${key}:misc`);
    return {
      name,
      ability,
      total: s.abilityModifier(ability) + p + misc,
      proficient: p > 0,
      expertise: prof > 0 && p >= prof * 2,
      breakdown: [{ source: "Ability", value: s.abilityModifier(ability) }, ...s.breakdown(`${key}:proficiency`), ...s.breakdown(`${key}:misc`)],
    };
  });
  const passive = (skill: string) => 10 + (skills.find((k) => k.name === skill)?.total ?? 0) + s.get(`${skill.toLowerCase()}:passive`);

  const classParts: string[] = [];
  for (const [id, lv] of rc.classLevels) {
    const cls = rc.registry.get(id);
    if (!cls) continue;
    const arch = rc.nodes.find(
      (n) => n.element.type === "Archetype" && n.scope.kind === "class" && n.scope.classId === id,
    );
    classParts.push(`${cls.name}${arch ? ` (${arch.element.name})` : ""} ${lv}`);
  }
  const hitDice: string[] = [];
  for (const [id, lv] of rc.classLevels) {
    const hd = rc.registry.get(id) ? getSetter(rc.registry.get(id)!, "hd") : undefined;
    if (hd) hitDice.push(`${lv}${hd}`);
  }

  const profs = { armor: [] as string[], weapons: [] as string[], tools: [] as string[], skills: [] as string[], savingThrows: [] as string[], other: [] as string[] };
  const languages: string[] = [];
  const vision: { name: string; range: number }[] = [];
  const conditions: string[] = [];
  const features: FeatureRow[] = [];
  const seenFeatures = new Set<string>();

  for (const node of rc.nodes) {
    const el = node.element;
    switch (el.type) {
      case "Proficiency": {
        // Group proficiencies ("Martial Weapons") grant each member; list only the group.
        if (node.parent?.element.type === "Proficiency") break;
        const id = el.id;
        if (id.includes("_ARMOR_")) profs.armor.push(el.name);
        else if (id.includes("_WEAPON_")) profs.weapons.push(el.name);
        else if (id.includes("_TOOL_")) profs.tools.push(el.name);
        else if (id.includes("_SKILL_")) profs.skills.push(el.name);
        else if (id.includes("_SAVINGTHROW_")) profs.savingThrows.push(el.name);
        else profs.other.push(el.name);
        break;
      }
      case "Language":
        languages.push(el.name);
        break;
      case "Vision": {
        const range = s.get(`${el.name.toLowerCase()}:range`);
        vision.push({ name: el.name, range });
        break;
      }
      case "Condition":
        conditions.push(el.name);
        break;
    }
    if (FEATURE_TYPES.has(el.type) && el.sheet?.display !== false && !seenFeatures.has(el.id)) {
      seenFeatures.add(el.id);
      const descs = el.sheet?.descriptions.filter((d) => d.level <= node.level) ?? [];
      const best = descs.length ? descs[descs.length - 1] : undefined;
      features.push({
        id: el.id,
        name: el.sheet?.alt ?? el.name,
        type: el.type,
        source: el.source,
        text: substitute(rc, best?.text ?? firstParagraph(el.description)),
        usage: optionalSubstitute(rc, best?.usage ?? el.sheet?.usage),
        action: optionalSubstitute(rc, best?.action ?? el.sheet?.action),
        origin: originOf(node),
        category: featCategory(el),
      });
    }
  }

  const { rows: spellcasting, multiclass: multiclassSpellcasting } = buildSpellcasting(rc);
  const companions = buildCompanions(rc, spellcasting);
  const pendingCompanions = rc.selections
    .filter((p) => p.rule.type === "Companion" && !p.rule.optional && p.chosen.some((c) => c === null))
    .map((p) => p.rule.name);

  const warnings: string[] = rc.issues.filter((i) => i.severity !== "info").map((i) => i.message);
  for (const p of rc.selections) {
    if (p.rule.optional || p.rule.type === "Class") continue;
    const missing = p.chosen.filter((c) => c === null).length;
    if (missing > 0) warnings.push(`${p.rule.name}: ${missing} choice${missing > 1 ? "s" : ""} remaining`);
  }
  if (!rc.mainClass) warnings.push("No class chosen");
  // A new character (no coins or gear yet) still has to pick its starting wealth.
  const st = rc.state;
  if (rc.mainClass && !st.startingWealth && st.inventory.length === 0 && Object.values(st.currency).every((n) => !n))
    warnings.push("Starting wealth: not chosen");
  for (const n of rc.nodes) {
    if (n.element.type === "Multiclass" && !meetsRequirements(rc, n.element.requirements)) {
      warnings.push(`Multiclass prerequisites not met for ${n.element.name}${n.element.prerequisite ? ` (${n.element.prerequisite})` : ""}`);
    }
  }

  return {
    name: rc.state.name,
    level: rc.level,
    classSummary: classParts.join(" / "),
    race: first(rc, "Race")?.name,
    subrace: first(rc, "Sub Race")?.name,
    background: first(rc, "Background")?.name,
    alignment: first(rc, "Alignment")?.name,
    deity: first(rc, "Deity")?.name,
    size: first(rc, "Size")?.name,
    proficiencyBonus: prof,
    abilities,
    savingThrows,
    skills,
    passivePerception: passive("Perception"),
    passiveInsight: passive("Insight"),
    passiveInvestigation: passive("Investigation"),
    armorClass: s.get("ac"),
    armorClassBreakdown: s.breakdown("ac"),
    initiative: s.get("initiative"),
    speed: {
      walk: s.get("speed"),
      climb: s.get("speed:climb"),
      swim: s.get("speed:swim"),
      fly: s.get("speed:fly"),
      burrow: s.get("speed:burrow"),
    },
    maxHp: s.get("hp") + s.get("hp:starting"),
    hpBreakdown: s.breakdown("hp"),
    hitDice: hitDice.join(" + "),
    vision,
    proficiencies: {
      armor: unique(profs.armor),
      weapons: unique(profs.weapons),
      tools: unique(profs.tools),
      skills: unique(profs.skills),
      savingThrows: unique(profs.savingThrows),
      other: unique(profs.other),
    },
    languages: unique(languages),
    attacks: buildAttacks(rc),
    features,
    spellcasting,
    multiclassSpellcasting,
    companion: companions[0] ?? null,
    companions,
    pendingCompanions: unique(pendingCompanions),
    conditions: unique(conditions),
    warnings: unique(warnings),
  };
}

function buildCompanions(rc: ResolvedCharacter, spellcasting: SpellcastingRow[]): CompanionSheet[] {
  const classLevels = new Map<string, number>();
  for (const [id, lv] of rc.classLevels) {
    const name = rc.registry.get(id)?.name.toLowerCase();
    if (name) classLevels.set(name, lv);
  }
  return rc.companions.map((c) => {
    // "Your spell attack modifier" is the one of the class the companion comes from.
    const scope = c.node.scope;
    const caster =
      (scope.kind === "class" ? spellcasting.find((r) => r.name.toLowerCase() === scope.className.toLowerCase()) : undefined) ??
      (spellcasting.length === 1 ? spellcasting[0] : undefined);
    return buildCompanionSheet(c, rc.registry, { classLevels, spellAttack: caster?.attack, spellDc: caster?.dc });
  });
}

function buildSpellcasting(rc: ResolvedCharacter): { rows: SpellcastingRow[]; multiclass: { casterLevel: number; slots: number[] } | null } {
  const s = rc.stats;
  const casters = findCasters(rc);
  const multiclass = multiclassSpellSlots(rc);
  const rows = casters.map((caster): SpellcastingRow => {
    const abbr = caster.ability.slice(0, 3).toLowerCase();
    const name = caster.name.toLowerCase();
    const slots: number[] = [];
    for (let i = 1; i <= 9; i++) slots.push(s.get(`${name}:spellcasting:slots:${i}`));
    const opt = (stat: string) => (s.has(stat) ? s.get(stat) : undefined);
    const known = casterSpells(rc, caster, casters);
    const prepared = new Set(rc.state.preparedSpells[caster.name] ?? []);
    const preparable = caster.mode === "list" ? preparableSpells(rc, caster) : [];
    const spells = known.map((sp) => ({
      id: sp.element.id,
      name: sp.element.name,
      level: sp.level,
      alwaysPrepared: sp.alwaysPrepared,
      prepared: caster.mode === "known" || sp.alwaysPrepared || prepared.has(sp.element.id),
    }));
    // "List" casters prepare from the whole class list; include those choices.
    for (const el of preparable) {
      if (prepared.has(el.id) && !spells.some((x) => x.id === el.id)) {
        spells.push({ id: el.id, name: el.name, level: spellLevel(el), alwaysPrepared: false, prepared: true });
      }
    }
    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return {
      name: caster.name,
      ability: caster.ability,
      mode: caster.mode,
      attack: s.get(`spellcasting:attack:${abbr}`) + s.get(`${name}:spellcasting:attack`),
      dc: s.get(`spellcasting:dc:${abbr}`) + s.get(`${name}:spellcasting:dc`),
      prepare: caster.mode !== "known",
      slots: multiclass && slots.some((n) => n > 0) && caster.mode !== "known" ? multiclass.slots : slots,
      cantripsKnown: opt(`${name}:spellcasting:cantrips known`),
      spellsKnown: opt(`${name}:spellcasting:spells known`),
      prepareCount: preparedLimit(rc, caster),
      preparedCount: spells.filter((x) => x.level > 0 && x.prepared && !x.alwaysPrepared).length,
      spells,
    };
  });
  return { rows, multiclass };
}

/** Short sheet text for elements without a <sheet> description: the first paragraph. */
export function firstParagraph(html: string): string {
  const m = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  return stripHtml(m ? m[1] : html).split("\n")[0] ?? "";
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

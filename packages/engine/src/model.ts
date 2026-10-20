/** Data model for content elements, mirroring the Aurora element file format. */

export interface Setter {
  name: string;
  value: string;
  /** Any extra attributes on the <set> node (e.g. type="male" on names). */
  attrs: Record<string, string>;
}

export interface GrantRule {
  kind: "grant";
  type: string;
  id: string;
  level: number;
  requirements?: string;
  /** Extra info such as spellcasting="Wizard" / prepared="true". */
  setters: Record<string, string>;
}

export interface SelectListItem {
  id: number;
  text: string;
}

export interface SelectRule {
  kind: "select";
  type: string;
  name: string;
  number: number;
  level: number;
  requirements?: string;
  supports?: string;
  optional: boolean;
  /** Default element id (or list item id) to pick. */
  default?: string;
  spellcasting?: string;
  prepared?: boolean;
  /** For type="List": the inline choices. */
  items: SelectListItem[];
  /** For type="List": stat that receives the chosen item id. */
  stat?: string;
}

export interface StatRule {
  kind: "stat";
  name: string;
  /** Raw value: an integer, a stat name, or a stat name prefixed with '-'. */
  value: string;
  /** Stacking group; within one stat, only the highest value per bonus applies. */
  bonus?: string;
  level: number;
  requirements?: string;
  equipped?: string;
  inline: boolean;
  maximum?: string;
  minimum?: string;
  alt?: string;
  merge: boolean;
}

export type Rule = GrantRule | SelectRule | StatRule;

export interface SheetDescription {
  text: string;
  level: number;
  usage?: string;
  action?: string;
}

export interface SheetInfo {
  display: boolean;
  alt?: string;
  usage?: string;
  action?: string;
  descriptions: SheetDescription[];
}

export interface SpellcastingInfo {
  name: string;
  ability: string;
  prepare: boolean;
  extend: boolean;
  allowReplace: boolean;
  all: boolean;
  /** Supports expression for the initial spell list. */
  list?: string;
  listKnown: boolean;
  extendLists: { expression: string; known: boolean }[];
}

export interface MulticlassInfo {
  id: string;
  prerequisite?: string;
  requirements?: string;
  description?: string;
  setters: Setter[];
  rules: Rule[];
}

export interface ElementDef {
  id: string;
  name: string;
  type: string;
  source: string;
  supports: string[];
  requirements?: string;
  prerequisite?: string;
  /** HTML fragment. */
  description: string;
  sheet?: SheetInfo;
  setters: Setter[];
  rules: Rule[];
  spellcasting?: SpellcastingInfo;
  multiclass?: MulticlassInfo;
  compendiumDisplay: boolean;
  /** File the element was loaded from (for diagnostics). */
  file?: string;
}

export function getSetter(el: Pick<ElementDef, "setters">, name: string): string | undefined {
  const lower = name.toLowerCase();
  return el.setters.find((s) => s.name.toLowerCase() === lower)?.value;
}

export function getSetters(el: Pick<ElementDef, "setters">, name: string): Setter[] {
  const lower = name.toLowerCase();
  return el.setters.filter((s) => s.name.toLowerCase() === lower);
}

export function allowsDuplicate(el: ElementDef): boolean {
  return (getSetter(el, "allow duplicate") ?? "").trim().toLowerCase() === "true";
}

/** Feat categories introduced by the 2024 rules, as content tags them in `<supports>`. */
export const FEAT_CATEGORIES = ["Origin", "General", "Fighting Style", "Epic Boon"] as const;
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

/** The 2024 category of a feat ("Origin" for feats a background can grant), if its content declares one. */
export function featCategory(el: Pick<ElementDef, "type" | "supports">): FeatCategory | undefined {
  if (el.type !== "Feat") return undefined;
  const tags = new Set(el.supports.map((s) => s.trim().toLowerCase()));
  return FEAT_CATEGORIES.find((c) => tags.has(c.toLowerCase()));
}

export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_ABBR: Record<Ability, string> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const SKILLS: { name: string; ability: Ability }[] = [
  { name: "Acrobatics", ability: "dexterity" },
  { name: "Animal Handling", ability: "wisdom" },
  { name: "Arcana", ability: "intelligence" },
  { name: "Athletics", ability: "strength" },
  { name: "Deception", ability: "charisma" },
  { name: "History", ability: "intelligence" },
  { name: "Insight", ability: "wisdom" },
  { name: "Intimidation", ability: "charisma" },
  { name: "Investigation", ability: "intelligence" },
  { name: "Medicine", ability: "wisdom" },
  { name: "Nature", ability: "intelligence" },
  { name: "Perception", ability: "wisdom" },
  { name: "Performance", ability: "charisma" },
  { name: "Persuasion", ability: "charisma" },
  { name: "Religion", ability: "intelligence" },
  { name: "Sleight of Hand", ability: "dexterity" },
  { name: "Stealth", ability: "dexterity" },
  { name: "Survival", ability: "wisdom" },
];

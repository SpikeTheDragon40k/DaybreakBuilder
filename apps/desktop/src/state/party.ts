import { ABILITIES, type Ability, type CharacterSheet, type CharacterState, type Currency, type RulesEdition } from "@daybreakbuilder/engine";

/** A group of saved characters a DM runs together. Members are character ids. */
export interface Party {
  id: string;
  name: string;
  memberIds: string[];
  notes: string;
  /** The encounter the DM is planning. Missing in parties saved before the calculator. */
  encounter?: PartyEncounter;
  updatedAt: string;
}

/** One line of the encounter: a kind of monster and how many of them. */
export interface EncounterLine {
  id: string;
  name: string;
  cr: string;
  /** XP per monster when it differs from the CR's (0 = use the CR). */
  xp: number;
  count: number;
}

export interface PartyEncounter {
  rules: RulesEdition;
  monsters: EncounterLine[];
  /** Extra party members not in the roster (sidekicks, guest players), by level. */
  extraLevels: number[];
}

export function newEncounter(): PartyEncounter {
  return { rules: "2024", monsters: [], extraLevels: [] };
}

export function newParty(id: string, name = "New Party"): Party {
  return { id, name, memberIds: [], notes: "", encounter: newEncounter(), updatedAt: new Date().toISOString() };
}

/** What the DM needs at the table about one character. */
export interface PartyMember {
  id: string;
  name: string;
  playerName: string;
  portrait: string;
  summary: string;
  level: number;
  armorClass: number;
  maxHp: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  /** Spell save DCs, one per spellcasting class. */
  spellDcs: { name: string; dc: number }[];
  vision: { name: string; range: number }[];
  languages: string[];
  defenses: string[];
  saves: { ability: Ability; total: number; proficient: boolean }[];
  skills: { name: string; total: number; proficient: boolean }[];
  /** Everything the character carries in coin, in gold pieces. */
  wealthGp: number;
}

export function memberFromSheet(id: string, state: CharacterState, sheet: CharacterSheet): PartyMember {
  return {
    id,
    name: sheet.name || "Unnamed",
    playerName: state.playerName,
    portrait: state.portrait,
    summary: [[sheet.race, sheet.subrace].filter(Boolean).join(" "), sheet.classSummary].filter(Boolean).join(" · "),
    level: sheet.level,
    armorClass: sheet.armorClass,
    maxHp: sheet.maxHp,
    initiative: sheet.initiative,
    speed: sheet.speed.walk,
    passivePerception: sheet.passivePerception,
    passiveInsight: sheet.passiveInsight,
    passiveInvestigation: sheet.passiveInvestigation,
    spellDcs: sheet.spellcasting.map((c) => ({ name: c.name, dc: c.dc })),
    vision: sheet.vision,
    languages: sheet.languages,
    defenses: sheet.conditions,
    saves: sheet.savingThrows.map((t) => ({ ability: t.ability, total: t.total, proficient: t.proficient })),
    skills: sheet.skills.map((k) => ({ name: k.name, total: k.total, proficient: k.proficient })),
    wealthGp: currencyInGp(state.currency),
  };
}

export function currencyInGp(c: Currency): number {
  return c.cp / 100 + c.sp / 10 + c.ep / 2 + c.gp + c.pp * 10;
}

export interface Best {
  value: number;
  names: string[];
}

export interface PartySummary {
  size: number;
  averageLevel: number;
  wealthGp: number;
  passivePerception: Best;
  passiveInsight: Best;
  passiveInvestigation: Best;
  /** Language → who speaks it, most widely spoken first. */
  languages: { name: string; speakers: string[] }[];
  /** Best bonus per skill and who has it. */
  skills: { name: string; best: Best; proficient: string[] }[];
  /** Saving throw proficiencies per ability. */
  saves: { ability: Ability; proficient: string[] }[];
  /** Members who can't see in the dark. */
  noDarkvision: string[];
}

function best(members: PartyMember[], value: (m: PartyMember) => number): Best {
  if (!members.length) return { value: 0, names: [] };
  const top = Math.max(...members.map(value));
  return { value: top, names: members.filter((m) => value(m) === top).map((m) => m.name) };
}

export function summarizeParty(members: PartyMember[]): PartySummary {
  const languages = new Map<string, string[]>();
  for (const m of members) for (const l of m.languages) languages.set(l, [...(languages.get(l) ?? []), m.name]);

  const skillNames = members[0]?.skills.map((k) => k.name) ?? [];
  return {
    size: members.length,
    averageLevel: members.length ? members.reduce((n, m) => n + m.level, 0) / members.length : 0,
    wealthGp: members.reduce((n, m) => n + m.wealthGp, 0),
    passivePerception: best(members, (m) => m.passivePerception),
    passiveInsight: best(members, (m) => m.passiveInsight),
    passiveInvestigation: best(members, (m) => m.passiveInvestigation),
    languages: [...languages]
      .map(([name, speakers]) => ({ name, speakers }))
      .sort((a, b) => b.speakers.length - a.speakers.length || a.name.localeCompare(b.name)),
    skills: skillNames.map((name) => ({
      name,
      best: best(members, (m) => m.skills.find((k) => k.name === name)?.total ?? -Infinity),
      proficient: members.filter((m) => m.skills.find((k) => k.name === name)?.proficient).map((m) => m.name),
    })),
    saves: ABILITIES.map((ability) => ({
      ability,
      proficient: members.filter((m) => m.saves.find((s) => s.ability === ability)?.proficient).map((m) => m.name),
    })),
    noDarkvision: members.filter((m) => !m.vision.some((v) => /darkvision|devil's sight|truesight|blindsight/i.test(v.name))).map((m) => m.name),
  };
}

/** Gold amount for display: whole gp, or two decimals when there is change. */
export function formatGp(gp: number): string {
  const rounded = Math.round(gp * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} gp`;
}

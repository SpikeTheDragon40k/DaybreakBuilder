import { ABILITIES, type Ability, type CharacterSheet, type CharacterState, type Currency } from "@dndbuilder/engine";

/** A group of saved characters a DM runs together. Members are character ids. */
export interface Party {
  id: string;
  name: string;
  memberIds: string[];
  notes: string;
  updatedAt: string;
}

export function newParty(id: string, name = "New Party"): Party {
  return { id, name, memberIds: [], notes: "", updatedAt: new Date().toISOString() };
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

export type Difficulty = "easy" | "medium" | "hard" | "deadly";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

/** XP thresholds per character level (Dungeon Master's Guide 2014, p. 82). */
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
};

/** The party's combined XP threshold for each encounter difficulty. */
export function encounterBudget(levels: number[]): Record<Difficulty, number> {
  const budget: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const level of levels) {
    const row = XP_THRESHOLDS[Math.min(20, Math.max(1, level))];
    DIFFICULTIES.forEach((d, i) => (budget[d] += row[i]));
  }
  return budget;
}

export interface Best {
  value: number;
  names: string[];
}

export interface PartySummary {
  size: number;
  averageLevel: number;
  budget: Record<Difficulty, number>;
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
    budget: encounterBudget(members.map((m) => m.level)),
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

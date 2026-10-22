/**
 * Encounter difficulty.
 *
 * 2024 rules (Dungeon Master's Guide 2024): each character adds an XP budget
 * for Low, Moderate and High difficulty; monsters' XP is simply summed.
 * 2014 rules (Dungeon Master's Guide 2014, pp. 81–83): each character adds an
 * Easy/Medium/Hard/Deadly threshold, and the monsters' XP is multiplied by a
 * factor that grows with the number of monsters and shifts with party size.
 */
import type { RulesEdition } from "./editions.js";

/** Experience points by challenge rating. */
export const XP_BY_CR: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

export const CHALLENGE_RATINGS = Object.keys(XP_BY_CR);

/** Normalizes "0.5", " 1/2 ", "CR 2" or "2 (450 XP)" to a key of XP_BY_CR, or "" when it isn't one. */
export function normalizeChallenge(text: string): string {
  const m = /(\d+(?:\.\d+)?(?:\/\d+)?)/.exec(text.replace(/^\s*cr\s*/i, ""));
  if (!m) return "";
  const raw = m[1];
  if (raw in XP_BY_CR) return raw;
  const fractions: Record<string, string> = { "0.125": "1/8", "0.25": "1/4", "0.5": "1/2" };
  return fractions[raw] ?? (String(Number(raw)) in XP_BY_CR ? String(Number(raw)) : "");
}

export function challengeXp(cr: string): number {
  return XP_BY_CR[normalizeChallenge(cr)] ?? 0;
}

/** Challenge rating as a number (1/4 → 0.25), for comparisons with levels. */
export function challengeValue(cr: string): number {
  const key = normalizeChallenge(cr);
  if (!key) return 0;
  const [n, d] = key.split("/").map(Number);
  return d ? n / d : n;
}

export type Difficulty2024 = "low" | "moderate" | "high";
export type Difficulty2014 = "easy" | "medium" | "hard" | "deadly";
export type EncounterDifficulty = Difficulty2024 | Difficulty2014;

export const DIFFICULTIES_2024: Difficulty2024[] = ["low", "moderate", "high"];
export const DIFFICULTIES_2014: Difficulty2014[] = ["easy", "medium", "hard", "deadly"];

export function encounterDifficulties(rules: RulesEdition): EncounterDifficulty[] {
  return rules === "2024" ? DIFFICULTIES_2024 : DIFFICULTIES_2014;
}

/** XP budget per character level (Dungeon Master's Guide 2024). */
const XP_BUDGET_2024: Record<number, [number, number, number]> = {
  1: [50, 75, 100],
  2: [100, 150, 200],
  3: [150, 225, 400],
  4: [250, 375, 500],
  5: [500, 750, 1100],
  6: [600, 1000, 1400],
  7: [750, 1300, 1700],
  8: [1000, 1700, 2100],
  9: [1300, 2000, 2600],
  10: [1600, 2300, 3100],
  11: [1900, 2900, 4100],
  12: [2200, 3700, 4700],
  13: [2600, 4200, 5400],
  14: [2900, 4900, 6200],
  15: [3300, 5400, 7800],
  16: [3800, 6100, 9800],
  17: [4500, 7200, 11700],
  18: [5000, 8700, 14200],
  19: [5500, 10700, 17200],
  20: [6400, 13200, 22000],
};

/** XP thresholds per character level (Dungeon Master's Guide 2014, p. 82). */
const XP_THRESHOLDS_2014: Record<number, [number, number, number, number]> = {
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

const clampLevel = (level: number) => Math.min(20, Math.max(1, Math.floor(level) || 1));

/** The party's combined XP budget (2024) or thresholds (2014) for each difficulty. */
export function encounterBudget(levels: number[], rules: RulesEdition): Partial<Record<EncounterDifficulty, number>> {
  const difficulties = encounterDifficulties(rules);
  const table: Record<number, number[]> = rules === "2024" ? XP_BUDGET_2024 : XP_THRESHOLDS_2014;
  const budget: Partial<Record<EncounterDifficulty, number>> = Object.fromEntries(difficulties.map((d) => [d, 0]));
  for (const level of levels) {
    const row = table[clampLevel(level)];
    difficulties.forEach((d, i) => (budget[d] = (budget[d] ?? 0) + row[i]));
  }
  return budget;
}

/** 2014 encounter multipliers, from the "fewer than three characters" step to the "six or more" one. */
const MULTIPLIERS_2014 = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

/** The 2014 encounter multiplier for a number of monsters against a party of a given size. */
export function encounterMultiplier(monsters: number, partySize: number): number {
  if (monsters <= 0) return 1;
  let step = monsters === 1 ? 1 : monsters === 2 ? 2 : monsters <= 6 ? 3 : monsters <= 10 ? 4 : monsters <= 14 ? 5 : 6;
  if (partySize > 0 && partySize < 3) step += 1;
  else if (partySize >= 6) step -= 1;
  return MULTIPLIERS_2014[step];
}

export interface EncounterMonster {
  name?: string;
  /** Challenge rating, e.g. "1/4" or "5". Ignored when xp is set. */
  cr?: string;
  /** XP per monster, for creatures whose XP differs from their CR (e.g. lair variants). */
  xp?: number;
  count: number;
}

export interface EncounterRating {
  rules: RulesEdition;
  partySize: number;
  monsterCount: number;
  /** Sum of the monsters' XP: what the party earns. */
  totalXp: number;
  /** 2014: XP × multiplier, compared to the thresholds. 2024: same as totalXp. */
  adjustedXp: number;
  multiplier: number;
  budget: Partial<Record<EncounterDifficulty, number>>;
  /** Highest difficulty reached, or "trivial" below the lowest one. */
  difficulty: EncounterDifficulty | "trivial";
  /** 2024: the encounter goes past the High budget. */
  overBudget: boolean;
  /** XP left before the next difficulty, or 0 at the top. */
  toNext: number;
  /** Strongest monster's challenge rating, as a number. */
  highestCr: number;
}

export function monsterXp(m: EncounterMonster): number {
  return m.xp != null && m.xp > 0 ? m.xp : challengeXp(m.cr ?? "");
}

export function rateEncounter(levels: number[], monsters: EncounterMonster[], rules: RulesEdition): EncounterRating {
  const active = monsters.filter((m) => m.count > 0);
  const monsterCount = active.reduce((n, m) => n + m.count, 0);
  const totalXp = active.reduce((n, m) => n + monsterXp(m) * m.count, 0);
  const multiplier = rules === "2014" ? encounterMultiplier(monsterCount, levels.length) : 1;
  const adjustedXp = Math.round(totalXp * multiplier);
  const budget = encounterBudget(levels, rules);
  const difficulties = encounterDifficulties(rules);

  let difficulty: EncounterDifficulty | "trivial" = "trivial";
  let toNext = 0;
  for (const d of difficulties) {
    const threshold = budget[d] ?? 0;
    if (adjustedXp > 0 && adjustedXp >= threshold) difficulty = d;
    else {
      toNext = threshold - adjustedXp;
      break;
    }
  }
  const top = budget[difficulties[difficulties.length - 1]] ?? 0;
  return {
    rules,
    partySize: levels.length,
    monsterCount,
    totalXp,
    adjustedXp,
    multiplier,
    budget,
    difficulty,
    overBudget: rules === "2024" && adjustedXp > top && top > 0,
    toNext,
    highestCr: Math.max(0, ...active.map((m) => challengeValue(m.cr ?? ""))),
  };
}

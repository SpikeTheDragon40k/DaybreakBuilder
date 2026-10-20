import type { CharacterState, Currency } from "./character.js";
import { getSetter, getSetters, type ElementDef } from "./model.js";
import type { ResolvedCharacter } from "./resolver.js";

export type Coin = keyof Currency;

/** Smallest to largest. */
export const COINS: Coin[] = ["cp", "sp", "ep", "gp", "pp"];

/** Value of one coin in copper pieces. */
export const COIN_VALUE: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** 50 coins weigh a pound, whatever the metal. */
export const COINS_PER_POUND = 50;

export function emptyCurrency(): Currency {
  return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}

/** Total value of a purse in copper pieces. */
export function currencyValue(c: Currency): number {
  return COINS.reduce((n, coin) => n + (c[coin] || 0) * COIN_VALUE[coin], 0);
}

export function coinCount(c: Currency): number {
  return COINS.reduce((n, coin) => n + (c[coin] || 0), 0);
}

export function coinWeight(c: Currency): number {
  return coinCount(c) / COINS_PER_POUND;
}

/** A copper amount in gold pieces: 1234 → "12.34 gp", 50 → "5 sp", 3 → "3 cp". */
export function formatPrice(cp: number): string {
  if (cp % COIN_VALUE.gp === 0 || cp >= COIN_VALUE.gp) {
    const gp = cp / COIN_VALUE.gp;
    return `${Number.isInteger(gp) ? gp.toLocaleString("en-US") : gp.toLocaleString("en-US", { maximumFractionDigits: 2 })} gp`;
  }
  return cp % COIN_VALUE.sp === 0 ? `${cp / COIN_VALUE.sp} sp` : `${cp} cp`;
}

/** "2 pp, 15 gp, 3 sp" (largest first, empty coins left out); "0 gp" for an empty purse. */
export function formatCurrency(c: Currency): string {
  const parts = [...COINS].reverse().filter((coin) => c[coin]).map((coin) => `${c[coin].toLocaleString("en-US")} ${coin}`);
  return parts.length ? parts.join(", ") : "0 gp";
}

/** Price of an item in copper from its `cost` setter (`<set name="cost" currency="gp">5</set>`), if it has one. */
export function itemCost(el: ElementDef): number | undefined {
  const s = getSetters(el, "cost")[0];
  if (!s) return undefined;
  const m = /^\s*([\d,]*\.?\d+)\s*(cp|sp|ep|gp|pp)?\s*$/i.exec(s.value);
  if (!m) return undefined;
  const coin = ((m[2] ?? s.attrs.currency ?? "gp").toLowerCase()) as Coin;
  if (!(coin in COIN_VALUE)) return undefined;
  const cp = Math.round(Number(m[1].replace(/,/g, "")) * COIN_VALUE[coin]);
  return cp > 0 ? cp : undefined;
}

/** Add coins (negative counts are clamped at zero). */
export function addCurrency(c: Currency, delta: Partial<Currency>): Currency {
  const out = { ...c };
  for (const coin of COINS) out[coin] = Math.max(0, (out[coin] || 0) + (delta[coin] ?? 0));
  return out;
}

/** Copper amount as the fewest gp, sp and cp coins (no electrum or platinum). */
export function makeChange(cp: number): Currency {
  const out = emptyCurrency();
  for (const coin of ["gp", "sp", "cp"] as const) {
    out[coin] = Math.floor(cp / COIN_VALUE[coin]);
    cp -= out[coin] * COIN_VALUE[coin];
  }
  return out;
}

/**
 * Pay `cp` copper from a purse the way a person would: the largest coins that
 * fit first, then break the smallest coin left and take the change in gp, sp
 * and cp. Returns null when the purse is short.
 */
export function spendCurrency(c: Currency, cp: number): Currency | null {
  if (cp <= 0) return { ...c };
  if (currencyValue(c) < cp) return null;
  const out = { ...c };
  let remaining = cp;
  for (const coin of [...COINS].reverse()) {
    const n = Math.min(out[coin] || 0, Math.floor(remaining / COIN_VALUE[coin]));
    out[coin] -= n;
    remaining -= n * COIN_VALUE[coin];
  }
  if (remaining === 0) return out;
  // Every coin left is worth more than what is still owed; break the smallest.
  const coin = COINS.find((k) => out[k] > 0)!;
  out[coin] -= 1;
  return addCurrency(out, makeChange(COIN_VALUE[coin] - remaining));
}

/**
 * Exchange copper, silver and electrum up into gold (keeping the same total
 * value); platinum is left as it is.
 */
export function consolidateCurrency(c: Currency): Currency {
  const loose = c.cp + c.sp * COIN_VALUE.sp + c.ep * COIN_VALUE.ep + c.gp * COIN_VALUE.gp;
  return { ...makeChange(loose), pp: c.pp };
}

// ---- Starting wealth ----

/** "5d4x10" → 5d4 × 10 gp; "155" → a fixed 155 gp. */
export interface WealthFormula {
  count: number;
  sides: number;
  multiplier: number;
  /** Set for a fixed amount (count is 0). */
  fixed?: number;
}

export function parseWealth(text: string | undefined): WealthFormula | undefined {
  if (!text) return undefined;
  const t = text.trim().toLowerCase().replace(/\s+/g, "").replace(/gp$/, "");
  const dice = /^(\d+)d(\d+)(?:[x×*](\d+))?$/.exec(t);
  if (dice) return { count: Number(dice[1]), sides: Number(dice[2]), multiplier: Number(dice[3] ?? 1) };
  if (/^\d+$/.test(t)) return { count: 0, sides: 0, multiplier: 1, fixed: Number(t) };
  return undefined;
}

export function formatWealth(f: WealthFormula): string {
  if (f.fixed !== undefined) return `${f.fixed} gp`;
  return `${f.count}d${f.sides}${f.multiplier !== 1 ? ` × ${f.multiplier}` : ""} gp`;
}

/** Average gold of a formula, rounded down like the PHB's table. */
export function averageWealth(f: WealthFormula): number {
  if (f.fixed !== undefined) return f.fixed;
  return Math.floor((f.count * (f.sides + 1)) / 2) * f.multiplier;
}

export function rollWealth(f: WealthFormula, random: () => number = Math.random): { gp: number; rolls: number[] } {
  if (f.fixed !== undefined) return { gp: f.fixed, rolls: [] };
  const rolls = Array.from({ length: f.count }, () => 1 + Math.floor(random() * f.sides));
  return { gp: rolls.reduce((a, b) => a + b, 0) * f.multiplier, rolls };
}

/** PHB (2014) "Starting Wealth by Class", for content that doesn't set `starting wealth`. */
const WEALTH_2014: Record<string, string> = {
  barbarian: "2d4x10",
  bard: "5d4x10",
  cleric: "5d4x10",
  druid: "2d4x10",
  fighter: "5d4x10",
  monk: "5d4",
  paladin: "5d4x10",
  ranger: "5d4x10",
  rogue: "4d4x10",
  sorcerer: "3d4x10",
  warlock: "4d4x10",
  wizard: "4d4x10",
  artificer: "5d4x10",
};

/** PHB (2024) gold a class gets instead of its starting equipment (option B). */
const WEALTH_2024: Record<string, string> = {
  barbarian: "75",
  bard: "90",
  cleric: "110",
  druid: "50",
  fighter: "155",
  monk: "50",
  paladin: "150",
  ranger: "150",
  rogue: "100",
  sorcerer: "50",
  warlock: "100",
  wizard: "55",
};

const is2024 = (el: ElementDef) => /2024/.test(el.source) || /PHB24|_2024_/.test(el.id);

/** The class's starting gold: its `starting wealth` setter, or the PHB table for its name. */
export function classWealth(cls: ElementDef): WealthFormula | undefined {
  const own = parseWealth(getSetter(cls, "starting wealth") ?? getSetter(cls, "starting gold"));
  if (own) return own;
  const key = cls.name.trim().toLowerCase();
  return parseWealth((is2024(cls) ? WEALTH_2024 : WEALTH_2014)[key]);
}

export interface BackgroundGold {
  /** Gold that comes with the background's equipment (the "pouch containing 15 gp"). */
  withEquipment: number;
  /** 2024 backgrounds: gold taken instead of the equipment, if offered. */
  instead?: number;
}

/**
 * A background's gold, from its `starting gold` setter (and `starting gold
 * instead`) or else from the "Equipment:" text of its description: the 2014
 * "… a pouch containing 15 gp" or the 2024 "Choose A or B: (A) …, 8 GP; or (B) 50 GP".
 */
export function backgroundGold(bg: ElementDef): BackgroundGold {
  const own = getSetter(bg, "starting gold");
  if (own !== undefined) {
    const instead = Number(getSetter(bg, "starting gold instead"));
    return { withEquipment: Number(own) || 0, ...(instead > 0 ? { instead } : {}) };
  }
  const text = bg.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const at = text.search(/equipment\s*:/i);
  if (at < 0) return { withEquipment: 0 };
  const equipment = text.slice(at).split(/(?<=\.)\s+(?=[A-Z][\w ]{2,30}:)/)[0];
  const amounts = [...equipment.matchAll(/(\d[\d,]*)\s*gp\b/gi)].map((m) => Number(m[1].replace(/,/g, "")));
  if (/\(B\)/.test(equipment) && amounts.length >= 2) {
    // "(A) gear …, 8 GP; or (B) 50 GP"
    const b = equipment.indexOf("(B)");
    const inA = [...equipment.slice(0, b).matchAll(/(\d[\d,]*)\s*gp\b/gi)].map((m) => Number(m[1].replace(/,/g, "")));
    const inB = [...equipment.slice(b).matchAll(/(\d[\d,]*)\s*gp\b/gi)].map((m) => Number(m[1].replace(/,/g, "")));
    return { withEquipment: inA.reduce((a, n) => a + n, 0), instead: inB[0] };
  }
  return { withEquipment: amounts.reduce((a, n) => a + n, 0) };
}

/** One way to take starting wealth. */
export interface StartingWealthOption {
  key: "equipment" | "average" | "roll" | "class-gold" | "background-gold" | "all-gold";
  label: string;
  /** Gold granted (for "roll", what the background adds on top of the roll). */
  gp: number;
  /** For "roll": the dice. */
  roll?: WealthFormula;
  /** Whether the class's and background's equipment are taken (to be added by hand). */
  classEquipment: boolean;
  backgroundEquipment: boolean;
}

export interface StartingWealth {
  className?: string;
  backgroundName?: string;
  /** "2014": wealth replaces class and background equipment; "2024": each is chosen on its own. */
  rules: "2014" | "2024";
  classWealth?: WealthFormula;
  background?: BackgroundGold;
  options: StartingWealthOption[];
}

/** What the character can take as starting wealth, from the starting class and background. */
export function startingWealth(rc: ResolvedCharacter): StartingWealth {
  const cls = rc.mainClass;
  const bgEl = rc.nodes.find((n) => n.element.type === "Background")?.element;
  const wealth = cls ? classWealth(cls) : undefined;
  const bg = bgEl ? backgroundGold(bgEl) : undefined;
  const pouch = bg?.withEquipment ?? 0;
  const rules = wealth?.fixed !== undefined || bg?.instead !== undefined ? "2024" : "2014";
  const options: StartingWealthOption[] = [];
  const eq = (key: StartingWealthOption["key"], label: string, gp: number, classEquipment: boolean, backgroundEquipment: boolean) =>
    options.push({ key, label, gp, classEquipment, backgroundEquipment });

  if (rules === "2014") {
    eq("equipment", pouch ? `Starting equipment and ${pouch} gp` : "Starting equipment", pouch, true, true);
    if (wealth) {
      options.push({ key: "roll", label: `Roll ${formatWealth(wealth)}`, gp: 0, roll: wealth, classEquipment: false, backgroundEquipment: false });
      eq("average", `Take the average, ${averageWealth(wealth)} gp`, averageWealth(wealth), false, false);
    }
  } else {
    const classGold = wealth ? averageWealth(wealth) : undefined;
    const bgGold = bg?.instead;
    eq("equipment", pouch ? `Class and background equipment, ${pouch} gp` : "Class and background equipment", pouch, true, true);
    if (classGold !== undefined) eq("class-gold", `${classGold + pouch} gp and background equipment`, classGold + pouch, false, true);
    if (bgGold !== undefined) eq("background-gold", `Class equipment and ${bgGold} gp`, bgGold, true, false);
    if (classGold !== undefined && bgGold !== undefined) eq("all-gold", `No equipment, ${classGold + bgGold} gp`, classGold + bgGold, false, false);
  }

  return { className: cls?.name, backgroundName: bgEl?.name, rules, classWealth: wealth, background: bg, options };
}

/** Record of the starting wealth a character took (kept so it isn't granted twice and can be undone). */
export interface StartingWealthTaken {
  option: StartingWealthOption["key"];
  gp: number;
  /** Dice results, when rolled. */
  rolls?: number[];
}

/**
 * Take a starting-wealth option: adds its gold to the purse and records it.
 * Taking again replaces the earlier choice (its gold is removed first, as far
 * as the purse still holds it).
 */
export function takeStartingWealth(
  state: CharacterState,
  option: StartingWealthOption,
  random: () => number = Math.random,
): StartingWealthTaken {
  if (state.startingWealth) clearStartingWealth(state);
  let gp = option.gp;
  let rolls: number[] | undefined;
  if (option.roll) {
    const r = rollWealth(option.roll, random);
    gp += r.gp;
    rolls = r.rolls;
  }
  state.currency = addCurrency(state.currency, { gp });
  state.startingWealth = { option: option.key, gp, ...(rolls ? { rolls } : {}) };
  return state.startingWealth;
}

/** Undo `takeStartingWealth`: remove its gold (as much as is left) and forget the choice. */
export function clearStartingWealth(state: CharacterState): void {
  const taken = state.startingWealth;
  if (!taken) return;
  const owed = Math.min(taken.gp * COIN_VALUE.gp, currencyValue(state.currency));
  state.currency = spendCurrency(state.currency, owed) ?? state.currency;
  delete state.startingWealth;
}

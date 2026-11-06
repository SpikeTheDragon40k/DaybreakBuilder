/**
 * Play mode: what changes at the table during a session (hit points, spent
 * spell slots and feature uses, conditions) and the math around it. Dice are
 * rolled for real; the player types the result and this works out the rest.
 */
import type { AttackRow } from "./attacks.js";
import type { RulesEdition } from "./editions.js";
import type { CharacterSheet } from "./sheet.js";

export const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

export const MAX_EXHAUSTION = 6;
/** Log entries kept per character. */
export const PLAY_LOG_LIMIT = 100;

export interface PlayLogEntry {
  /** ISO timestamp. */
  at: string;
  text: string;
}

/** The live state of a character at the table; saved with the character. */
export interface PlayState {
  /** Current hit points, or null when at the maximum (so a level up keeps the character at full). */
  hp: number | null;
  tempHp: number;
  deathSaves: { successes: number; failures: number };
  /** Spent spell slots, keyed by `${pool}:${level}` (see `slotPools`). */
  spentSlots: Record<string, number>;
  /** Spent uses of limited features, keyed by feature id. */
  usedFeatures: Record<string, number>;
  /** Spent hit dice, keyed by die ("d8"). */
  hitDiceSpent: Record<string, number>;
  conditions: string[];
  exhaustion: number;
  heroicInspiration: boolean;
  /** Newest last. */
  log: PlayLogEntry[];
}

export function newPlayState(): PlayState {
  return {
    hp: null,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    spentSlots: {},
    usedFeatures: {},
    hitDiceSpent: {},
    conditions: [],
    exhaustion: 0,
    heroicInspiration: false,
    log: [],
  };
}

/** Fill in fields missing from a saved play state (older files, hand edits). */
export function loadPlayState(data: unknown): PlayState {
  const base = newPlayState();
  if (!data || typeof data !== "object") return base;
  const d = data as Partial<PlayState>;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    hp: d.hp === null || d.hp === undefined ? null : num(d.hp, 0),
    tempHp: num(d.tempHp, 0),
    deathSaves: { successes: num(d.deathSaves?.successes, 0), failures: num(d.deathSaves?.failures, 0) },
    spentSlots: { ...(d.spentSlots ?? {}) },
    usedFeatures: { ...(d.usedFeatures ?? {}) },
    hitDiceSpent: { ...(d.hitDiceSpent ?? {}) },
    conditions: Array.isArray(d.conditions) ? d.conditions.filter((c): c is string => typeof c === "string") : [],
    exhaustion: Math.min(MAX_EXHAUSTION, Math.max(0, num(d.exhaustion, 0))),
    heroicInspiration: !!d.heroicInspiration,
    log: Array.isArray(d.log) ? d.log.slice(-PLAY_LOG_LIMIT) : [],
  };
}

export function logPlay(play: PlayState, text: string, now = new Date()): PlayState {
  return { ...play, log: [...play.log, { at: now.toISOString(), text }].slice(-PLAY_LOG_LIMIT) };
}

// ---------------------------------------------------------------------------
// Resources

export type Recharge = "short" | "long";

export interface FeatureResource {
  id: string;
  name: string;
  max: number;
  recharge: Recharge;
  usage: string;
}

export interface SlotPool {
  /** "shared" for the multiclass slots, otherwise the caster's name. */
  key: string;
  label: string;
  /** Slots per spell level, index 0 = level 1. */
  slots: number[];
  recharge: Recharge;
}

export interface HitDicePool {
  die: string;
  total: number;
}

const USES = /(\d+)\s*\/\s*(short rest|long rest|rest|day)\b/i;

/** Features whose sheet usage reads like "2/Long Rest", "1/Short Rest", "3/Rest" or "1/Day". */
export function featureResources(sheet: CharacterSheet): FeatureResource[] {
  const out: FeatureResource[] = [];
  for (const f of sheet.features) {
    const m = USES.exec(f.usage ?? "");
    if (!m) continue;
    const max = Number(m[1]);
    if (max <= 0 || out.some((r) => r.id === f.id)) continue;
    const per = m[2].toLowerCase();
    out.push({ id: f.id, name: f.name, max, recharge: per === "short rest" || per === "rest" ? "short" : "long", usage: f.usage! });
  }
  return out;
}

/**
 * Spell slot pools. Casters that share the multiclass table use one pool;
 * Pact Magic (warlock) slots are their own pool and come back on a Short Rest.
 */
export function slotPools(sheet: CharacterSheet): SlotPool[] {
  const pools: SlotPool[] = [];
  const shared = sheet.multiclassSpellcasting?.slots;
  for (const row of sheet.spellcasting) {
    if (!row.slots.some((n) => n > 0)) continue;
    if (shared && row.slots === shared) {
      if (!pools.some((p) => p.key === "shared")) pools.push({ key: "shared", label: "Spell slots", slots: shared, recharge: "long" });
      continue;
    }
    const pact = /warlock|pact/i.test(row.name);
    pools.push({ key: row.name, label: pact ? `${row.name} (Pact Magic)` : row.name, slots: row.slots, recharge: pact ? "short" : "long" });
  }
  if (pools.length === 1 && pools[0].key !== "shared" && pools[0].recharge === "long") pools[0] = { ...pools[0], label: "Spell slots" };
  return pools;
}

/** Hit dice by size from the sheet's "3d10 + 2d8". */
export function hitDicePools(sheet: CharacterSheet): HitDicePool[] {
  const out: HitDicePool[] = [];
  for (const m of sheet.hitDice.matchAll(/(\d+)\s*(d\d+)/g)) {
    const existing = out.find((p) => p.die === m[2]);
    if (existing) existing.total += Number(m[1]);
    else out.push({ die: m[2], total: Number(m[1]) });
  }
  return out.sort((a, b) => Number(b.die.slice(1)) - Number(a.die.slice(1)));
}

export const slotKey = (pool: string, level: number) => `${pool}:${level}`;

export function slotsLeft(play: PlayState, pool: SlotPool, level: number): number {
  return Math.max(0, (pool.slots[level - 1] ?? 0) - (play.spentSlots[slotKey(pool.key, level)] ?? 0));
}

export function usesLeft(play: PlayState, feature: FeatureResource): number {
  return Math.max(0, feature.max - (play.usedFeatures[feature.id] ?? 0));
}

export function hitDiceLeft(play: PlayState, pool: HitDicePool): number {
  return Math.max(0, pool.total - (play.hitDiceSpent[pool.die] ?? 0));
}

// ---------------------------------------------------------------------------
// Hit points

export function currentHp(play: PlayState, maxHp: number): number {
  return Math.max(0, Math.min(maxHp, play.hp ?? maxHp));
}

/** Damage comes off temporary hit points first. Damage at 0 HP is a failed death save. */
export function takeDamage(play: PlayState, maxHp: number, amount: number): PlayState {
  const dmg = Math.max(0, Math.floor(amount));
  if (dmg === 0) return play;
  const hp = currentHp(play, maxHp);
  const fromTemp = Math.min(play.tempHp, dmg);
  const rest = dmg - fromTemp;
  const next = { ...play, tempHp: play.tempHp - fromTemp, hp: Math.max(0, hp - rest) };
  let text = `Took ${dmg} damage`;
  if (fromTemp) text += ` (${fromTemp} from temporary HP)`;
  if (hp === 0 && rest > 0) {
    next.deathSaves = { ...play.deathSaves, failures: Math.min(3, play.deathSaves.failures + 1) };
    text += ", a failed death save";
  } else if (hp > 0 && next.hp === 0) {
    // Damage left over after dropping to 0 that reaches the maximum kills outright.
    text += rest - hp >= maxHp ? ": dropped to 0 HP, and the rest equals your maximum (instant death)" : ": dropped to 0 HP";
  }
  return logPlay(next, `${text}.`);
}

/** Healing can't go over the maximum; any healing at 0 HP ends dying. */
export function heal(play: PlayState, maxHp: number, amount: number, source = "Healed"): PlayState {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return play;
  const hp = currentHp(play, maxHp);
  const to = Math.min(maxHp, hp + n);
  const next: PlayState = { ...play, hp: to >= maxHp ? null : to };
  if (hp === 0) next.deathSaves = { successes: 0, failures: 0 };
  return logPlay(next, `${source} ${n}: ${hp} → ${to} HP.`);
}

/** Temporary hit points don't stack: keep the higher amount. */
export function gainTempHp(play: PlayState, amount: number): PlayState {
  const n = Math.max(0, Math.floor(amount));
  if (n <= play.tempHp) return logPlay(play, `Kept ${play.tempHp} temporary HP (new ${n} isn't higher).`);
  return logPlay({ ...play, tempHp: n }, `Gained ${n} temporary HP.`);
}

/** Spend one hit die during a Short Rest and heal by the rolled total (die + Constitution, rolled at the table). */
export function spendHitDie(play: PlayState, maxHp: number, pool: HitDicePool, healing: number): PlayState {
  if (hitDiceLeft(play, pool) === 0) return play;
  const spent = { ...play, hitDiceSpent: { ...play.hitDiceSpent, [pool.die]: (play.hitDiceSpent[pool.die] ?? 0) + 1 } };
  const healed = heal(spent, maxHp, Math.max(0, healing), `Spent a ${pool.die} hit die: healed`);
  return healed === spent ? logPlay(spent, `Spent a ${pool.die} hit die (no healing).`) : healed;
}

// ---------------------------------------------------------------------------
// Rests

export interface Resources {
  features: FeatureResource[];
  slots: SlotPool[];
  hitDice: HitDicePool[];
}

export function playResources(sheet: CharacterSheet): Resources {
  return { features: featureResources(sheet), slots: slotPools(sheet), hitDice: hitDicePools(sheet) };
}

/** Short Rest: features and Pact Magic slots that recharge on a Short Rest come back. */
export function shortRest(play: PlayState, res: Resources): PlayState {
  const usedFeatures = { ...play.usedFeatures };
  for (const f of res.features) if (f.recharge === "short") delete usedFeatures[f.id];
  const spentSlots = { ...play.spentSlots };
  for (const p of res.slots) if (p.recharge === "short") for (const k of Object.keys(spentSlots)) if (k.startsWith(`${p.key}:`)) delete spentSlots[k];
  return logPlay({ ...play, usedFeatures, spentSlots }, "Short Rest.");
}

/**
 * Long Rest: all hit points, slots and feature uses come back, temporary HP
 * end, Exhaustion drops by 1. Hit dice: all of them under the 2024 rules,
 * half the total (at least one) under the 2014 rules.
 */
export function longRest(play: PlayState, res: Resources, rules: RulesEdition): PlayState {
  const hitDiceSpent: Record<string, number> = {};
  if (rules === "2014") {
    let regain = Math.max(1, Math.floor(res.hitDice.reduce((n, p) => n + p.total, 0) / 2));
    for (const p of res.hitDice) {
      const spent = play.hitDiceSpent[p.die] ?? 0;
      const back = Math.min(spent, regain);
      regain -= back;
      if (spent - back > 0) hitDiceSpent[p.die] = spent - back;
    }
  }
  return logPlay(
    {
      ...play,
      hp: null,
      tempHp: 0,
      deathSaves: { successes: 0, failures: 0 },
      spentSlots: {},
      usedFeatures: {},
      hitDiceSpent,
      exhaustion: Math.max(0, play.exhaustion - 1),
    },
    "Long Rest.",
  );
}

// ---------------------------------------------------------------------------
// Attacks with dice rolled at the table

/** Penalty to d20 Tests (attack rolls, checks, saves) from Exhaustion under the 2024 rules: 2 per level. */
export function exhaustionPenalty(play: PlayState, rules: RulesEdition): number {
  return rules === "2024" ? 2 * play.exhaustion : 0;
}

export interface AttackResult {
  d20: number;
  total: number;
  critical: boolean;
  fumble: boolean;
  /** Known only when the target's AC is given. */
  hit?: boolean;
}

/** A natural 20 always hits (and is a critical hit), a natural 1 always misses. */
export function resolveAttack(attack: AttackRow, d20: number, opts: { penalty?: number; targetAc?: number } = {}): AttackResult {
  const total = d20 + attack.attack - (opts.penalty ?? 0);
  const critical = d20 === 20;
  const fumble = d20 === 1;
  const hit = critical ? true : fumble ? false : opts.targetAc !== undefined ? total >= opts.targetAc : undefined;
  return { d20, total, critical, fumble, hit };
}

/** Dice and flat bonus of an attack's damage ("1d8+3" → 1d8 and 3), doubled dice on a critical hit. */
export function damageRoll(attack: AttackRow, opts: { versatile?: boolean; critical?: boolean } = {}): { dice: string; bonus: number } {
  const text = (opts.versatile && attack.versatile) || attack.damage;
  const m = /^\s*(?:(\d+)d(\d+))?\s*(?:([+−-])\s*(\d+))?\s*$/.exec(text);
  if (!m) return { dice: "", bonus: Number(text) || 0 };
  const count = m[1] ? Number(m[1]) * (opts.critical ? 2 : 1) : 0;
  const dice = count ? `${count}d${m[2]}` : "";
  const bonus = m[4] ? (m[3] === "+" ? 1 : -1) * Number(m[4]) : m[1] ? 0 : Number(text) || 0;
  return { dice, bonus };
}

/** Total damage from the dice rolled at the table plus the attack's bonus (never below 0). */
export function damageTotal(attack: AttackRow, rolled: number, opts: { versatile?: boolean; critical?: boolean } = {}): number {
  const { dice, bonus } = damageRoll(attack, opts);
  return Math.max(0, (dice ? rolled : 0) + bonus);
}

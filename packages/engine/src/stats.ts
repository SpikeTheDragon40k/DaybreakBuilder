import { ABILITIES, type Ability } from "./model.js";

/** One <stat> rule that is active for the character. */
export interface StatContribution {
  stat: string;
  /** Integer literal, stat name, or "-statname". */
  value: string;
  bonus?: string;
  maximum?: string;
  minimum?: string;
  /** Display name for breakdowns (rule alt or element name). */
  source: string;
}

export interface StatSeed {
  stat: string;
  value: number;
  source: string;
}

export interface StatInput {
  contributions: StatContribution[];
  seeds: StatSeed[];
  baseAbilities: Record<Ability, number>;
  /** Cap ability scores at "<ability>:max" (20 by default). */
  useAbilityMaximum: boolean;
}

export interface StatPart {
  source: string;
  value: number;
  bonus?: string;
}

const ABILITY_SET = new Set<string>(ABILITIES);

/** Stats folded into "ac" at the end, only when positive (Aurora's merge behaviour). */
const AC_MERGES = ["ac:calculation", "ac:shield", "ac:misc"];

const INT_RE = /^-?\d+$/;

/**
 * Lazily evaluated statistic values.
 *
 * Every stat is the sum of its contributions, except that contributions
 * sharing a `bonus` type do not stack: only the highest of them counts.
 * Values may reference other stats, which are evaluated on demand.
 */
export class StatValues {
  private byStat = new Map<string, StatContribution[]>();
  private seeds = new Map<string, StatSeed[]>();
  private cache = new Map<string, number>();
  private parts = new Map<string, StatPart[]>();
  private evaluating = new Set<string>();
  readonly cycles = new Set<string>();

  constructor(private readonly input: StatInput) {
    for (const c of input.contributions) {
      let list = this.byStat.get(c.stat);
      if (!list) this.byStat.set(c.stat, (list = []));
      list.push(c);
    }
    for (const s of input.seeds) {
      let list = this.seeds.get(s.stat);
      if (!list) this.seeds.set(s.stat, (list = []));
      list.push(s);
    }
  }

  /** True if the stat is defined by any rule, seed or built-in calculation. */
  has(name: string): boolean {
    const n = name.toLowerCase().replace(/^-/, "");
    if (this.byStat.has(n) || this.seeds.has(n)) return true;
    if (this.builtin(n) !== undefined) return true;
    const derived = /^(.*):(half|half:up|quarter|quarter:up)$/.exec(n);
    return derived ? this.has(derived[1]) : false;
  }

  get(name: string): number {
    const raw = name.trim().toLowerCase();
    if (raw.startsWith("-")) return -this.get(raw.slice(1));
    const cached = this.cache.get(raw);
    if (cached !== undefined) return cached;
    if (this.evaluating.has(raw)) {
      this.cycles.add(raw);
      return 0;
    }
    this.evaluating.add(raw);
    const parts: StatPart[] = [];
    const value = this.compute(raw, parts);
    this.evaluating.delete(raw);
    this.cache.set(raw, value);
    this.parts.set(raw, parts);
    return value;
  }

  /** Contributions that make up a stat, for tooltips. */
  breakdown(name: string): StatPart[] {
    const n = name.toLowerCase();
    this.get(n);
    return this.parts.get(n) ?? [];
  }

  /** All stat names that have rules or seeds. */
  names(): string[] {
    return [...new Set([...this.byStat.keys(), ...this.seeds.keys()])].sort();
  }

  abilityScore(a: Ability): number {
    return this.get(`${a}:score`);
  }

  abilityModifier(a: Ability): number {
    return this.get(`${a}:modifier`);
  }

  private builtin(name: string): ((parts: StatPart[]) => number) | undefined {
    const m = /^(strength|dexterity|constitution|intelligence|wisdom|charisma):(score|modifier)$/.exec(name);
    if (m) {
      const a = m[1] as Ability;
      if (m[2] === "score") {
        return (parts) => {
          const base = this.input.baseAbilities[a] ?? 10;
          const additional = this.get(a);
          parts.push({ source: "Base", value: base });
          for (const p of this.breakdown(a)) parts.push(p);
          let score = base + additional;
          const override = this.get(`${a}:score:set`);
          if (override > score) {
            parts.push({ source: "Set", value: override - score });
            score = override;
          } else if (this.input.useAbilityMaximum && this.has(`${a}:max`)) {
            const max = this.get(`${a}:max`);
            if (score > max) {
              parts.push({ source: "Maximum", value: max - score });
              score = max;
            }
          }
          return score;
        };
      }
      return (parts) => {
        const mod = Math.floor((this.get(`${a}:score`) - 10) / 2);
        parts.push({ source: `${cap(a)} Score`, value: mod });
        return mod;
      };
    }
    return undefined;
  }

  private compute(name: string, parts: StatPart[]): number {
    const builtin = this.builtin(name);
    if (builtin) return builtin(parts);

    let total = 0;
    for (const s of this.seeds.get(name) ?? []) {
      total += s.value;
      parts.push({ source: s.source, value: s.value });
    }

    const rules = this.byStat.get(name);
    if (!rules) {
      if (!this.seeds.has(name)) {
        const derived = /^(.*):(half|half:up|quarter|quarter:up)$/.exec(name);
        if (derived && this.has(derived[1])) {
          const v = this.get(derived[1]);
          const div = derived[2].startsWith("half") ? 2 : 4;
          // Integer division truncating toward zero, plus the remainder when rounding up.
          const r = Math.trunc(v / div) + (derived[2].endsWith(":up") ? Math.sign(v % div) : 0);
          parts.push({ source: derived[1], value: r });
          return r;
        }
      }
      return name === "ac" ? total + this.acMerges(parts) : total;
    }

    const byBonus = new Map<string, StatContribution[]>();
    for (const r of rules) {
      if (!r.bonus) {
        const v = this.valueOf(r);
        if (v === null) continue;
        total += v;
        parts.push({ source: r.source, value: v });
      } else {
        let list = byBonus.get(r.bonus);
        if (!list) byBonus.set(r.bonus, (list = []));
        list.push(r);
      }
    }
    for (const [bonus, list] of byBonus) {
      if (list.length === 1) {
        const v = this.valueOf(list[0]);
        if (v === null) continue;
        total += v;
        parts.push({ source: list[0].source, value: v, bonus });
        continue;
      }
      // Non-stacking: highest value of this bonus type wins (never below 0).
      let best = 0;
      let sources: string[] = [];
      for (const r of list) {
        const v = this.valueOf(r);
        if (v === null) continue;
        if (v > best) {
          best = v;
          sources = [r.source];
        } else if (v === best && v > 0) {
          sources.push(r.source);
        }
      }
      total += best;
      if (sources.length) parts.push({ source: sources.join(" | "), value: best, bonus });
    }
    if (name === "ac") total += this.acMerges(parts);
    return total;
  }

  private acMerges(parts: StatPart[]): number {
    let total = 0;
    for (const m of AC_MERGES) {
      if (!this.has(m)) continue;
      const v = this.get(m);
      if (v <= 0) continue;
      for (const p of this.breakdown(m)) parts.push(p);
      total += v;
    }
    return total;
  }

  private ref(v: string): number | null {
    if (INT_RE.test(v)) return parseInt(v, 10);
    if (!this.has(v)) return null;
    return this.get(v);
  }

  private valueOf(c: StatContribution): number | null {
    let v = this.ref(c.value);
    if (v === null) return null;
    if (c.maximum) {
      const max = this.ref(c.maximum);
      if (max === null) return null;
      v = Math.min(v, max);
    }
    if (c.minimum) {
      const min = this.ref(c.minimum);
      if (min !== null) v = Math.max(v, min);
    }
    return v;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isAbility(name: string): name is Ability {
  return ABILITY_SET.has(name);
}

export function formatModifier(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

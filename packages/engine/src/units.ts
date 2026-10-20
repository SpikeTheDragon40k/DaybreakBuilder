/**
 * Imperial to metric conversion for display.
 *
 * Content and rules stay in feet and pounds; the app converts what it shows.
 * The factors follow the convention of the metric editions of the game, where
 * a 5-foot square is 1.5 meters, so distances stay multiples of the grid:
 *
 *   1 foot = 0.3 m, 1 mile = 1.5 km, 1 inch = 2.5 cm, 1 pound = 0.5 kg
 */

export type UnitSystem = "imperial" | "metric";

export const METERS_PER_FOOT = 0.3;
export const KM_PER_MILE = 1.5;
export const CM_PER_INCH = 2.5;
export const KG_PER_POUND = 0.5;

const WORDS: Record<string, number> = {
  "half a": 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};
/**
 * Number words before a unit ("five feet tall"). Not after a possessive or
 * article, where "feet" are body parts ("its two feet", "the four feet").
 */
const WORD_NUM = String.raw`(?<!\b(?:the|its|their|his|her|your|my|our|all|on|with) )(?:${Object.keys(WORDS).join("|")})`;

/** A number as written in rules text: 30, 1,000, 2.5, 1/2, 2 1/2, five, half a. */
const NUM = String.raw`\d+ \d+\/\d+|\d+\/\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|½|¼|${WORD_NUM}`;

function parseNumber(s: string): number {
  if (s === "½") return 0.5;
  if (s === "¼") return 0.25;
  const word = WORDS[s.toLowerCase()];
  if (word !== undefined) return word;
  const frac = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1] ?? 0) + Number(frac[2]) / Number(frac[3]);
  return Number(s.replace(/,/g, ""));
}

export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatDistance(feet: number, system: UnitSystem): string {
  return system === "metric" ? `${formatNumber(feet * METERS_PER_FOOT)} m` : `${formatNumber(feet)} ft.`;
}

export function formatWeight(pounds: number, system: UnitSystem): string {
  return system === "metric" ? `${formatNumber(pounds * KG_PER_POUND)} kg` : `${formatNumber(pounds)} lb.`;
}

interface Unit {
  /** Regex source for the unit word(s) after a number. */
  pattern: string;
  /** Regex source for the unit in a hyphenated adjective ("20-foot radius"). */
  adjective?: string;
  factor: number;
  symbol: string;
  /** Word used in the hyphenated form ("6-meter radius"). */
  word: string;
}

// Order matters: area and volume before plain lengths.
const UNITS: Unit[] = [
  { pattern: String.raw`cubic (?:feet|foot|ft\.?)`, factor: METERS_PER_FOOT ** 3, symbol: "m³", word: "cubic-meter" },
  { pattern: String.raw`square (?:feet|foot|ft\.?)`, factor: METERS_PER_FOOT ** 2, symbol: "m²", word: "square-meter" },
  { pattern: String.raw`(?:feet|foot|ft\.?)(?![a-z])`, adjective: "foot|feet", factor: METERS_PER_FOOT, symbol: "m", word: "meter" },
  { pattern: String.raw`(?:miles?|mi\.)(?![a-z])`, adjective: "mile", factor: KM_PER_MILE, symbol: "km", word: "kilometer" },
  { pattern: String.raw`inch(?:es)?(?![a-z])`, adjective: "inch", factor: CM_PER_INCH, symbol: "cm", word: "centimeter" },
  { pattern: String.raw`(?:pounds?|lbs?\.?)(?![a-z])`, adjective: "pound", factor: KG_PER_POUND, symbol: "kg", word: "kilogram" },
];

interface CompiledUnit extends Unit {
  plain: RegExp;
  range: RegExp;
  hyphen?: RegExp;
}

const COMPILED: CompiledUnit[] = UNITS.map((u) => ({
  ...u,
  // "5 to 10 feet", "10–20 feet": convert both numbers.
  range: new RegExp(String.raw`(?<![\w.,/])(?<!\w\+)(${NUM})(\s+(?:to|or|and)\s+|\s*[–—]\s*)(${NUM})(\s*)(?:${u.pattern})`, "gi"),
  plain: new RegExp(String.raw`(?<![\w.,/])(?<!\w\+)(${NUM})(\s*)(?:${u.pattern})`, "gi"),
  hyphen: u.adjective ? new RegExp(String.raw`(?<![\w.,/])(?<!\w\+)(${NUM})-(?:${u.adjective})(?![a-z])`, "gi") : undefined,
}));

/**
 * Rewrite imperial measurements in rules text ("a 20-foot-radius sphere
 * within 150 feet", "2 lb.") in the chosen system. Imperial returns the
 * text unchanged. Safe on HTML: only "number + unit" runs are touched.
 */
export function convertUnits(text: string, system: UnitSystem): string {
  if (system !== "metric" || !text) return text;
  let out = text;
  for (const u of COMPILED) {
    const conv = (n: string) => formatNumber(parseNumber(n) * u.factor);
    out = out.replace(u.range, (_, a: string, sep: string, b: string, space: string) => `${conv(a)}${sep}${conv(b)}${space || " "}${u.symbol}`);
    if (u.hyphen) out = out.replace(u.hyphen, (_, n: string) => `${conv(n)}-${u.word}`);
    out = out.replace(u.plain, (_, n: string, space: string) => `${conv(n)}${space || " "}${u.symbol}`);
  }
  return out;
}

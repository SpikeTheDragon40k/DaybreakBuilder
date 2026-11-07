/**
 * Built-in generators for the GM: names, NPCs, taverns and shops, encounters
 * from the loaded monsters, and coin treasure. All word lists are original.
 */
import { challengeXp, encounterBudget, normalizeChallenge, rateEncounter, type EncounterDifficulty } from "./encounters.js";
import type { MonsterTemplate } from "./initiative.js";
import type { RulesEdition } from "./editions.js";
import { pick, rollDie, type Rng } from "./tables.js";

// ---------------------------------------------------------------------------
// Names

interface NameStyle {
  first: [string[], string[], string[]];
  family?: [string[], string[]];
}

/** Syllables put together into names; each style has its own sound. */
const NAME_STYLES: Record<string, NameStyle> = {
  Human: {
    first: [["Al", "Bran", "Cor", "Da", "El", "Fen", "Gar", "Hal", "Is", "Jor", "Ka", "Lis", "Mar", "Nes", "Or", "Per", "Ro", "Sa", "Tam", "Wil"], ["a", "e", "i", "o", "", "", "an", "el"], ["n", "ra", "th", "na", "ric", "wyn", "lia", "mund", "s", "da"]],
    family: [["Ash", "Black", "Brook", "Cold", "Fair", "Green", "Hart", "Iron", "Long", "Mill", "Oak", "Red", "Stone", "Thorn", "West"], ["ford", "well", "wood", "field", "hill", "water", "brook", "more", "ley", "son"]],
  },
  Elf: {
    first: [["Ae", "Cael", "Ela", "Fae", "Gal", "Il", "Lae", "Mae", "Nai", "Quel", "Rhae", "Sil", "Tha", "Vae", "Ys"], ["la", "ri", "na", "the", "lu", "ri", "a"], ["nor", "wyn", "thas", "riel", "lith", "dor", "nae", "ssa", "ion", "ra"]],
    family: [["Amber", "Dawn", "Evening", "Gold", "Moon", "Silver", "Star", "Sun", "Swift", "Wind"], ["leaf", "song", "brook", "petal", "whisper", "bough", "light", "flower", "shade", "wing"]],
  },
  Dwarf: {
    first: [["Bal", "Bru", "Dag", "Dur", "Gim", "Grun", "Har", "Kil", "Mor", "Rur", "Thor", "Ul", "Vond", "Bel", "Dis"], ["", "", "a", "i", "o"], ["din", "grim", "rek", "dal", "mir", "nar", "gar", "di", "ra", "bek"]],
    family: [["Anvil", "Battle", "Coal", "Deep", "Flint", "Gold", "Hammer", "Iron", "Rock", "Stout"], ["beard", "fist", "forge", "delve", "helm", "shield", "brow", "mantle", "axe", "vein"]],
  },
  Halfling: {
    first: [["Bel", "Cor", "Dai", "Fin", "Kith", "Lav", "Mer", "Nor", "Os", "Per", "Ros", "Ser", "Tob", "Wel"], ["a", "i", "o", "", "e"], ["do", "ric", "la", "bo", "nie", "wise", "lyn", "co", "my", "ra"]],
    family: [["Apple", "Brush", "Good", "Green", "High", "Hill", "Tea", "Thistle", "Under", "Warm"], ["barrel", "bottle", "hill", "leaf", "foot", "bough", "kettle", "gather", "meadow", "pot"]],
  },
  Gnome: {
    first: [["Al", "Bim", "Ell", "Fon", "Gim", "Ni", "Or", "Pip", "Sin", "Wren", "Zan", "Bod", "Car", "Fizz"], ["i", "a", "o", "", "e"], ["ble", "wick", "dle", "ny", "pip", "bo", "ver", "la", "zil", "nock"]],
    family: [["Cog", "Fizz", "Gear", "Glitter", "Spark", "Tinker", "Twist", "Whistle", "Copper", "Puzzle"], ["bottom", "wick", "spinner", "sprocket", "nose", "gadget", "fuse", "button", "kettle", "whirl"]],
  },
  Orc: {
    first: [["Ba", "Dren", "Gor", "Hol", "Kar", "Mog", "Ru", "Shag", "Thok", "Ug", "Vol", "Yev", "Zar", "Ov"], ["", "a", "u", "o"], ["gash", "rak", "tha", "mak", "zug", "ga", "dush", "kra", "nar", "rok"]],
  },
  Tiefling: {
    first: [["Ak", "Bar", "Da", "Ka", "Le", "Mor", "Ny", "Ori", "Ska", "Za", "Ia", "Kal", "Ner", "Ves"], ["", "a", "e", "i", "ra"], ["men", "kas", "mon", "nia", "ros", "thos", "zel", "bis", "lith", "riel"]],
  },
  Dragonborn: {
    first: [["Ar", "Bal", "Dor", "Gha", "Heth", "Kri", "Med", "Nad", "Pan", "Rho", "Sor", "Tor", "Zor", "Vyr"], ["ja", "a", "e", "i", "o"], ["han", "sar", "rash", "jurn", "kas", "ar", "rinn", "sha", "thys", "dar"]],
    family: [["Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Fenkenkabradon", "Kerrhylon", "Kimbatuul", "Linxakasendalor", "Myastan", "Nemmonis"], [""]],
  },
};

export const NAME_SPECIES = Object.keys(NAME_STYLES);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generateName(species: string, rng: Rng): string {
  const style = NAME_STYLES[species] ?? NAME_STYLES.Human;
  const [a, b, c] = style.first;
  let first = `${pick(a, rng)}${pick(b, rng)}${pick(c, rng)}`;
  first = cap(first.toLowerCase().replace(/(.)\1\1+/g, "$1$1"));
  if (!style.family) return first;
  const family = cap(`${pick(style.family[0], rng)}${pick(style.family[1], rng)}`.toLowerCase());
  return `${first} ${family}`;
}

// ---------------------------------------------------------------------------
// NPCs

const OCCUPATIONS = [
  "blacksmith", "innkeeper", "merchant", "farmer", "guard", "priest", "scholar", "fisher", "hunter", "minstrel", "herbalist",
  "sailor", "miner", "noble", "beggar", "cartwright", "tailor", "brewer", "scribe", "smuggler", "healer", "stablehand",
  "fortune teller", "retired adventurer", "town crier", "cook", "carpenter", "tax collector", "messenger", "jeweler",
];
const APPEARANCES = [
  "a crooked nose", "a booming voice", "ink-stained fingers", "a missing tooth", "a braided beard", "bright, mismatched eyes",
  "a fresh scar across one cheek", "fine but faded clothes", "a nervous twitch", "flour on their sleeves", "a heavy limp",
  "a tattoo of a ship's anchor", "an unusually tall hat", "rings on every finger", "a hoarse whisper", "sun-darkened skin",
  "a perfectly groomed moustache", "a hood always up", "a pet rat on one shoulder", "callused, enormous hands",
];
const TRAITS = [
  "friendly to a fault", "suspicious of strangers", "loud and boastful", "quiet and watchful", "endlessly curious",
  "blunt and honest", "nervous and jumpy", "proud of their craft", "always joking", "gloomy, expects the worst",
  "kind to animals, cold to people", "quick to anger, quick to forgive", "a hopeless romantic", "deeply religious",
  "greedy but fair", "forgetful", "fiercely loyal to family", "a terrible liar", "secretly brave", "talks too much",
];
const WANTS = [
  "to pay off a debt before the month ends", "to find a missing sibling", "to be left alone", "to get rich quick",
  "revenge on a former partner", "to leave town for good", "to protect their shop from a local gang",
  "recognition from the local lord", "a cure for a sick child", "to learn magic", "to retire somewhere warm",
  "to win back a lost love", "to keep a dangerous secret hidden", "to prove a rival is a fraud", "a new life under a new name",
];
const QUIRKS = [
  "hums old war songs", "collects buttons", "never sits with their back to a door", "speaks of themselves in the third person",
  "bites coins to test them", "quotes proverbs nobody has heard of", "is afraid of birds", "always eats something",
  "counts things out loud", "names their tools", "laughs at the wrong moments", "keeps a tiny notebook of everyone's names",
];

export interface GeneratedNpc {
  name: string;
  species: string;
  occupation: string;
  appearance: string;
  trait: string;
  want: string;
  quirk: string;
}

export function generateNpc(rng: Rng, species?: string): GeneratedNpc {
  const sp = species && NAME_STYLES[species] ? species : pick(NAME_SPECIES, rng);
  return {
    name: generateName(sp, rng),
    species: sp,
    occupation: pick(OCCUPATIONS, rng),
    appearance: pick(APPEARANCES, rng),
    trait: pick(TRAITS, rng),
    want: pick(WANTS, rng),
    quirk: pick(QUIRKS, rng),
  };
}

/** An NPC as the text of an NPC note. */
export function npcMarkdown(n: GeneratedNpc): string {
  return [
    `**${n.species} ${n.occupation}** with ${n.appearance}.`,
    "",
    `- **Personality:** ${n.trait}`,
    `- **Wants:** ${n.want}`,
    `- **Quirk:** ${n.quirk}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Places

const ADJECTIVES = ["Rusty", "Prancing", "Sleeping", "Golden", "Drunken", "Laughing", "Silver", "Crooked", "Hungry", "Wandering", "Broken", "Jolly", "Black", "Lucky", "Howling", "Velvet", "Salty", "Copper", "Weary", "Merry"];
const NOUNS = ["Dragon", "Pony", "Goblet", "Griffon", "Lantern", "Anvil", "Mermaid", "Boar", "Kettle", "Owl", "Wagon", "Stag", "Barrel", "Crown", "Toad", "Harp", "Hound", "Candle", "Mule", "Wyvern"];
const TAVERN_FEATURES = [
  "a fireplace big enough to roast an ox", "a bard who only knows three songs", "a notice board covered in job offers",
  "rooms that are suspiciously cheap", "a famous spiced stew", "a back room where cards are played for high stakes",
  "a parrot that insults customers", "a cellar nobody is allowed into", "a portrait whose eyes seem to follow you",
  "an arm-wrestling champion who never loses",
];
const SHOP_KINDS = ["Weapons", "Armor", "Potions", "Curiosities", "General goods", "Books and maps", "Herbs", "Jewelry", "Tailoring", "Pawnbroker"];
const SHOP_WORDS = ["Emporium", "Goods", "Trading Post", "Workshop", "Wares", "Supplies", "Corner", "Bazaar", "Outfitters", "Treasures"];

export interface GeneratedPlace {
  name: string;
  kind: string;
  description: string;
}

export function generateTavern(rng: Rng): GeneratedPlace {
  return {
    name: `The ${pick(ADJECTIVES, rng)} ${pick(NOUNS, rng)}`,
    kind: "Tavern",
    description: `Known for ${pick(TAVERN_FEATURES, rng)}. Run by ${generateName(pick(NAME_SPECIES, rng), rng)}, who is ${pick(TRAITS, rng)}.`,
  };
}

export function generateShop(rng: Rng): GeneratedPlace {
  const owner = generateName(pick(NAME_SPECIES, rng), rng);
  const kind = pick(SHOP_KINDS, rng);
  return {
    name: `${owner.split(" ")[0]}'s ${pick(SHOP_WORDS, rng)}`,
    kind,
    description: `${kind}. The owner, ${owner}, is ${pick(TRAITS, rng)} and wants ${pick(WANTS, rng)}.`,
  };
}

// ---------------------------------------------------------------------------
// Encounters

export interface GeneratedEncounter {
  monsters: { name: string; challenge: string; count: number; elementId: string }[];
  /** XP as the chosen rules count it (adjusted by the multiplier in 2014). */
  xp: number;
  budget: number;
  difficulty: EncounterDifficulty;
}

/**
 * Monsters from the loaded content for a party, aiming at the XP budget of a
 * difficulty without going over. Returns null when no monster fits.
 */
export function generateEncounter(
  templates: MonsterTemplate[],
  levels: number[],
  rules: RulesEdition,
  difficulty: EncounterDifficulty,
  rng: Rng,
): GeneratedEncounter | null {
  const budget = encounterBudget(levels, rules)[difficulty] ?? 0;
  if (!budget || !levels.length) return null;
  const pool = templates
    .map((t) => ({ t, cr: normalizeChallenge(t.challenge), xp: challengeXp(normalizeChallenge(t.challenge)) }))
    .filter((m) => m.xp > 0 && m.xp <= budget);
  if (!pool.length) return null;
  const xpOf = (picked: { cr: string; count: number }[]) =>
    rateEncounter(levels, picked.map((p) => ({ cr: p.cr, count: p.count })), rules).adjustedXp;

  let best: { picked: { t: MonsterTemplate; cr: string; count: number }[]; xp: number } | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const kinds = 1 + Math.floor(rng() * Math.min(3, pool.length));
    const strong = pool.filter((m) => m.xp >= budget / 10);
    const picked: { t: MonsterTemplate; cr: string; count: number }[] = [];
    for (let k = 0; k < kinds; k++) {
      const from = k === 0 && strong.length ? strong : pool;
      const m = pick(from, rng);
      if (!picked.some((p) => p.t.elementId === m.t.elementId)) picked.push({ t: m.t, cr: m.cr, count: 1 });
    }
    if (xpOf(picked) > budget) continue;
    // Add more of a random kind while it still fits (at most 12 creatures).
    for (let tries = 0; tries < 30; tries++) {
      const total = picked.reduce((n, p) => n + p.count, 0);
      if (total >= 12) break;
      const p = pick(picked, rng);
      p.count++;
      if (xpOf(picked) > budget) {
        p.count--;
        if (rng() < 0.3) break;
      }
    }
    const xp = xpOf(picked);
    if (!best || xp > best.xp) best = { picked: picked.map((p) => ({ ...p })), xp };
    if (xp >= budget * 0.85) break;
  }
  if (!best) return null;
  return {
    monsters: best.picked.map((p) => ({ name: p.t.name, challenge: p.cr, count: p.count, elementId: p.t.elementId })),
    xp: best.xp,
    budget,
    difficulty,
  };
}

// ---------------------------------------------------------------------------
// Treasure

/** Coins carried by one defeated creature, by challenge rating (the 2024 DMG's individual treasure). */
export function individualTreasure(cr: number, rng: Rng): string {
  const roll = (n: number, d: number) => Array.from({ length: n }, () => rollDie(d, rng)).reduce((a, b) => a + b, 0);
  if (cr <= 4) return `${roll(3, 6)} gp`;
  if (cr <= 10) return `${roll(2, 8) * 10} gp`;
  if (cr <= 16) return `${roll(2, 10) * 10} pp`;
  return `${roll(2, 8) * 100} pp`;
}

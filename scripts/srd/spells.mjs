/**
 * SRD spells. Data rows are "|"-separated:
 *   name | level | school | casting time | range | components | material | duration | classes | text | flags
 * classes: B bard, C cleric, D druid, P paladin, R ranger, S sorcerer, K warlock, W wizard
 * flags:   R = ritual
 * Concentration is derived from a duration starting with "Concentration".
 */
import { element, idPart } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";
import { SPELLS_0_1 } from "./spells-0-1.mjs";
import { SPELLS_2_3 } from "./spells-2-3.mjs";
import { SPELLS_4_5 } from "./spells-4-5.mjs";
import { SPELLS_6_9 } from "./spells-6-9.mjs";

const CLASS_CODES = { B: "Bard", C: "Cleric", D: "Druid", P: "Paladin", R: "Ranger", S: "Sorcerer", K: "Warlock", W: "Wizard" };

/** SRD names that differ from the Player's Handbook ids used by community content. */
const ID_OVERRIDES = {
  "Acid Arrow": "MELFS_ACID_ARROW",
  "Arcane Hand": "BIGBYS_HAND",
  "Arcane Sword": "MORDENKAINENS_SWORD",
  "Arcanist’s Magic Aura": "NYSTULS_MAGIC_AURA",
  "Black Tentacles": "EVARDS_BLACK_TENTACLES",
  "Faithful Hound": "MORDENKAINENS_FAITHFUL_HOUND",
  "Floating Disk": "TENSERS_FLOATING_DISK",
  "Freezing Sphere": "OTILUKES_FREEZING_SPHERE",
  "Hideous Laughter": "TASHAS_HIDEOUS_LAUGHTER",
  "Instant Summons": "DRAWMIJS_INSTANT_SUMMONS",
  "Irresistible Dance": "OTTOS_IRRESISTIBLE_DANCE",
  "Magnificent Mansion": "MORDENKAINENS_MAGNIFICENT_MANSION",
  "Private Sanctum": "MORDENKAINENS_PRIVATE_SANCTUM",
  "Resilient Sphere": "OTILUKES_RESILIENT_SPHERE",
  "Secret Chest": "LEOMUNDS_SECRET_CHEST",
  "Telepathic Bond": "RARYS_TELEPATHIC_BOND",
  "Tiny Hut": "LEOMUNDS_TINY_HUT",
};

export const spellIdFor = (name) => `ID_PHB_SPELL_${ID_OVERRIDES[name] ?? idPart(name)}`;

function spellElement(row) {
  const [name, level, school, time, range, components, material, duration, classes, text, flags = ""] = row.split("|").map((s) => s.trim());
  const comps = components.split(",").map((c) => c.trim());
  const ritual = flags.includes("R");
  const concentration = /^concentration/i.test(duration);
  const classNames = [...classes].map((c) => CLASS_CODES[c]).filter(Boolean);
  const lv = parseInt(level, 10);
  const header = lv === 0 ? `${school} cantrip` : `${ordinal(lv)}-level ${school.toLowerCase()}${ritual ? " (ritual)" : ""}`;
  return element({
    name,
    type: "Spell",
    id: spellIdFor(name),
    source: SOURCE,
    supports: classNames,
    description: `<p><em>${header}</em></p>${text
      .split("\\n")
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("")}`,
    setters: [
      ["level", lv],
      ["school", school],
      ["time", time],
      ["range", range],
      ["duration", duration],
      ["hasVerbalComponent", comps.includes("V") ? "true" : "false"],
      ["hasSomaticComponent", comps.includes("S") ? "true" : "false"],
      ["hasMaterialComponent", comps.includes("M") ? "true" : "false"],
      ...(material ? [["materialComponent", material]] : []),
      ["isConcentration", concentration ? "true" : "false"],
      ["isRitual", ritual ? "true" : "false"],
    ],
  });
}

function ordinal(n) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function spells() {
  const rows = [...SPELLS_0_1, ...SPELLS_2_3, ...SPELLS_4_5, ...SPELLS_6_9];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const name = row.split("|")[0].trim();
    if (seen.has(name)) throw new Error(`duplicate spell ${name}`);
    seen.add(name);
    out.push(spellElement(row));
  }
  return out;
}

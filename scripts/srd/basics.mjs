/** Skills, saving throws, proficiencies, languages, alignments and senses. */
import { ABILITIES, cap, element, grant, idPart, stat } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";

const SKILLS = [
  ["Acrobatics", "dexterity", "Staying on your feet in tricky situations: balancing, tumbling, flips and stunts.", ["Fighter", "Monk", "Rogue"]],
  ["Animal Handling", "wisdom", "Calming, controlling or reading the intentions of animals.", ["Barbarian", "Druid", "Fighter", "Ranger"]],
  ["Arcana", "intelligence", "Recalling lore about spells, magic items, planes and arcane symbols.", ["Druid", "Sorcerer", "Warlock", "Wizard"]],
  ["Athletics", "strength", "Climbing, jumping, swimming and other feats of physical strength.", ["Barbarian", "Fighter", "Monk", "Paladin", "Ranger", "Rogue"]],
  ["Deception", "charisma", "Convincingly hiding the truth, through words or actions.", ["Rogue", "Sorcerer", "Warlock"]],
  ["History", "intelligence", "Recalling lore about historical events, people, kingdoms and wars.", ["Cleric", "Fighter", "Monk", "Warlock", "Wizard"]],
  ["Insight", "wisdom", "Reading body language and determining true intentions.", ["Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Wizard"]],
  ["Intimidation", "charisma", "Influencing others through threats, hostile actions or violence.", ["Barbarian", "Fighter", "Paladin", "Rogue", "Sorcerer", "Warlock"]],
  ["Investigation", "intelligence", "Looking for clues and making deductions from them.", ["Ranger", "Rogue", "Warlock", "Wizard"]],
  ["Medicine", "wisdom", "Stabilizing a dying companion or diagnosing an illness.", ["Cleric", "Druid", "Paladin", "Wizard"]],
  ["Nature", "intelligence", "Recalling lore about terrain, plants, animals and weather.", ["Barbarian", "Druid", "Ranger", "Warlock"]],
  ["Perception", "wisdom", "Spotting, hearing or otherwise noticing the presence of something.", ["Barbarian", "Druid", "Fighter", "Ranger", "Rogue"]],
  ["Performance", "charisma", "Delighting an audience with music, dance, acting or storytelling.", ["Rogue"]],
  ["Persuasion", "charisma", "Influencing others with tact, social graces or good nature.", ["Cleric", "Paladin", "Rogue", "Sorcerer"]],
  ["Religion", "intelligence", "Recalling lore about deities, rites, prayers and religious hierarchies.", ["Cleric", "Druid", "Monk", "Paladin", "Sorcerer", "Warlock", "Wizard"]],
  ["Sleight of Hand", "dexterity", "Acts of legerdemain or manual trickery, such as planting or concealing objects.", ["Rogue"]],
  ["Stealth", "dexterity", "Concealing yourself from enemies and moving without being noticed.", ["Monk", "Ranger", "Rogue"]],
  ["Survival", "wisdom", "Following tracks, hunting, guiding a group and predicting the weather.", ["Barbarian", "Druid", "Fighter", "Ranger"]],
];

export const skillId = (name) => `ID_PROFICIENCY_SKILL_${idPart(name).replace(/_/g, "")}`;

function skills() {
  const out = [];
  for (const [name, ability, desc, classes] of SKILLS) {
    const key = name.toLowerCase();
    out.push(
      element({
        name,
        type: "Proficiency",
        id: skillId(name),
        source: SOURCE,
        // Bards may pick any skill.
        supports: ["Skill", cap(ability), "ID_PROFICIENCY_SKILL", ...classes, "Bard"],
        text: `${desc} (${cap(ability)})`,
        sheet: false,
        rules: [stat({ name: `${key}:proficiency`, value: "proficiency", bonus: "proficiency" })],
      }),
      element({
        name: `Skill Expertise (${name})`,
        type: "Proficiency",
        id: `ID_INTERNAL_PROFICIENCY_SKILL_EXPERTISE_${idPart(name)}`,
        source: SOURCE,
        supports: ["Expertise", "Skill Expertise", "ID_INTERNAL_SUPPORT_EXPERTISE"],
        requirements: skillId(name),
        text: `Your proficiency bonus is doubled for ${name} checks.`,
        sheet: false,
        rules: [stat({ name: `${key}:proficiency`, value: "proficiency", bonus: "double" })],
      }),
    );
  }
  out.push(
    element({
      name: "Tool Expertise (Thieves’ Tools)",
      type: "Proficiency",
      id: "ID_INTERNAL_PROFICIENCY_TOOL_EXPERTISE_THIEVES_TOOLS",
      source: SOURCE,
      supports: ["Expertise", "Tool Expertise", "ID_INTERNAL_SUPPORT_EXPERTISE"],
      requirements: "ID_PROFICIENCY_TOOL_PROFICIENCY_THIEVES_TOOLS",
      text: "Your proficiency bonus is doubled for checks using thieves’ tools.",
      sheet: false,
    }),
  );
  return out;
}

function savingThrows() {
  return ABILITIES.map((a) =>
    element({
      name: `Saving Throw Proficiency (${cap(a)})`,
      type: "Proficiency",
      id: `ID_PROFICIENCY_SAVINGTHROW_${a.toUpperCase()}`,
      source: SOURCE,
      supports: ["Saving Throw", cap(a)],
      sheet: false,
      rules: [stat({ name: `${a}:save:proficiency`, value: "proficiency", bonus: "proficiency", alt: "Proficiency" })],
    }),
  );
}

// [name, idPart, category, range]
export const WEAPONS = [
  ["Club", "CLUB", "Simple", "Melee"],
  ["Dagger", "DAGGER", "Simple", "Melee"],
  ["Greatclub", "GREATCLUB", "Simple", "Melee"],
  ["Handaxe", "HANDAXE", "Simple", "Melee"],
  ["Javelin", "JAVELIN", "Simple", "Melee"],
  ["Light Hammer", "LIGHT_HAMMER", "Simple", "Melee"],
  ["Mace", "MACE", "Simple", "Melee"],
  ["Quarterstaff", "QUARTERSTAFF", "Simple", "Melee"],
  ["Sickle", "SICKLE", "Simple", "Melee"],
  ["Spear", "SPEAR", "Simple", "Melee"],
  ["Light Crossbow", "CROSSBOW_LIGHT", "Simple", "Ranged"],
  ["Dart", "DART", "Simple", "Ranged"],
  ["Shortbow", "SHORTBOW", "Simple", "Ranged"],
  ["Sling", "SLING", "Simple", "Ranged"],
  ["Battleaxe", "BATTLEAXE", "Martial", "Melee"],
  ["Flail", "FLAIL", "Martial", "Melee"],
  ["Glaive", "GLAIVE", "Martial", "Melee"],
  ["Greataxe", "GREATAXE", "Martial", "Melee"],
  ["Greatsword", "GREATSWORD", "Martial", "Melee"],
  ["Halberd", "HALBERD", "Martial", "Melee"],
  ["Lance", "LANCE", "Martial", "Melee"],
  ["Longsword", "LONGSWORD", "Martial", "Melee"],
  ["Maul", "MAUL", "Martial", "Melee"],
  ["Morningstar", "MORNINGSTAR", "Martial", "Melee"],
  ["Pike", "PIKE", "Martial", "Melee"],
  ["Rapier", "RAPIER", "Martial", "Melee"],
  ["Scimitar", "SCIMITAR", "Martial", "Melee"],
  ["Shortsword", "SHORTSWORD", "Martial", "Melee"],
  ["Trident", "TRIDENT", "Martial", "Melee"],
  ["War Pick", "WAR_PICK", "Martial", "Melee"],
  ["Warhammer", "WARHAMMER", "Martial", "Melee"],
  ["Whip", "WHIP", "Martial", "Melee"],
  ["Blowgun", "BLOWGUN", "Martial", "Ranged"],
  ["Hand Crossbow", "CROSSBOW_HAND", "Martial", "Ranged"],
  ["Heavy Crossbow", "CROSSBOW_HEAVY", "Martial", "Ranged"],
  ["Longbow", "LONGBOW", "Martial", "Ranged"],
  ["Net", "NET", "Martial", "Ranged"],
];
export const weaponProfId = (part) => `ID_PROFICIENCY_WEAPON_PROFICIENCY_${part}`;

export const ARMORS = [
  ["Padded", "PADDED", "Light"],
  ["Leather", "LEATHER", "Light"],
  ["Studded Leather", "STUDDED_LEATHER", "Light"],
  ["Hide", "HIDE", "Medium"],
  ["Chain Shirt", "CHAIN_SHIRT", "Medium"],
  ["Scale Mail", "SCALE_MAIL", "Medium"],
  ["Breastplate", "BREASTPLATE", "Medium"],
  ["Half Plate", "HALF_PLATE", "Medium"],
  ["Ring Mail", "RING_MAIL", "Heavy"],
  ["Chain Mail", "CHAIN_MAIL", "Heavy"],
  ["Splint", "SPLINT", "Heavy"],
  ["Plate", "PLATE", "Heavy"],
];
export const armorProfId = (part) => `ID_PROFICIENCY_ARMOR_PROFICIENCY_${part}`;

export const TOOLS = [
  ["Alchemist’s supplies", "ALCHEMISTS_SUPPLIES", "Artisan"],
  ["Brewer’s supplies", "BREWERS_SUPPLIES", "Artisan"],
  ["Calligrapher’s supplies", "CALLIGRAPHERS_SUPPLIES", "Artisan"],
  ["Carpenter’s tools", "CARPENTERS_TOOLS", "Artisan"],
  ["Cartographer’s tools", "CARTOGRAPHERS_TOOLS", "Artisan"],
  ["Cobbler’s tools", "COBBLERS_TOOLS", "Artisan"],
  ["Cook’s utensils", "COOKS_UTENSILS", "Artisan"],
  ["Glassblower’s tools", "GLASSBLOWERS_TOOLS", "Artisan"],
  ["Jeweler’s tools", "JEWELERS_TOOLS", "Artisan"],
  ["Leatherworker’s tools", "LEATHERWORKERS_TOOLS", "Artisan"],
  ["Mason’s tools", "MASONS_TOOLS", "Artisan"],
  ["Painter’s supplies", "PAINTERS_SUPPLIES", "Artisan"],
  ["Potter’s tools", "POTTERS_TOOLS", "Artisan"],
  ["Smith’s tools", "SMITHS_TOOLS", "Artisan"],
  ["Tinker’s tools", "TINKERS_TOOLS", "Artisan"],
  ["Weaver’s tools", "WEAVERS_TOOLS", "Artisan"],
  ["Woodcarver’s tools", "WOODCARVERS_TOOLS", "Artisan"],
  ["Bagpipes", "BAGPIPES", "Musical Instrument"],
  ["Drum", "DRUM", "Musical Instrument"],
  ["Dulcimer", "DULCIMER", "Musical Instrument"],
  ["Flute", "FLUTE", "Musical Instrument"],
  ["Lute", "LUTE", "Musical Instrument"],
  ["Lyre", "LYRE", "Musical Instrument"],
  ["Horn", "HORN", "Musical Instrument"],
  ["Pan flute", "PAN_FLUTE", "Musical Instrument"],
  ["Shawm", "SHAWM", "Musical Instrument"],
  ["Viol", "VIOL", "Musical Instrument"],
  ["Disguise kit", "DISGUISE_KIT", "Kit"],
  ["Forgery kit", "FORGERY_KIT", "Kit"],
  ["Herbalism kit", "HERBALISM_KIT", "Kit"],
  ["Poisoner’s kit", "POISONERS_KIT", "Kit"],
  ["Navigator’s tools", "NAVIGATORS_TOOLS", "Tool"],
  ["Thieves’ tools", "THIEVES_TOOLS", "Tool"],
  ["Vehicles (land)", "VEHICLES_LAND", "Vehicle"],
  ["Vehicles (water)", "VEHICLES_WATER", "Vehicle"],
];
export const GAMING_SETS = [
  ["Dice set", "DICE_SET"],
  ["Dragonchess set", "DRAGONCHESS_SET"],
  ["Playing card set", "PLAYING_CARD_SET"],
  ["Three-Dragon Ante set", "THREE_DRAGON_ANTE_SET"],
];
export const toolProfId = (part) => `ID_PROFICIENCY_TOOL_PROFICIENCY_${part}`;
export const gamingSetProfId = (part) => `ID_PROFICIENCY_GAMING_SET_PROFICIENCY_${part}`;

function proficiencies() {
  const out = [];
  const prof = (name, id, supports, rules) =>
    element({ name, type: "Proficiency", id, source: SOURCE, supports, sheet: false, rules });

  // Weapons: category groups grant the individual weapons.
  for (const cat of ["Simple", "Martial"]) {
    for (const range of ["Melee", "Ranged"]) {
      const list = WEAPONS.filter((w) => w[2] === cat && w[3] === range);
      out.push(
        prof(
          `Weapon Proficiency (${cat} ${range} Weapons)`,
          `ID_PROFICIENCY_WEAPON_PROFICIENCY_${cat.toUpperCase()}_${range.toUpperCase()}_WEAPONS`,
          ["Weapon", `${cat} Weapon`],
          list.map((w) => grant({ type: "Proficiency", id: weaponProfId(w[1]) })),
        ),
      );
    }
    out.push(
      prof(`Weapon Proficiency (${cat} Weapons)`, `ID_PROFICIENCY_WEAPON_PROFICIENCY_${cat.toUpperCase()}_WEAPONS`, ["Weapon", `${cat} Weapons`], [
        grant({ type: "Proficiency", id: `ID_PROFICIENCY_WEAPON_PROFICIENCY_${cat.toUpperCase()}_MELEE_WEAPONS` }),
        grant({ type: "Proficiency", id: `ID_PROFICIENCY_WEAPON_PROFICIENCY_${cat.toUpperCase()}_RANGED_WEAPONS` }),
      ]),
    );
  }
  for (const [name, part, cat] of WEAPONS) {
    out.push(prof(`Weapon Proficiency (${name})`, weaponProfId(part), ["Weapon", cat, cat === "Simple" ? "Simple Weapon" : "Martial Weapon"]));
  }
  out.push(prof("Weapon Proficiency (Unarmed Strike)", weaponProfId("UNARMED_STRIKE"), ["Weapon"]));

  // Armor.
  for (const kind of ["Light", "Medium", "Heavy"]) {
    out.push(
      prof(
        `Armor Proficiency (${kind} Armor)`,
        `ID_PROFICIENCY_ARMOR_PROFICIENCY_${kind.toUpperCase()}_ARMOR`,
        ["Armor"],
        ARMORS.filter((a) => a[2] === kind).map((a) => grant({ type: "Proficiency", id: armorProfId(a[1]) })),
      ),
    );
  }
  for (const [name, part] of ARMORS) out.push(prof(`Armor Proficiency (${name})`, armorProfId(part), ["Armor"]));
  out.push(prof("Armor Proficiency (Shields)", armorProfId("SHIELDS"), ["Armor"], [grant({ type: "Proficiency", id: armorProfId("SHIELD") })]));
  out.push(prof("Armor Proficiency (Shield)", armorProfId("SHIELD"), ["Armor"]));

  // Tools.
  for (const [name, part, kind] of TOOLS) {
    const supports = ["Tool", kind];
    if (kind === "Artisan") supports.push("Artisan’s Tools", "Artisan's Tools");
    out.push(prof(`Tool Proficiency (${name})`, toolProfId(part), supports));
  }
  for (const [name, part] of GAMING_SETS) out.push(prof(`Tool Proficiency (${name})`, gamingSetProfId(part), ["Tool", "Gaming Set"]));
  return out;
}

const LANGUAGES = [
  ["Common", "ID_LANGUAGE_COMMON", "Standard", "Humans", "Common"],
  ["Dwarvish", "ID_LANGUAGE_DWARVISH", "Standard", "Dwarves", "Dwarvish"],
  ["Elvish", "ID_LANGUAGE_ELVISH", "Standard", "Elves", "Elvish"],
  ["Giant", "ID_LANGUAGE_GIANT", "Standard", "Ogres, giants", "Dwarvish"],
  ["Gnomish", "ID_LANGUAGE_GNOMISH", "Standard", "Gnomes", "Dwarvish"],
  ["Goblin", "ID_LANGUAGE_GOBLIN", "Standard", "Goblinoids", "Dwarvish"],
  ["Halfling", "ID_LANGUAGE_HALFLING", "Standard", "Halflings", "Common"],
  ["Orc", "ID_LANGUAGE_ORC", "Standard", "Orcs", "Dwarvish"],
  ["Abyssal", "ID_LANGUAGE_ABYSSAL", "Exotic", "Demons", "Infernal"],
  ["Celestial", "ID_LANGUAGE_CELESTIAL", "Exotic", "Celestials", "Celestial"],
  ["Draconic", "ID_LANGUAGE_DRACONIC", "Exotic", "Dragons, dragonborn", "Draconic"],
  ["Deep Speech", "ID_LANGUAGE_DEEP_SPEECH", "Exotic", "Aboleths, cloakers", "—"],
  ["Infernal", "ID_LANGUAGE_INFERNAL", "Exotic", "Devils", "Infernal"],
  ["Primordial", "ID_LANGUAGE_PRIMORDIAL", "Exotic", "Elementals", "Dwarvish"],
  ["Sylvan", "ID_LANGUAGE_SYLVAN", "Exotic", "Fey creatures", "Elvish"],
  ["Undercommon", "ID_LANGUAGE_UNDERCOMMON", "Exotic", "Underworld traders", "Elvish"],
];

function languages() {
  const out = LANGUAGES.map(([name, id, kind, speakers, script]) =>
    element({
      name,
      type: "Language",
      id,
      source: SOURCE,
      supports: ["Language", kind],
      text: `${kind} language. Typical speakers: ${speakers}. Script: ${script}.`,
      setters: [["speakers", speakers], ["script", script]],
    }),
  );
  out.push(
    element({ name: "Druidic", type: "Language", id: "ID_LANGUAGE_DRUIDIC", source: SOURCE, supports: ["Secret"], text: "The secret language of druids." }),
    element({
      name: "Thieves’ Cant",
      type: "Language",
      id: "ID_WOTC_PHB_LANGUAGE_THIEVES_CANT",
      source: SOURCE,
      supports: ["Secret"],
      text: "A secret mix of dialect, jargon and code that lets rogues hide messages in seemingly normal conversation.",
    }),
  );
  return out;
}

function alignments() {
  const names = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"];
  return names.map((n) => element({ name: n, type: "Alignment", id: `ID_ALIGNMENT_${idPart(n)}`, source: SOURCE }));
}

function senses() {
  const s = [
    ["Darkvision", 60, "You can see in dim light as if it were bright light, and in darkness as if it were dim light (shades of gray only)."],
    ["Blindsight", 0, "You can perceive your surroundings without relying on sight, within a specific radius."],
    ["Truesight", 0, "You can see in normal and magical darkness, see invisible creatures and objects, and see through illusions."],
    ["Tremorsense", 0, "You can detect and pinpoint the origin of vibrations within a specific radius."],
  ];
  return s.map(([name, range, text]) =>
    element({
      name,
      type: "Vision",
      id: `ID_VISION_${name.toUpperCase()}`,
      source: SOURCE,
      text,
      sheet: `${name} {{${name.toLowerCase()}:range}} ft.`,
      rules: range ? [stat({ name: `${name.toLowerCase()}:range`, value: range, bonus: "base" })] : [],
    }),
  );
}

function source() {
  return element({
    name: SOURCE,
    type: "Source",
    id: "ID_SOURCE_SRD_5_1",
    source: SOURCE,
    description:
      "<p>The System Reference Document 5.1 by Wizards of the Coast, released under the Creative Commons Attribution 4.0 license. " +
      "It contains the core rules, nine races, the twelve classes with one subclass each, the Acolyte background, equipment, spells and magic items.</p>",
    setters: [["abbreviation", "SRD"], ["url", "https://dnd.wizards.com/resources/systems-reference-document"], ["official", "true"], ["core", "true"]],
  });
}

export function basics() {
  return [source(), ...skills(), ...savingThrows(), ...proficiencies(), ...languages(), ...alignments(), ...senses()];
}

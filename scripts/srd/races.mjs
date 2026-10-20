/** The nine SRD races and their SRD subraces. */
import { element, grant, select, stat } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";
import { skillId, weaponProfId, toolProfId } from "./basics.mjs";

const T = (key) => `ID_SRD_RACIAL_TRAIT_${key}`;

function trait(key, name, text, rules = [], extra = {}) {
  return element({ name, type: "Racial Trait", id: T(key), source: SOURCE, text, sheet: extra.sheet ?? text, rules, ...extra });
}

const lang = (id) => grant({ type: "Language", id });
const asi = (ability, value) => stat({ name: ability, value, alt: "Racial Ability Score Increase" });
const speed = (v) => stat({ name: "innate speed", value: v, bonus: "base" });
const size = (s) => grant({ type: "Size", id: `ID_SIZE_${s.toUpperCase()}` });
const darkvision = grant({ type: "Vision", id: "ID_VISION_DARKVISION" });
const resistance = (dmg) => grant({ type: "Condition", id: `ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_${dmg.toUpperCase()}` });
const extraLanguage = (name) => select({ type: "Language", name, supports: "Standard||Exotic" });

function race({ id, name, text, setters = [], rules }) {
  return element({ name, type: "Race", id, source: SOURCE, text, sheet: false, setters, rules });
}

function subrace({ id, name, parent, text, rules }) {
  return element({ name, type: "Sub Race", id, source: SOURCE, supports: [parent], text, sheet: false, rules });
}

function dwarf() {
  return [
    race({
      id: "ID_SRD_RACE_DWARF",
      name: "Dwarf",
      text: `Bold and hardy, dwarves are known as skilled warriors, miners and workers of stone and metal. They stand well under five feet tall but are broad and compact, and can live for more than four centuries.

Ability Score Increase: Constitution +2. Speed 25 feet, not reduced by heavy armor. Darkvision, Dwarven Resilience, Dwarven Combat Training, Tool Proficiency and Stonecunning. You speak Common and Dwarvish.`,
      setters: [["names-format", "{{name}} {{clan}}"]],
      rules: [
        asi("constitution", 2),
        speed(25),
        size("Medium"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_DWARVISH"),
        grant({ type: "Grants", id: "ID_INTERNAL_GRANT_ARMOR_IGNORE_STRENGTH_REQUIREMENT" }),
        grant({ type: "Racial Trait", id: T("DWARVEN_RESILIENCE") }),
        grant({ type: "Racial Trait", id: T("DWARVEN_COMBAT_TRAINING") }),
        grant({ type: "Racial Trait", id: T("DWARVEN_TOOL_PROFICIENCY") }),
        grant({ type: "Racial Trait", id: T("STONECUNNING") }),
        select({ type: "Sub Race", name: "Dwarven Subrace", supports: "Dwarf" }),
      ],
    }),
    element({ name: "Ignore Heavy Armor Speed Penalty", type: "Grants", id: "ID_INTERNAL_GRANT_ARMOR_IGNORE_STRENGTH_REQUIREMENT", source: SOURCE }),
    trait("DWARVEN_RESILIENCE", "Dwarven Resilience", "You have advantage on saving throws against poison, and resistance to poison damage.", [resistance("poison")]),
    trait(
      "DWARVEN_COMBAT_TRAINING",
      "Dwarven Combat Training",
      "You have proficiency with the battleaxe, handaxe, light hammer and warhammer.",
      ["BATTLEAXE", "HANDAXE", "LIGHT_HAMMER", "WARHAMMER"].map((w) => grant({ type: "Proficiency", id: weaponProfId(w) })),
      { sheet: false },
    ),
    trait(
      "DWARVEN_TOOL_PROFICIENCY",
      "Tool Proficiency",
      "You gain proficiency with your choice of smith’s tools, brewer’s supplies or mason’s tools.",
      [select({ type: "Proficiency", name: "Dwarven Tool Proficiency", supports: [toolProfId("SMITHS_TOOLS"), toolProfId("BREWERS_SUPPLIES"), toolProfId("MASONS_TOOLS")].join("|") })],
      { sheet: false },
    ),
    trait(
      "STONECUNNING",
      "Stonecunning",
      "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.",
      [],
    ),
    subrace({
      id: "ID_SUB_RACE_HILL_DWARF",
      name: "Hill Dwarf",
      parent: "Dwarf",
      text: "As a hill dwarf you have keen senses, deep intuition and remarkable resilience. Wisdom +1. Dwarven Toughness: your hit point maximum increases by 1 per level.",
      rules: [asi("wisdom", 1), grant({ type: "Racial Trait", id: T("DWARVEN_TOUGHNESS") })],
    }),
    trait(
      "DWARVEN_TOUGHNESS",
      "Dwarven Toughness",
      "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.",
      Array.from({ length: 20 }, (_, i) => stat({ name: "hp", value: 1, level: i + 1, alt: "Dwarven Toughness" })),
    ),
  ];
}

function elf() {
  return [
    race({
      id: "ID_RACE_ELF",
      name: "Elf",
      text: `Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. They can live well over seven hundred years.

Ability Score Increase: Dexterity +2. Speed 30 feet. Darkvision, Keen Senses, Fey Ancestry and Trance. You speak Common and Elvish.`,
      rules: [
        asi("dexterity", 2),
        speed(30),
        size("Medium"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_ELVISH"),
        grant({ type: "Racial Trait", id: T("KEEN_SENSES") }),
        grant({ type: "Racial Trait", id: T("FEY_ANCESTRY") }),
        grant({ type: "Racial Trait", id: T("TRANCE") }),
        select({ type: "Sub Race", name: "Elven Subrace", supports: "Elf" }),
      ],
    }),
    trait("KEEN_SENSES", "Keen Senses", "You have proficiency in the Perception skill.", [grant({ type: "Proficiency", id: skillId("Perception") })], { sheet: false }),
    trait("FEY_ANCESTRY", "Fey Ancestry", "You have advantage on saving throws against being charmed, and magic can’t put you to sleep."),
    trait("TRANCE", "Trance", "You don’t need to sleep. Instead you meditate deeply for 4 hours a day, gaining the same benefit a human does from 8 hours of sleep."),
    subrace({
      id: "ID_SUB_RACE_HIGH_ELF",
      name: "High Elf",
      parent: "Elf",
      text: "High elves have a keen mind and a mastery of at least the basics of magic. Intelligence +1, Elf Weapon Training, one wizard cantrip and one extra language.",
      rules: [
        asi("intelligence", 1),
        grant({ type: "Racial Trait", id: T("ELF_WEAPON_TRAINING") }),
        grant({ type: "Racial Trait", id: T("HIGH_ELF_CANTRIP") }),
        grant({ type: "Racial Trait", id: T("EXTRA_LANGUAGE_HIGH_ELF") }),
      ],
    }),
    trait(
      "ELF_WEAPON_TRAINING",
      "Elf Weapon Training",
      "You have proficiency with the longsword, shortsword, shortbow and longbow.",
      ["LONGSWORD", "SHORTSWORD", "SHORTBOW", "LONGBOW"].map((w) => grant({ type: "Proficiency", id: weaponProfId(w) })),
      { sheet: false },
    ),
    trait(
      "HIGH_ELF_CANTRIP",
      "Cantrip",
      "You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.",
      [select({ type: "Spell", name: "Wizard Cantrip (High Elf)", supports: "Wizard,0" })],
    ),
    trait("EXTRA_LANGUAGE_HIGH_ELF", "Extra Language", "You can speak, read and write one extra language of your choice.", [extraLanguage("Extra Language (High Elf)")], { sheet: false }),
  ];
}

function halfling() {
  return [
    race({
      id: "ID_RACE_HALFLING",
      name: "Halfling",
      text: `The diminutive halflings survive in a world full of larger creatures by avoiding notice or, barring that, avoiding offense. They stand about 3 feet tall.

Ability Score Increase: Dexterity +2. Size Small, speed 25 feet. Lucky, Brave and Halfling Nimbleness. You speak Common and Halfling.`,
      rules: [
        asi("dexterity", 2),
        speed(25),
        size("Small"),
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_HALFLING"),
        grant({ type: "Racial Trait", id: T("LUCKY") }),
        grant({ type: "Racial Trait", id: T("BRAVE") }),
        grant({ type: "Racial Trait", id: T("HALFLING_NIMBLENESS") }),
        select({ type: "Sub Race", name: "Halfling Subrace", supports: "Halfling" }),
      ],
    }),
    trait("LUCKY", "Lucky", "When you roll a 1 on the d20 for an attack roll, ability check or saving throw, you can reroll the die and must use the new roll."),
    trait("BRAVE", "Brave", "You have advantage on saving throws against being frightened."),
    trait("HALFLING_NIMBLENESS", "Halfling Nimbleness", "You can move through the space of any creature that is of a size larger than yours."),
    subrace({
      id: "ID_SUB_RACE_LIGHTFOOT_HALFLING",
      name: "Lightfoot Halfling",
      parent: "Halfling",
      text: "Lightfoot halflings can easily hide from notice, even using other people as cover. Charisma +1 and Naturally Stealthy.",
      rules: [asi("charisma", 1), grant({ type: "Racial Trait", id: T("NATURALLY_STEALTHY") })],
    }),
    trait("NATURALLY_STEALTHY", "Naturally Stealthy", "You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you."),
  ];
}

function human() {
  return [
    race({
      id: "ID_RACE_HUMAN",
      name: "Human",
      text: `Humans are the most adaptable and ambitious people among the common races, with widely varying tastes, morals and customs.

Ability Score Increase: every ability score +1. Speed 30 feet. You speak Common and one extra language of your choice.`,
      rules: [
        ...["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map((a) => asi(a, 1)),
        speed(30),
        size("Medium"),
        lang("ID_LANGUAGE_COMMON"),
        extraLanguage("Extra Language (Human)"),
      ],
    }),
  ];
}

const ANCESTRIES = [
  ["Black", "Acid", "5 by 30 ft. line (Dex. save)"],
  ["Blue", "Lightning", "5 by 30 ft. line (Dex. save)"],
  ["Brass", "Fire", "5 by 30 ft. line (Dex. save)"],
  ["Bronze", "Lightning", "5 by 30 ft. line (Dex. save)"],
  ["Copper", "Acid", "5 by 30 ft. line (Dex. save)"],
  ["Gold", "Fire", "15 ft. cone (Dex. save)"],
  ["Green", "Poison", "15 ft. cone (Con. save)"],
  ["Red", "Fire", "15 ft. cone (Dex. save)"],
  ["Silver", "Cold", "15 ft. cone (Con. save)"],
  ["White", "Cold", "15 ft. cone (Con. save)"],
];

function dragonborn() {
  const out = [
    race({
      id: "ID_RACE_DRAGONBORN",
      name: "Dragonborn",
      text: `Born of dragons, dragonborn walk proudly through a world that greets them with fearful incomprehension. They are tall and strongly built, with draconic features.

Ability Score Increase: Strength +2, Charisma +1. Speed 30 feet. Draconic Ancestry, Breath Weapon and Damage Resistance. You speak Common and Draconic.`,
      rules: [
        asi("strength", 2),
        asi("charisma", 1),
        speed(30),
        size("Medium"),
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_DRACONIC"),
        select({ type: "Racial Trait", name: "Draconic Ancestry", supports: "Draconic Ancestry" }),
        grant({ type: "Racial Trait", id: T("BREATH_WEAPON") }),
        stat({ name: "breath weapon:dc", value: 8 }),
        stat({ name: "breath weapon:dc", value: "constitution:modifier" }),
        stat({ name: "breath weapon:dc", value: "proficiency" }),
        stat({ name: "breath weapon:dice count", value: 2, bonus: "base" }),
        stat({ name: "breath weapon:dice count", value: 3, bonus: "base", level: 6 }),
        stat({ name: "breath weapon:dice count", value: 4, bonus: "base", level: 11 }),
        stat({ name: "breath weapon:dice count", value: 5, bonus: "base", level: 16 }),
      ],
    }),
    trait(
      "BREATH_WEAPON",
      "Breath Weapon",
      "You can use your action to exhale destructive energy determined by your draconic ancestry. Each creature in the area makes a saving throw (DC 8 + Constitution modifier + proficiency bonus), taking 2d6 damage on a failed save, or half as much on a success. The damage increases to 3d6 at 6th level, 4d6 at 11th and 5d6 at 16th. You can use it again after a short or long rest.",
      [],
      { sheet: "Exhale your ancestry’s energy: DC {{breath weapon:dc}}, {{breath weapon:dice count}}d6 damage (half on a success). Recharges on a short or long rest." },
    ),
  ];
  for (const [color, dmg, area] of ANCESTRIES) {
    out.push(
      element({
        name: `Draconic Ancestry (${color})`,
        type: "Racial Trait",
        id: T(`DRACONIC_ANCESTRY_${color.toUpperCase()}`),
        source: SOURCE,
        supports: ["Draconic Ancestry"],
        text: `You are descended from ${color.toLowerCase()} dragons. Breath weapon: ${dmg.toLowerCase()} damage, ${area}. You have resistance to ${dmg.toLowerCase()} damage.`,
        sheet: `${color} dragon: ${dmg.toLowerCase()} breath, ${area}. Resistance to ${dmg.toLowerCase()} damage.`,
        rules: [resistance(dmg)],
      }),
    );
  }
  return out;
}

function gnome() {
  return [
    race({
      id: "ID_RACE_GNOME",
      name: "Gnome",
      text: `A gnome’s energy and enthusiasm for living shines through every inch of their tiny body. They are slight, about 3 to 4 feet tall.

Ability Score Increase: Intelligence +2. Size Small, speed 25 feet. Darkvision and Gnome Cunning. You speak Common and Gnomish.`,
      rules: [
        asi("intelligence", 2),
        speed(25),
        size("Small"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_GNOMISH"),
        grant({ type: "Racial Trait", id: T("GNOME_CUNNING") }),
        select({ type: "Sub Race", name: "Gnome Subrace", supports: "Gnome" }),
      ],
    }),
    trait("GNOME_CUNNING", "Gnome Cunning", "You have advantage on all Intelligence, Wisdom and Charisma saving throws against magic."),
    subrace({
      id: "ID_SUB_RACE_ROCK_GNOME",
      name: "Rock Gnome",
      parent: "Gnome",
      text: "Rock gnomes have a natural inventiveness and hardiness. Constitution +1, Artificer’s Lore and Tinker.",
      rules: [asi("constitution", 1), grant({ type: "Racial Trait", id: T("ARTIFICERS_LORE") }), grant({ type: "Racial Trait", id: T("TINKER") })],
    }),
    trait(
      "ARTIFICERS_LORE",
      "Artificer’s Lore",
      "Whenever you make an Intelligence (History) check related to magic items, alchemical objects or technological devices, you add twice your proficiency bonus instead of any proficiency bonus you normally apply.",
    ),
    trait(
      "TINKER",
      "Tinker",
      "You have proficiency with tinker’s tools. Using them, you can spend 1 hour and 10 gp of materials to build a Tiny clockwork device (AC 5, 1 hp): a clockwork toy, a fire starter or a music box.",
      [grant({ type: "Proficiency", id: toolProfId("TINKERS_TOOLS") })],
    ),
  ];
}

function halfElf() {
  return [
    race({
      id: "ID_RACE_HALFELF",
      name: "Half-Elf",
      text: `Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents.

Ability Score Increase: Charisma +2 and two other ability scores of your choice +1. Speed 30 feet. Darkvision, Fey Ancestry and Skill Versatility. You speak Common, Elvish and one extra language.`,
      rules: [
        asi("charisma", 2),
        select({ type: "Ability Score Improvement", name: "Ability Score Increase (Half-Elf)", number: 2, supports: "Ability Score Improvement,Class,!Charisma" }),
        speed(30),
        size("Medium"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_ELVISH"),
        extraLanguage("Extra Language (Half-Elf)"),
        grant({ type: "Racial Trait", id: T("FEY_ANCESTRY") }),
        grant({ type: "Racial Trait", id: T("SKILL_VERSATILITY") }),
      ],
    }),
    trait("SKILL_VERSATILITY", "Skill Versatility", "You gain proficiency in two skills of your choice.", [select({ type: "Proficiency", name: "Skill Versatility", supports: "Skill", number: 2 })], {
      sheet: false,
    }),
  ];
}

function halfOrc() {
  return [
    race({
      id: "ID_RACE_HALFORC",
      name: "Half-Orc",
      text: `Half-orcs’ grayish pigmentation, sloping foreheads, jutting jaws and prominent teeth make their orcish heritage plain for all to see. They are taller and bulkier than humans.

Ability Score Increase: Strength +2, Constitution +1. Speed 30 feet. Darkvision, Menacing, Relentless Endurance and Savage Attacks. You speak Common and Orc.`,
      rules: [
        asi("strength", 2),
        asi("constitution", 1),
        speed(30),
        size("Medium"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_ORC"),
        grant({ type: "Racial Trait", id: T("MENACING") }),
        grant({ type: "Racial Trait", id: T("RELENTLESS_ENDURANCE") }),
        grant({ type: "Racial Trait", id: T("SAVAGE_ATTACKS") }),
      ],
    }),
    trait("MENACING", "Menacing", "You gain proficiency in the Intimidation skill.", [grant({ type: "Proficiency", id: skillId("Intimidation") })], { sheet: false }),
    trait("RELENTLESS_ENDURANCE", "Relentless Endurance", "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can’t do so again until you finish a long rest.", [], {
      sheet: [{ text: "When reduced to 0 hit points but not killed, drop to 1 hit point instead.", usage: "1/Long Rest" }],
    }),
    trait("SAVAGE_ATTACKS", "Savage Attacks", "When you score a critical hit with a melee weapon attack, you can roll one of the weapon’s damage dice one additional time and add it to the extra damage of the critical hit."),
  ];
}

function tiefling() {
  return [
    race({
      id: "ID_RACE_TIEFLING",
      name: "Tiefling",
      text: `To be greeted with stares and whispers, to suffer violence and insult on the street: this is the lot of the tiefling, whose infernal bloodline shows in their horns, tails and solid-colored eyes.

Ability Score Increase: Intelligence +1, Charisma +2. Speed 30 feet. Darkvision, Hellish Resistance and Infernal Legacy. You speak Common and Infernal.`,
      rules: [
        asi("intelligence", 1),
        asi("charisma", 2),
        speed(30),
        size("Medium"),
        darkvision,
        lang("ID_LANGUAGE_COMMON"),
        lang("ID_LANGUAGE_INFERNAL"),
        grant({ type: "Racial Trait", id: T("HELLISH_RESISTANCE") }),
        grant({ type: "Racial Trait", id: T("INFERNAL_LEGACY") }),
      ],
    }),
    trait("HELLISH_RESISTANCE", "Hellish Resistance", "You have resistance to fire damage.", [resistance("fire")]),
    trait(
      "INFERNAL_LEGACY",
      "Infernal Legacy",
      "You know the thaumaturgy cantrip. At 3rd level you can cast hellish rebuke as a 2nd-level spell once per long rest, and at 5th level darkness once per long rest. Charisma is your spellcasting ability for these spells.",
      [
        grant({ type: "Spell", id: "ID_PHB_SPELL_THAUMATURGY" }),
        grant({ type: "Spell", id: "ID_PHB_SPELL_HELLISH_REBUKE", level: 3 }),
        grant({ type: "Spell", id: "ID_PHB_SPELL_DARKNESS", level: 5 }),
      ],
      { sheet: [{ text: "Thaumaturgy cantrip.", level: 1 }, { text: "Thaumaturgy cantrip; hellish rebuke (2nd level) once per long rest.", level: 3 }, { text: "Thaumaturgy cantrip; hellish rebuke (2nd level) and darkness once each per long rest.", level: 5 }] },
    ),
  ];
}

export function races() {
  return [...dwarf(), ...elf(), ...halfling(), ...human(), ...dragonborn(), ...gnome(), ...halfElf(), ...halfOrc(), ...tiefling()];
}

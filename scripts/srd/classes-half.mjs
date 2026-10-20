/** Paladin and Ranger. */
import { element, grant, select, stat } from "../lib/content.mjs";
import { buildClass, progression } from "./class-builder.mjs";
import { SOURCE } from "./common.mjs";
import { armorProfId } from "./basics.mjs";

const SIMPLE = "ID_PROFICIENCY_WEAPON_PROFICIENCY_SIMPLE_WEAPONS";
const MARTIAL = "ID_PROFICIENCY_WEAPON_PROFICIENCY_MARTIAL_WEAPONS";
const LIGHT = "ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT_ARMOR";
const MEDIUM = "ID_PROFICIENCY_ARMOR_PROFICIENCY_MEDIUM_ARMOR";
const HEAVY = "ID_PROFICIENCY_ARMOR_PROFICIENCY_HEAVY_ARMOR";
const SHIELDS = armorProfId("SHIELDS");
const spell = (id, level, caster) => grant({ type: "Spell", id: `ID_PHB_SPELL_${id}`, level, spellcasting: caster, prepared: "true" });

export function paladin() {
  const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  return buildClass({
    name: "Paladin",
    hd: "d10",
    short: "A holy warrior bound to a sacred oath.",
    primary: "Strength and Charisma",
    wealth: "5d4x10",
    text: `Whether sworn before a god’s altar or in a glade before nature spirits, a paladin’s oath is a powerful bond, and a source of power that turns a devout warrior into a blessed champion.

Hit Dice: 1d10 per paladin level. Proficiencies: all armor, shields, simple and martial weapons. Saving throws: Wisdom, Charisma. Skills: choose two from Athletics, Insight, Intimidation, Medicine, Persuasion and Religion.`,
    saves: ["wisdom", "charisma"],
    armor: [LIGHT, MEDIUM, HEAVY, SHIELDS],
    weapons: [SIMPLE, MARTIAL],
    skillCount: 2,
    multiclass: {
      prerequisite: "Strength 13 and Charisma 13",
      requirements: "[str:13],[cha:13]",
      proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL],
      text: "Light armor, medium armor, shields, simple weapons, martial weapons",
    },
    spellcasting: { ability: "charisma", prepare: true, listKnown: true, slots: "half", multiclassSlots: "HALF", prepareStat: "level:paladin:half" },
    features: [
      {
        level: 1,
        name: "Divine Sense",
        text: "As an action, you can detect the presence of strong evil or good: until the end of your next turn you know the location of any celestial, fiend or undead within 60 feet that is not behind total cover. You can use this a number of times equal to 1 + your Charisma modifier per long rest.",
        sheet: [{ text: "Sense celestials, fiends and undead within 60 feet.", usage: "{{divine sense:count}}/Long Rest", action: "Action" }],
        rules: [stat({ name: "divine sense:count", value: 1 }), stat({ name: "divine sense:count", value: "charisma:modifier" })],
      },
      {
        level: 1,
        name: "Lay on Hands",
        text: "You have a pool of healing power that replenishes when you take a long rest, equal to your paladin level × 5. As an action, you can touch a creature and restore hit points from the pool, or spend 5 points to cure one disease or neutralize one poison.",
        sheet: [{ text: "Healing pool of {{lay on hands:pool}} hit points.", usage: "Long Rest", action: "Action" }],
        rules: Array.from({ length: 5 }, () => stat({ name: "lay on hands:pool", value: "level:paladin" })),
      },
      {
        level: 2,
        name: "Fighting Style",
        text: "You adopt a particular style of fighting as your specialty.",
        sheet: false,
        rules: [select({ type: "Class Feature", name: "Fighting Style (Paladin)", supports: "Fighting Style,Paladin" })],
      },
      {
        level: 2,
        name: "Spellcasting",
        text: "You prepare paladin spells from the paladin list, choosing a number equal to your Charisma modifier + half your paladin level (minimum one). Charisma is your spellcasting ability.",
        sheet: "Prepare {{paladin:spellcasting:prepare}} paladin spells.",
      },
      {
        level: 2,
        name: "Divine Smite",
        text: "When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage in addition to the weapon’s damage: 2d8 for a 1st-level slot, plus 1d8 for each slot level above 1st (maximum 5d8), plus 1d8 against undead or fiends.",
      },
      { level: 3, name: "Divine Health", text: "The divine magic flowing through you makes you immune to disease." },
      { level: 5, name: "Extra Attack", text: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      {
        level: 6,
        name: "Aura of Protection",
        text: "Whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus equal to your Charisma modifier (minimum +1). You must be conscious. At 18th level the range becomes 30 feet.",
        rules: abilities.map((a) => stat({ name: `${a}:save:misc`, value: "charisma:modifier", minimum: "1", bonus: "aura of protection", alt: "Aura of Protection" })),
      },
      { level: 10, name: "Aura of Courage", text: "You and friendly creatures within 10 feet of you can’t be frightened while you are conscious. At 18th level the range becomes 30 feet." },
      { level: 11, name: "Improved Divine Smite", text: "Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage." },
      { level: 14, name: "Cleansing Touch", text: "You can use your action to end one spell on yourself or on one willing creature that you touch. You can use this a number of times equal to your Charisma modifier (minimum once) per long rest." },
    ],
    subclass: {
      level: 3,
      featureName: "Sacred Oath",
      supports: "Sacred Oath",
      text: "At 3rd level you swear the oath that binds you as a paladin forever.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_PALADIN_OATH_OF_DEVOTION",
          name: "Oath of Devotion",
          text: "The Oath of Devotion binds a paladin to the loftiest ideals of justice, virtue and order: honesty, courage, compassion, honor and duty.",
          rules: [
            spell("PROTECTION_FROM_EVIL_AND_GOOD", 3, "Paladin"),
            spell("SANCTUARY", 3, "Paladin"),
            spell("LESSER_RESTORATION", 5, "Paladin"),
            spell("ZONE_OF_TRUTH", 5, "Paladin"),
            spell("BEACON_OF_HOPE", 9, "Paladin"),
            spell("DISPEL_MAGIC", 9, "Paladin"),
            spell("FREEDOM_OF_MOVEMENT", 13, "Paladin"),
            spell("GUARDIAN_OF_FAITH", 13, "Paladin"),
            spell("COMMUNE", 17, "Paladin"),
            spell("FLAME_STRIKE", 17, "Paladin"),
          ],
          features: [
            {
              level: 3,
              name: "Channel Divinity",
              text: "Once per short or long rest you can channel divine energy. Sacred Weapon: as an action, for 1 minute add your Charisma modifier to attack rolls with one weapon, which also sheds bright light. Turn the Unholy: as an action, each fiend or undead within 30 feet that can see or hear you must make a Wisdom save or be turned for 1 minute.",
              usage: "1/Short Rest",
              short: "Sacred Weapon or Turn the Unholy.",
            },
            { level: 7, name: "Aura of Devotion", text: "You and friendly creatures within 10 feet of you can’t be charmed while you are conscious. At 18th level the range becomes 30 feet." },
            { level: 15, name: "Purity of Spirit", text: "You are always under the effects of a protection from evil and good spell." },
            { level: 20, name: "Holy Nimbus", text: "As an action, you emanate an aura of sunlight for 1 minute. Bright light shines in a 30-foot radius; enemies starting their turn in it take 10 radiant damage, and you have advantage on saves against spells cast by fiends or undead. Once per long rest.", usage: "1/Long Rest", action: "Action", short: "Aura of sunlight for 1 minute: 10 radiant damage to enemies starting their turn within 30 feet." },
          ],
        },
      ],
    },
  });
}

const FAVORED_ENEMIES = ["Aberrations", "Beasts", "Celestials", "Constructs", "Dragons", "Elementals", "Fey", "Fiends", "Giants", "Monstrosities", "Oozes", "Plants", "Undead", "Two races of humanoid"];
const TERRAINS = ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"];

function listSelect(name, items, level) {
  const xml = items.map((t, i) => `<item id="${i + 1}">${t}</item>`).join("");
  return `<select type="List" name="${name}"${level > 1 ? ` level="${level}"` : ""}>${xml}</select>`;
}

const HUNTER_OPTIONS = [
  ["Hunter’s Prey", "Colossus Slayer", "Once per turn, when you hit a creature that is below its hit point maximum with a weapon attack, it takes an extra 1d8 damage."],
  ["Hunter’s Prey", "Giant Killer", "When a Large or larger creature within 5 feet of you hits or misses you with an attack, you can use your reaction to attack that creature immediately after its attack."],
  ["Hunter’s Prey", "Horde Breaker", "Once on each of your turns when you make a weapon attack, you can make another attack with the same weapon against a different creature within 5 feet of the original target and within range."],
  ["Defensive Tactics", "Escape the Horde", "Opportunity attacks against you are made with disadvantage."],
  ["Defensive Tactics", "Multiattack Defense", "When a creature hits you with an attack, you gain a +4 bonus to AC against all subsequent attacks made by that creature for the rest of the turn."],
  ["Defensive Tactics", "Steel Will", "You have advantage on saving throws against being frightened."],
  ["Multiattack", "Volley", "You can use your action to make a ranged attack against any number of creatures within 10 feet of a point you can see within your weapon’s range."],
  ["Multiattack", "Whirlwind Attack", "You can use your action to make a melee attack against any number of creatures within 5 feet of you."],
  ["Superior Hunter’s Defense", "Evasion", "When you are subjected to an effect that allows a Dexterity saving throw for half damage, you take no damage on a success and only half damage on a failure."],
  ["Superior Hunter’s Defense", "Stand Against the Tide", "When a hostile creature misses you with a melee attack, you can use your reaction to force it to repeat the attack against another creature of your choice."],
  ["Superior Hunter’s Defense", "Uncanny Dodge", "When an attacker you can see hits you with an attack, you can use your reaction to halve the attack’s damage against you."],
];

export function ranger() {
  const hunterExtras = HUNTER_OPTIONS.map(([group, name, text]) =>
    element({
      name,
      type: "Archetype Feature",
      id: `ID_SRD_HUNTER_OPTION_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`,
      source: SOURCE,
      supports: [group],
      text,
      sheet: text,
    }),
  );
  return buildClass({
    name: "Ranger",
    hd: "d10",
    short: "A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.",
    primary: "Dexterity and Wisdom",
    wealth: "5d4x10",
    text: `Far from the bustle of cities, rangers keep their unending watch over the wilderness, hunting the monsters that threaten it.

Hit Dice: 1d10 per ranger level. Proficiencies: light and medium armor, shields, simple and martial weapons. Saving throws: Strength, Dexterity. Skills: choose three from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth and Survival.`,
    saves: ["strength", "dexterity"],
    armor: [LIGHT, MEDIUM, SHIELDS],
    weapons: [SIMPLE, MARTIAL],
    skillCount: 3,
    multiclass: {
      prerequisite: "Dexterity 13 and Wisdom 13",
      requirements: "[dex:13],[wis:13]",
      proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL],
      skillCount: 1,
      text: "Light armor, medium armor, shields, simple weapons, martial weapons, one skill from the class’s skill list",
    },
    spellcasting: {
      ability: "wisdom",
      prepare: false,
      slots: "half",
      multiclassSlots: "HALF",
      known: (lv) => (lv < 2 ? 0 : Math.floor((lv + 1) / 2) + 1),
    },
    features: [
      {
        level: 1,
        name: "Favored Enemy",
        text: "Choose a type of favored enemy (or two races of humanoid). You have advantage on Wisdom (Survival) checks to track them and on Intelligence checks to recall information about them, and you learn one language they speak. You choose one additional favored enemy at 6th and 14th level.",
        rules: [listSelect("Favored Enemy", FAVORED_ENEMIES, 1), listSelect("Favored Enemy (6th level)", FAVORED_ENEMIES, 6), listSelect("Favored Enemy (14th level)", FAVORED_ENEMIES, 14), select({ type: "Language", name: "Favored Enemy Language", supports: "Standard||Exotic" })],
      },
      {
        level: 1,
        name: "Natural Explorer",
        text: "Choose one type of favored terrain. When you make an Intelligence or Wisdom check related to it, your proficiency bonus is doubled if you use a skill you’re proficient in. While traveling there for an hour or more, difficult terrain doesn’t slow your group, you can’t become lost except by magic, and you remain alert to danger. You choose additional favored terrains at 6th and 10th level.",
        rules: [listSelect("Favored Terrain", TERRAINS, 1), listSelect("Favored Terrain (6th level)", TERRAINS, 6), listSelect("Favored Terrain (10th level)", TERRAINS, 10)],
      },
      {
        level: 2,
        name: "Fighting Style",
        text: "You adopt a particular style of fighting as your specialty.",
        sheet: false,
        rules: [select({ type: "Class Feature", name: "Fighting Style (Ranger)", supports: "Fighting Style,Ranger" })],
      },
      { level: 2, name: "Spellcasting", text: "You have learned to use the magical essence of nature to cast spells. Wisdom is your spellcasting ability for ranger spells.", sheet: false },
      { level: 3, name: "Primeval Awareness", text: "You can use your action and expend one ranger spell slot to sense whether aberrations, celestials, dragons, elementals, fey, fiends or undead are present within 1 mile (6 miles in favored terrain) for 1 minute per level of the slot." },
      { level: 5, name: "Extra Attack", text: "You can attack twice, instead of once, whenever you take the Attack action on your turn." },
      { level: 8, name: "Land’s Stride", text: "Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed or harmed. You have advantage on saves against magically created plants that impede movement." },
      { level: 10, name: "Hide in Plain Sight", text: "You can spend 1 minute creating camouflage. Once camouflaged, you gain a +10 bonus to Dexterity (Stealth) checks as long as you remain there without moving or taking actions." },
      { level: 14, name: "Vanish", text: "You can use the Hide action as a bonus action on your turn. Also, you can’t be tracked by nonmagical means unless you choose to leave a trail." },
      { level: 18, name: "Feral Senses", text: "You gain preternatural senses: attacking a creature you can’t see doesn’t impose disadvantage, and you are aware of the location of any invisible creature within 30 feet of you that isn’t hidden." },
      { level: 20, name: "Foe Slayer", text: "Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies." },
    ],
    subclass: {
      level: 3,
      featureName: "Ranger Archetype",
      supports: "Ranger Archetype",
      text: "At 3rd level you choose an archetype that you strive to emulate.",
      archetypes: [
        {
          id: "ID_WOTC_ARCHETYPE_RANGER_HUNTER",
          name: "Hunter",
          text: "Emulating the Hunter archetype means accepting your place as a bulwark between civilization and the terrors of the wilderness.",
          extras: hunterExtras,
          features: [
            { level: 3, name: "Hunter’s Prey", text: "Choose one feature: Colossus Slayer, Giant Killer or Horde Breaker.", sheet: false, rules: [select({ type: "Archetype Feature", name: "Hunter’s Prey", supports: "Hunter’s Prey" })] },
            { level: 7, name: "Defensive Tactics", text: "Choose one feature: Escape the Horde, Multiattack Defense or Steel Will.", sheet: false, rules: [select({ type: "Archetype Feature", name: "Defensive Tactics", supports: "Defensive Tactics" })] },
            { level: 11, name: "Multiattack", text: "Choose one feature: Volley or Whirlwind Attack.", sheet: false, rules: [select({ type: "Archetype Feature", name: "Multiattack", supports: "Multiattack" })] },
            { level: 15, name: "Superior Hunter’s Defense", text: "Choose one feature: Evasion, Stand Against the Tide or Uncanny Dodge.", sheet: false, rules: [select({ type: "Archetype Feature", name: "Superior Hunter’s Defense", supports: "Superior Hunter’s Defense" })] },
          ],
        },
      ],
    },
  });
}

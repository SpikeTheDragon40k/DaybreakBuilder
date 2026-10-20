/** Barbarian, Fighter, Monk and Rogue. */
import { element, grant, select, stat } from "../lib/content.mjs";
import { buildClass, progression } from "./class-builder.mjs";
import { SOURCE } from "./common.mjs";
import { armorProfId, skillId, toolProfId, weaponProfId } from "./basics.mjs";

const SIMPLE = "ID_PROFICIENCY_WEAPON_PROFICIENCY_SIMPLE_WEAPONS";
const MARTIAL = "ID_PROFICIENCY_WEAPON_PROFICIENCY_MARTIAL_WEAPONS";
const LIGHT = "ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT_ARMOR";
const MEDIUM = "ID_PROFICIENCY_ARMOR_PROFICIENCY_MEDIUM_ARMOR";
const HEAVY = "ID_PROFICIENCY_ARMOR_PROFICIENCY_HEAVY_ARMOR";
const SHIELDS = armorProfId("SHIELDS");

const extraAttack = (level, extra = []) => ({
  level,
  name: "Extra Attack",
  text: "You can attack twice, instead of once, whenever you take the Attack action on your turn.",
  ...extra,
});

export function barbarian() {
  return buildClass({
    name: "Barbarian",
    hd: "d12",
    short: "A fierce warrior of primitive background who can enter a battle rage.",
    primary: "Strength",
    text: `Barbarians are defined by their rage: unbridled, unquenchable and unthinking fury. They are hardy warriors who shrug off blows and wade into battle.

Hit Dice: 1d12 per barbarian level. Proficiencies: light and medium armor, shields, simple and martial weapons. Saving throws: Strength, Constitution. Skills: choose two from Animal Handling, Athletics, Intimidation, Nature, Perception and Survival.`,
    saves: ["strength", "constitution"],
    armor: [LIGHT, MEDIUM, SHIELDS],
    weapons: [SIMPLE, MARTIAL],
    skillCount: 2,
    multiclass: { prerequisite: "Strength 13", requirements: "[str:13]", proficiencies: [SHIELDS, SIMPLE, MARTIAL], text: "Shields, simple weapons, martial weapons" },
    features: [
      {
        level: 1,
        name: "Rage",
        text: "On your turn you can enter a rage as a bonus action. While raging (and not wearing heavy armor) you have advantage on Strength checks and saving throws, a bonus to melee weapon damage rolls using Strength, and resistance to bludgeoning, piercing and slashing damage. You can’t cast or concentrate on spells. Rage lasts 1 minute and ends early if you are knocked unconscious or haven’t attacked or taken damage since your last turn.",
        sheet: [{ text: "Bonus action: advantage on Strength checks and saves, +{{rage:damage}} melee damage, resistance to bludgeoning, piercing and slashing damage.", usage: "{{rage:count}}/Long Rest", action: "Bonus Action" }],
        rules: [
          ...progression("rage:count", (lv) => (lv >= 20 ? 99 : lv >= 17 ? 6 : lv >= 12 ? 5 : lv >= 6 ? 4 : lv >= 3 ? 3 : 2)),
          ...progression("rage:damage", (lv) => (lv >= 16 ? 4 : lv >= 9 ? 3 : 2)),
        ],
      },
      {
        level: 1,
        name: "Unarmored Defense",
        key: "UNARMORED_DEFENSE",
        text: "While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.",
        rules: [
          stat({ name: "ac:barbarian", value: 10 }),
          stat({ name: "ac:barbarian", value: "dexterity:modifier" }),
          stat({ name: "ac:barbarian", value: "constitution:modifier" }),
          stat({ name: "ac:calculation", value: "ac:barbarian", bonus: "calculation", equipped: "[armor:none]", alt: "Unarmored Defense" }),
        ],
      },
      { level: 2, name: "Reckless Attack", text: "When you make your first attack on your turn, you can attack recklessly: you gain advantage on melee weapon attack rolls using Strength this turn, but attack rolls against you have advantage until your next turn." },
      { level: 2, name: "Danger Sense", text: "You have advantage on Dexterity saving throws against effects you can see, such as traps and spells, while you aren’t blinded, deafened or incapacitated." },
      extraAttack(5),
      {
        level: 5,
        name: "Fast Movement",
        text: "Your speed increases by 10 feet while you aren’t wearing heavy armor.",
        rules: [stat({ name: "speed:misc", value: 10, equipped: "![armor:heavy]", alt: "Fast Movement" })],
      },
      { level: 7, name: "Feral Instinct", text: "You have advantage on initiative rolls. If you are surprised at the start of combat, you can act normally on your first turn if you enter your rage first." },
      {
        level: 9,
        name: "Brutal Critical",
        text: "You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at 13th level and three at 17th level.",
        sheet: "Roll {{brutal critical:dice}} additional weapon damage dice on a melee critical hit.",
        rules: progression("brutal critical:dice", (lv) => (lv >= 17 ? 3 : lv >= 13 ? 2 : lv >= 9 ? 1 : 0)),
      },
      { level: 11, name: "Relentless Rage", text: "If you drop to 0 hit points while raging and don’t die outright, you can make a DC 10 Constitution saving throw to drop to 1 hit point instead. Each use after the first increases the DC by 5 until you finish a short or long rest." },
      { level: 15, name: "Persistent Rage", text: "Your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it." },
      { level: 18, name: "Indomitable Might", text: "If your total for a Strength check is less than your Strength score, you can use that score in place of the total." },
      {
        level: 20,
        name: "Primal Champion",
        text: "Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.",
        rules: [
          stat({ name: "strength", value: 4, alt: "Primal Champion" }),
          stat({ name: "constitution", value: 4, alt: "Primal Champion" }),
          stat({ name: "strength:max", value: 4 }),
          stat({ name: "constitution:max", value: 4 }),
        ],
      },
    ],
    subclass: {
      level: 3,
      featureName: "Primal Path",
      supports: "Primal Path",
      text: "At 3rd level you choose a path that shapes the nature of your rage.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_PATH_OF_THE_BERSERKER",
          name: "Path of the Berserker",
          text: "For some barbarians, rage is a means to an end, and that end is violence. The Path of the Berserker is a path of untrammeled fury, slick with blood.",
          features: [
            { level: 3, name: "Frenzy", text: "You can go into a frenzy when you rage. For the duration you can make a single melee weapon attack as a bonus action on each of your turns after this one. When your rage ends, you suffer one level of exhaustion." },
            { level: 6, name: "Mindless Rage", text: "You can’t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage." },
            { level: 10, name: "Intimidating Presence", text: "You can use your action to frighten someone with your menacing presence: one creature within 30 feet that can see or hear you must succeed on a Wisdom saving throw (DC 8 + proficiency bonus + Charisma modifier) or be frightened until the end of your next turn." },
            { level: 14, name: "Retaliation", text: "When you take damage from a creature within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature." },
          ],
        },
      ],
    },
  });
}

export function fighter() {
  return buildClass({
    name: "Fighter",
    hd: "d10",
    short: "A master of martial combat, skilled with a variety of weapons and armor.",
    primary: "Strength or Dexterity",
    text: `Fighters share an unparalleled mastery with weapons and armor, and a thorough knowledge of the skills of combat.

Hit Dice: 1d10 per fighter level. Proficiencies: all armor, shields, simple and martial weapons. Saving throws: Strength, Constitution. Skills: choose two from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception and Survival.`,
    saves: ["strength", "constitution"],
    armor: [LIGHT, MEDIUM, HEAVY, SHIELDS],
    weapons: [SIMPLE, MARTIAL],
    skillCount: 2,
    asiLevels: [4, 6, 8, 12, 14, 16, 19],
    multiclass: {
      prerequisite: "Strength 13 or Dexterity 13",
      requirements: "[str:13]||[dex:13]",
      proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL],
      text: "Light armor, medium armor, shields, simple weapons, martial weapons",
    },
    features: [
      {
        level: 1,
        name: "Fighting Style",
        text: "You adopt a particular style of fighting as your specialty. You can’t take a Fighting Style option more than once.",
        sheet: false,
        rules: [select({ type: "Class Feature", name: "Fighting Style (Fighter)", supports: "Fighting Style,Fighter" })],
      },
      {
        level: 1,
        name: "Second Wind",
        text: "On your turn you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
        sheet: [{ text: "Regain 1d10 + {{level:fighter}} hit points.", usage: "1/Short Rest", action: "Bonus Action" }],
      },
      {
        level: 2,
        name: "Action Surge",
        text: "On your turn you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level you can use it twice before a rest, but only once on the same turn.",
        sheet: [
          { text: "Take one additional action on your turn.", usage: "1/Short Rest", level: 2 },
          { text: "Take one additional action on your turn.", usage: "2/Short Rest", level: 17 },
        ],
      },
      extraAttack(5, {
        text: "You can attack twice whenever you take the Attack action on your turn. The number of attacks increases to three at 11th level and four at 20th level.",
        sheet: [
          { text: "You can attack twice when you take the Attack action.", level: 5 },
          { text: "You can attack three times when you take the Attack action.", level: 11 },
          { text: "You can attack four times when you take the Attack action.", level: 20 },
        ],
      }),
      {
        level: 9,
        name: "Indomitable",
        text: "You can reroll a saving throw that you fail, and must use the new roll. You can use this once between long rests, twice from 13th level and three times from 17th level.",
        sheet: [
          { text: "Reroll a failed saving throw.", usage: "1/Long Rest", level: 9 },
          { text: "Reroll a failed saving throw.", usage: "2/Long Rest", level: 13 },
          { text: "Reroll a failed saving throw.", usage: "3/Long Rest", level: 17 },
        ],
      },
    ],
    subclass: {
      level: 3,
      featureName: "Martial Archetype",
      supports: "Martial Archetype",
      text: "At 3rd level you choose an archetype that you strive to emulate in your combat styles and techniques.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_CHAMPION",
          name: "Champion",
          text: "The archetypal Champion focuses on the development of raw physical power honed to deadly perfection.",
          features: [
            { level: 3, name: "Improved Critical", text: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
            {
              level: 7,
              name: "Remarkable Athlete",
              text: "You can add half your proficiency bonus (rounded up) to any Strength, Dexterity or Constitution check you make that doesn’t already use your proficiency bonus. Your running long jump distance increases by a number of feet equal to your Strength modifier.",
            },
            {
              level: 10,
              name: "Additional Fighting Style",
              text: "You can choose a second option from the Fighting Style class feature.",
              sheet: false,
              rules: [select({ type: "Class Feature", name: "Additional Fighting Style (Champion)", supports: "Fighting Style,Fighter" })],
            },
            { level: 15, name: "Superior Critical", text: "Your weapon attacks score a critical hit on a roll of 18–20." },
            {
              level: 18,
              name: "Survivor",
              text: "At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half your hit points left. You don’t gain this benefit if you have 0 hit points.",
            },
          ],
        },
      ],
    },
  });
}

export function monk() {
  return buildClass({
    name: "Monk",
    hd: "d8",
    short: "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.",
    primary: "Dexterity and Wisdom",
    text: `Monks make careful study of a magical energy they call ki, channeling it into their strikes and movement.

Hit Dice: 1d8 per monk level. Proficiencies: simple weapons, shortswords; one artisan’s tool or musical instrument. Saving throws: Strength, Dexterity. Skills: choose two from Acrobatics, Athletics, History, Insight, Religion and Stealth.`,
    saves: ["strength", "dexterity"],
    weapons: [SIMPLE, weaponProfId("SHORTSWORD")],
    skillCount: 2,
    toolSelect: { name: "Tool Proficiency (Monk)", supports: "Artisan||Musical Instrument" },
    multiclass: {
      prerequisite: "Dexterity 13 and Wisdom 13",
      requirements: "[dex:13],[wis:13]",
      proficiencies: [SIMPLE, weaponProfId("SHORTSWORD")],
      text: "Simple weapons, shortswords",
    },
    features: [
      {
        level: 1,
        name: "Unarmored Defense",
        key: "UNARMORED_DEFENSE",
        text: "While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.",
        rules: [
          stat({ name: "ac:monk", value: 10 }),
          stat({ name: "ac:monk", value: "dexterity:modifier" }),
          stat({ name: "ac:monk", value: "wisdom:modifier" }),
          stat({ name: "ac:calculation", value: "ac:monk", bonus: "calculation", equipped: "[armor:none],[shield:none]", alt: "Unarmored Defense" }),
        ],
      },
      {
        level: 1,
        name: "Martial Arts",
        text: "While unarmed or wielding only monk weapons (shortswords and simple melee weapons without the two-handed or heavy property) and not wearing armor or a shield: you can use Dexterity instead of Strength for attack and damage rolls, roll a martial arts die in place of normal damage, and make one unarmed strike as a bonus action after taking the Attack action.",
        sheet: "Martial arts die d{{martial arts:die}}; use Dexterity for monk weapons; bonus action unarmed strike after the Attack action.",
        rules: progression("martial arts:die", (lv) => (lv >= 17 ? 10 : lv >= 11 ? 8 : lv >= 5 ? 6 : 4)),
      },
      {
        level: 2,
        name: "Ki",
        text: "You have a number of ki points equal to your monk level, regained after a short or long rest. Your ki save DC is 8 + proficiency bonus + Wisdom modifier. Flurry of Blows: after the Attack action, spend 1 ki to make two unarmed strikes as a bonus action. Patient Defense: spend 1 ki to Dodge as a bonus action. Step of the Wind: spend 1 ki to Disengage or Dash as a bonus action, and your jump distance is doubled for the turn.",
        sheet: [{ text: "{{level:monk}} ki points; ki save DC {{ki:dc}}. Flurry of Blows, Patient Defense, Step of the Wind.", usage: "Short Rest" }],
        rules: [stat({ name: "ki:dc", value: 8 }), stat({ name: "ki:dc", value: "proficiency" }), stat({ name: "ki:dc", value: "wisdom:modifier" })],
      },
      {
        level: 2,
        name: "Unarmored Movement",
        text: "Your speed increases while you are not wearing armor or wielding a shield: +10 feet at 2nd level, rising to +30 feet at 18th level. At 9th level you can move along vertical surfaces and across liquids on your turn without falling.",
        rules: progression("monk:unarmored movement", (lv) => (lv >= 18 ? 30 : lv >= 14 ? 25 : lv >= 10 ? 20 : lv >= 6 ? 15 : lv >= 2 ? 10 : 0)).concat([
          stat({ name: "speed:misc", value: "monk:unarmored movement", equipped: "[armor:none],[shield:none]", alt: "Unarmored Movement" }),
        ]),
      },
      { level: 3, name: "Deflect Missiles", text: "You can use your reaction to deflect or catch a missile when hit by a ranged weapon attack, reducing the damage by 1d10 + Dexterity modifier + monk level. If reduced to 0 and you have a free hand, you can catch it and spend 1 ki to throw it back." },
      { level: 4, name: "Slow Fall", text: "You can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level." },
      extraAttack(5),
      { level: 5, name: "Stunning Strike", text: "When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn." },
      { level: 6, name: "Ki-Empowered Strikes", text: "Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage." },
      { level: 7, name: "Evasion", text: "When you are subjected to an effect that allows a Dexterity saving throw for half damage, you take no damage on a success and only half damage on a failure." },
      { level: 7, name: "Stillness of Mind", text: "You can use your action to end one effect on yourself that is causing you to be charmed or frightened." },
      {
        level: 10,
        name: "Purity of Body",
        text: "Your mastery of ki makes you immune to disease and poison.",
        rules: [grant({ type: "Condition", id: "ID_INTERNAL_CONDITION_DAMAGE_IMMUNITY_POISON" })],
      },
      { level: 13, name: "Tongue of the Sun and Moon", text: "You understand all spoken languages, and any creature that can understand a language can understand what you say." },
      {
        level: 14,
        name: "Diamond Soul",
        text: "You gain proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.",
        rules: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map((a) =>
          grant({ type: "Proficiency", id: `ID_PROFICIENCY_SAVINGTHROW_${a.toUpperCase()}` }),
        ),
      },
      { level: 15, name: "Timeless Body", text: "Your ki sustains you so that you suffer none of the frailty of old age, and you can’t be aged magically. You no longer need food or water." },
      { level: 18, name: "Empty Body", text: "You can spend 4 ki points to become invisible for 1 minute, with resistance to all damage but force damage. You can also spend 8 ki points to cast astral projection without material components." },
      { level: 20, name: "Perfect Self", text: "When you roll for initiative and have no ki points remaining, you regain 4 ki points." },
    ],
    subclass: {
      level: 3,
      featureName: "Monastic Tradition",
      supports: "Monastic Tradition",
      text: "At 3rd level you commit yourself to a monastic tradition.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_WAY_OF_THE_OPEN_HAND",
          name: "Way of the Open Hand",
          text: "Monks of the Way of the Open Hand are the ultimate masters of martial arts combat, whether armed or unarmed.",
          features: [
            { level: 3, name: "Open Hand Technique", text: "Whenever you hit with a Flurry of Blows attack, you can impose one effect: the target must succeed on a Dexterity save or be knocked prone; make a Strength save or be pushed 15 feet; or it can’t take reactions until the end of your next turn." },
            { level: 6, name: "Wholeness of Body", text: "As an action, you can regain hit points equal to three times your monk level. You must finish a long rest before you can use this feature again.", usage: "1/Long Rest", action: "Action", short: "Regain hit points equal to three times your monk level." },
            { level: 11, name: "Tranquility", text: "At the end of a long rest, you gain the effect of a sanctuary spell that lasts until the start of your next long rest (DC 8 + Wisdom modifier + proficiency bonus)." },
            { level: 17, name: "Quivering Palm", text: "When you hit a creature with an unarmed strike, you can spend 3 ki points to start lethal vibrations. Later, you can use an action to end them: the target must make a Constitution saving throw, dropping to 0 hit points on a failure or taking 10d10 necrotic damage on a success." },
          ],
        },
      ],
    },
  });
}

export function rogue() {
  return buildClass({
    name: "Rogue",
    hd: "d8",
    short: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
    primary: "Dexterity",
    text: `Rogues rely on skill, stealth and their foes’ vulnerabilities to get the upper hand in any situation.

Hit Dice: 1d8 per rogue level. Proficiencies: light armor; simple weapons, hand crossbows, longswords, rapiers, shortswords; thieves’ tools. Saving throws: Dexterity, Intelligence. Skills: choose four from Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand and Stealth.`,
    saves: ["dexterity", "intelligence"],
    armor: [LIGHT],
    weapons: [SIMPLE, ...["CROSSBOW_HAND", "LONGSWORD", "RAPIER", "SHORTSWORD"].map(weaponProfId)],
    tools: [toolProfId("THIEVES_TOOLS")],
    skillCount: 4,
    asiLevels: [4, 8, 10, 12, 16, 19],
    multiclass: {
      prerequisite: "Dexterity 13",
      requirements: "[dex:13]",
      proficiencies: [LIGHT, toolProfId("THIEVES_TOOLS")],
      skillCount: 1,
      text: "Light armor, one skill from the class’s skill list, thieves’ tools",
    },
    features: [
      {
        level: 1,
        name: "Expertise",
        key: "EXPERTISE_1",
        text: "Choose two of your skill proficiencies, or one skill proficiency and your proficiency with thieves’ tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 6th level you choose two more.",
        sheet: false,
        rules: [select({ type: "Proficiency", name: "Expertise (Rogue)", supports: "Expertise", number: 2 })],
      },
      {
        level: 1,
        name: "Sneak Attack",
        text: "Once per turn, you can deal extra damage to one creature you hit with an attack if you have advantage on the attack roll, or if another enemy of the target is within 5 feet of it. The attack must use a finesse or ranged weapon.",
        sheet: "Once per turn, deal an extra {{sneak attack:dice}}d6 damage with a finesse or ranged weapon attack.",
        rules: progression("sneak attack:dice", (lv) => Math.ceil(lv / 2)),
      },
      {
        level: 1,
        name: "Thieves’ Cant",
        text: "You know thieves’ cant, a secret mix of dialect, jargon and code that allows you to hide messages in seemingly normal conversation.",
        sheet: false,
        rules: [grant({ type: "Language", id: "ID_WOTC_PHB_LANGUAGE_THIEVES_CANT" })],
      },
      { level: 2, name: "Cunning Action", text: "You can take a bonus action on each of your turns in combat to Dash, Disengage or Hide.", action: "Bonus Action", short: "Dash, Disengage or Hide as a bonus action." },
      { level: 5, name: "Uncanny Dodge", text: "When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack’s damage against you.", action: "Reaction", short: "Halve the damage of an attack that hits you." },
      {
        level: 6,
        name: "Expertise",
        key: "EXPERTISE_6",
        text: "Choose two more of your proficiencies to gain the benefits of Expertise.",
        sheet: false,
        rules: [select({ type: "Proficiency", name: "Expertise (Rogue 6)", supports: "Expertise", number: 2 })],
      },
      { level: 7, name: "Evasion", text: "When you are subjected to an effect that allows a Dexterity saving throw for half damage, you take no damage on a success and only half damage on a failure." },
      { level: 11, name: "Reliable Talent", text: "Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10." },
      { level: 14, name: "Blindsense", text: "If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you." },
      {
        level: 15,
        name: "Slippery Mind",
        text: "You have acquired greater mental strength. You gain proficiency in Wisdom saving throws.",
        sheet: false,
        rules: [grant({ type: "Proficiency", id: "ID_PROFICIENCY_SAVINGTHROW_WISDOM" })],
      },
      { level: 18, name: "Elusive", text: "No attack roll has advantage against you while you aren’t incapacitated." },
      { level: 20, name: "Stroke of Luck", text: "If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Once used, you must finish a short or long rest to use it again.", usage: "1/Short Rest", short: "Turn a miss into a hit, or treat a failed ability check’s d20 as a 20." },
    ],
    subclass: {
      level: 3,
      featureName: "Roguish Archetype",
      supports: "Roguish Archetype",
      text: "At 3rd level you choose an archetype that you emulate in the exercise of your rogue abilities.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_THIEF",
          name: "Thief",
          text: "You hone your skills in the larcenous arts. Burglars, bandits, cutpurses and other criminals typically follow this archetype.",
          features: [
            { level: 3, name: "Fast Hands", text: "You can use the bonus action granted by your Cunning Action to make a Dexterity (Sleight of Hand) check, use your thieves’ tools to disarm a trap or open a lock, or take the Use an Object action." },
            { level: 3, name: "Second-Story Work", text: "Climbing no longer costs you extra movement. When you make a running jump, the distance you cover increases by a number of feet equal to your Dexterity modifier." },
            { level: 9, name: "Supreme Sneak", text: "You have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn." },
            { level: 13, name: "Use Magic Device", text: "You ignore all class, race and level requirements on the use of magic items." },
            { level: 17, name: "Thief’s Reflexes", text: "You can take two turns during the first round of any combat: your first turn at your normal initiative and your second at your initiative minus 10." },
          ],
        },
      ],
    },
  });
}

export { skillId };

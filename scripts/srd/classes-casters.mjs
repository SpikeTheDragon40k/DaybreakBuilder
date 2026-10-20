/** Bard, Cleric, Druid, Sorcerer, Warlock and Wizard. */
import { element, grant, select, stat } from "../lib/content.mjs";
import { buildClass, progression } from "./class-builder.mjs";
import { SOURCE } from "./common.mjs";
import { armorProfId, skillId, weaponProfId } from "./basics.mjs";

const SIMPLE = "ID_PROFICIENCY_WEAPON_PROFICIENCY_SIMPLE_WEAPONS";
const LIGHT = "ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT_ARMOR";
const MEDIUM = "ID_PROFICIENCY_ARMOR_PROFICIENCY_MEDIUM_ARMOR";
const HEAVY = "ID_PROFICIENCY_ARMOR_PROFICIENCY_HEAVY_ARMOR";
const SHIELDS = armorProfId("SHIELDS");
const cantrips = (a, b, c) => (lv) => (lv >= 10 ? c : lv >= 4 ? b : a);
const spellId = (name) => `ID_PHB_SPELL_${name}`;
const alwaysPrepared = (name, level, caster) => grant({ type: "Spell", id: spellId(name), level, spellcasting: caster, prepared: "true" });

export function bard() {
  const known = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22];
  return buildClass({
    name: "Bard",
    hd: "d8",
    short: "An inspiring magician whose power echoes the music of creation.",
    primary: "Charisma",
    wealth: "5d4x10",
    text: `Whether scholar, skald or scoundrel, a bard weaves magic through words and music to inspire allies, demoralize foes, manipulate minds and heal wounds.

Hit Dice: 1d8 per bard level. Proficiencies: light armor; simple weapons, hand crossbows, longswords, rapiers, shortswords; three musical instruments. Saving throws: Dexterity, Charisma. Skills: choose any three.`,
    saves: ["dexterity", "charisma"],
    armor: [LIGHT],
    weapons: [SIMPLE, ...["CROSSBOW_HAND", "LONGSWORD", "RAPIER", "SHORTSWORD"].map(weaponProfId)],
    skillCount: 3,
    skillSupports: "Skill",
    toolSelect: { name: "Musical Instruments (Bard)", supports: "Musical Instrument", number: 3 },
    multiclass: {
      prerequisite: "Charisma 13",
      requirements: "[cha:13]",
      proficiencies: [LIGHT],
      skillCount: 1,
      toolSelect: { name: "Musical Instrument (Bard Multiclass)", supports: "Musical Instrument" },
      text: "Light armor, one skill of your choice, one musical instrument of your choice",
    },
    spellcasting: { ability: "charisma", prepare: false, slots: "full", multiclassSlots: "FULL", cantrips: cantrips(2, 3, 4), known: (lv) => known[lv] },
    features: [
      { level: 1, name: "Spellcasting", text: "You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Charisma is your spellcasting ability, and you can use a musical instrument as a spellcasting focus.", sheet: false },
      {
        level: 1,
        name: "Bardic Inspiration",
        text: "As a bonus action, you can inspire one creature other than yourself within 60 feet who can hear you. It gains a Bardic Inspiration die it can add to one ability check, attack roll or saving throw within the next 10 minutes. You can do this a number of times equal to your Charisma modifier (minimum once), regaining uses on a long rest (short rest from 5th level). The die is a d6, becoming a d8 at 5th level, a d10 at 10th and a d12 at 15th.",
        sheet: [{ text: "Grant a d{{bardic inspiration:die}} to a creature within 60 feet.", usage: "{{bardic inspiration:count}}/Rest", action: "Bonus Action" }],
        rules: [
          ...progression("bardic inspiration:die", (lv) => (lv >= 15 ? 12 : lv >= 10 ? 10 : lv >= 5 ? 8 : 6)),
          stat({ name: "bardic inspiration:count", value: "charisma:modifier", minimum: "1" }),
        ],
      },
      { level: 2, name: "Jack of All Trades", text: "You can add half your proficiency bonus, rounded down, to any ability check you make that doesn’t already include your proficiency bonus." },
      {
        level: 2,
        name: "Song of Rest",
        text: "If you or any friendly creatures who can hear your performance regain hit points by spending Hit Dice at the end of a short rest, each of those creatures regains an extra 1d6 hit points. The die increases to d8 at 9th level, d10 at 13th and d12 at 17th.",
        sheet: "Allies spending Hit Dice during a short rest regain an extra 1d{{song of rest:die}} hit points.",
        rules: progression("song of rest:die", (lv) => (lv >= 17 ? 12 : lv >= 13 ? 10 : lv >= 9 ? 8 : lv >= 2 ? 6 : 0)),
      },
      {
        level: 3,
        name: "Expertise",
        key: "EXPERTISE_3",
        text: "Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of them. At 10th level you choose two more.",
        sheet: false,
        rules: [select({ type: "Proficiency", name: "Expertise (Bard)", supports: "Skill Expertise", number: 2 })],
      },
      { level: 5, name: "Font of Inspiration", text: "You regain all of your expended uses of Bardic Inspiration when you finish a short or long rest." },
      { level: 6, name: "Countercharm", text: "As an action, you can start a performance that lasts until the end of your next turn. During that time, you and friendly creatures within 30 feet have advantage on saving throws against being frightened or charmed." },
      {
        level: 10,
        name: "Expertise",
        key: "EXPERTISE_10",
        text: "Choose two more of your skill proficiencies to gain the benefits of Expertise.",
        sheet: false,
        rules: [select({ type: "Proficiency", name: "Expertise (Bard 10)", supports: "Skill Expertise", number: 2 })],
      },
      ...[10, 14, 18].map((lv) => ({
        level: lv,
        key: `MAGICAL_SECRETS_${lv}`,
        name: "Magical Secrets",
        text: "Choose two spells from any classes, including this one. A spell you choose must be of a level you can cast, or a cantrip. The chosen spells count as bard spells for you.",
        sheet: false,
        rules: [select({ type: "Spell", name: `Magical Secrets (${lv})`, supports: "(0)||($(spellcasting:slots))", number: 2, spellcasting: "Bard", level: lv })],
      })),
      { level: 20, name: "Superior Inspiration", text: "When you roll initiative and have no uses of Bardic Inspiration left, you regain one use." },
    ],
    subclass: {
      level: 3,
      featureName: "Bard College",
      supports: "Bard College",
      text: "At 3rd level you delve into the advanced techniques of a bard college of your choice.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_COLLEGE_OF_LORE",
          name: "College of Lore",
          text: "Bards of the College of Lore know something about most things, collecting bits of knowledge from scholarly tomes and peasant tales alike.",
          features: [
            { level: 3, name: "Bonus Proficiencies", text: "You gain proficiency with three skills of your choice.", sheet: false, rules: [select({ type: "Proficiency", name: "Bonus Proficiencies (College of Lore)", supports: "Skill", number: 3 })] },
            { level: 3, name: "Cutting Words", text: "When a creature you can see within 60 feet makes an attack roll, ability check or damage roll, you can use your reaction to expend one Bardic Inspiration and subtract the roll from the creature’s result, after it rolls but before the outcome is known.", action: "Reaction", short: "Expend Bardic Inspiration to subtract the die from a creature’s roll." },
            {
              level: 6,
              name: "Additional Magical Secrets",
              text: "You learn two spells of your choice from any class. They must be of a level you can cast or cantrips, and count as bard spells for you.",
              sheet: false,
              rules: [select({ type: "Spell", name: "Additional Magical Secrets", supports: "(0)||($(spellcasting:slots))", number: 2, spellcasting: "Bard", level: 6 })],
            },
            { level: 14, name: "Peerless Skill", text: "When you make an ability check, you can expend one use of Bardic Inspiration and add the die to the check, after rolling but before knowing the outcome." },
          ],
        },
      ],
    },
  });
}

export function cleric() {
  return buildClass({
    name: "Cleric",
    hd: "d8",
    short: "A priestly champion who wields divine magic in service of a higher power.",
    primary: "Wisdom",
    wealth: "5d4x10",
    text: `Clerics are intermediaries between the mortal world and the distant planes of the gods, channeling divine magic to heal, protect and smite.

Hit Dice: 1d8 per cleric level. Proficiencies: light and medium armor, shields, simple weapons. Saving throws: Wisdom, Charisma. Skills: choose two from History, Insight, Medicine, Persuasion and Religion.`,
    saves: ["wisdom", "charisma"],
    armor: [LIGHT, MEDIUM, SHIELDS],
    weapons: [SIMPLE],
    skillCount: 2,
    multiclass: { prerequisite: "Wisdom 13", requirements: "[wis:13]", proficiencies: [LIGHT, MEDIUM, SHIELDS], text: "Light armor, medium armor, shields" },
    spellcasting: { ability: "wisdom", prepare: true, listKnown: true, slots: "full", multiclassSlots: "FULL", cantrips: cantrips(3, 4, 5), prepareStat: "level:cleric" },
    features: [
      { level: 1, name: "Spellcasting", text: "As a conduit for divine power, you can cast cleric spells. You prepare a number of cleric spells equal to your Wisdom modifier + your cleric level (minimum one). You can use a holy symbol as a spellcasting focus, and cast cleric spells as rituals.", sheet: "Prepare {{cleric:spellcasting:prepare}} cleric spells." },
      {
        level: 2,
        name: "Channel Divinity",
        text: "You can channel divine energy directly from your deity to fuel magical effects: Turn Undead and an effect from your domain. You can use it once per short or long rest, twice from 6th level and three times from 18th level. Turn Undead: as an action, each undead within 30 feet that can see or hear you must make a Wisdom saving throw or be turned for 1 minute.",
        sheet: [
          { text: "Turn Undead or a domain effect.", usage: "1/Short Rest", level: 2 },
          { text: "Turn Undead or a domain effect.", usage: "2/Short Rest", level: 6 },
          { text: "Turn Undead or a domain effect.", usage: "3/Short Rest", level: 18 },
        ],
      },
      {
        level: 5,
        name: "Destroy Undead",
        text: "When an undead fails its saving throw against your Turn Undead feature, it is instantly destroyed if its challenge rating is at or below 1/2 (rising to CR 1 at 8th level, 2 at 11th, 3 at 14th and 4 at 17th).",
      },
      { level: 10, name: "Divine Intervention", text: "You can use your action to implore your deity for aid. Roll percentile dice: if you roll a number equal to or lower than your cleric level, your deity intervenes. If it does, you can’t use this feature again for 7 days; otherwise you can try again after a long rest. At 20th level your call succeeds automatically." },
    ],
    subclass: {
      level: 1,
      featureName: "Divine Domain",
      supports: "Divine Domain",
      text: "Choose one domain related to your deity. Your choice grants you domain spells and other features at 1st, 2nd, 6th, 8th and 17th level.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_LIFEDOMAIN",
          name: "Life Domain",
          text: "The Life domain focuses on the vibrant positive energy that sustains all life. Clerics of this domain are masters of healing.",
          rules: [
            ["BLESS", 1], ["CURE_WOUNDS", 1], ["LESSER_RESTORATION", 3], ["SPIRITUAL_WEAPON", 3], ["BEACON_OF_HOPE", 5],
            ["REVIVIFY", 5], ["DEATH_WARD", 7], ["GUARDIAN_OF_FAITH", 7], ["MASS_CURE_WOUNDS", 9], ["RAISE_DEAD", 9],
          ].map(([s, lv]) => alwaysPrepared(s, lv, "Cleric")),
          features: [
            { level: 1, name: "Bonus Proficiency", text: "You gain proficiency with heavy armor.", sheet: false, rules: [grant({ type: "Proficiency", id: HEAVY })] },
            { level: 1, name: "Disciple of Life", text: "Whenever you use a spell of 1st level or higher to restore hit points to a creature, it regains additional hit points equal to 2 + the spell’s level." },
            { level: 2, name: "Channel Divinity: Preserve Life", text: "As an action, you restore a number of hit points equal to five times your cleric level, divided as you choose among creatures within 30 feet. A creature can’t be restored above half its hit point maximum, and undead and constructs are unaffected.", short: "Restore {{preserve life:hp}} hit points divided among creatures within 30 feet (up to half their maximum).", action: "Action", rules: Array.from({ length: 5 }, () => stat({ name: "preserve life:hp", value: "level:cleric" })) },
            { level: 6, name: "Blessed Healer", text: "When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell’s level." },
            { level: 8, name: "Divine Strike", text: "Once on each of your turns when you hit a creature with a weapon attack, you can cause it to take an extra 1d8 radiant damage (2d8 at 14th level).", sheet: [{ text: "Once per turn, +1d8 radiant damage on a weapon hit.", level: 8 }, { text: "Once per turn, +2d8 radiant damage on a weapon hit.", level: 14 }] },
            { level: 17, name: "Supreme Healing", text: "When you would normally roll dice to restore hit points with a spell, you instead use the highest number possible for each die." },
          ],
        },
      ],
    },
  });
}

const LANDS = {
  Arctic: [["HOLD_PERSON", 3], ["SPIKE_GROWTH", 3], ["SLEET_STORM", 5], ["SLOW", 5], ["FREEDOM_OF_MOVEMENT", 7], ["ICE_STORM", 7], ["COMMUNE_WITH_NATURE", 9], ["CONE_OF_COLD", 9]],
  Coast: [["MIRROR_IMAGE", 3], ["MISTY_STEP", 3], ["WATER_BREATHING", 5], ["WATER_WALK", 5], ["CONTROL_WATER", 7], ["FREEDOM_OF_MOVEMENT", 7], ["CONJURE_ELEMENTAL", 9], ["SCRYING", 9]],
  Desert: [["BLUR", 3], ["SILENCE", 3], ["CREATE_FOOD_AND_WATER", 5], ["PROTECTION_FROM_ENERGY", 5], ["BLIGHT", 7], ["HALLUCINATORY_TERRAIN", 7], ["INSECT_PLAGUE", 9], ["WALL_OF_STONE", 9]],
  Forest: [["BARKSKIN", 3], ["SPIDER_CLIMB", 3], ["CALL_LIGHTNING", 5], ["PLANT_GROWTH", 5], ["DIVINATION", 7], ["FREEDOM_OF_MOVEMENT", 7], ["COMMUNE_WITH_NATURE", 9], ["TREE_STRIDE", 9]],
  Grassland: [["INVISIBILITY", 3], ["PASS_WITHOUT_TRACE", 3], ["DAYLIGHT", 5], ["HASTE", 5], ["DIVINATION", 7], ["FREEDOM_OF_MOVEMENT", 7], ["DREAM", 9], ["INSECT_PLAGUE", 9]],
  Mountain: [["SPIDER_CLIMB", 3], ["SPIKE_GROWTH", 3], ["LIGHTNING_BOLT", 5], ["MELD_INTO_STONE", 5], ["STONE_SHAPE", 7], ["STONESKIN", 7], ["PASSWALL", 9], ["WALL_OF_STONE", 9]],
  Swamp: [["DARKNESS", 3], ["MELFS_ACID_ARROW", 3], ["WATER_WALK", 5], ["STINKING_CLOUD", 5], ["FREEDOM_OF_MOVEMENT", 7], ["LOCATE_CREATURE", 7], ["INSECT_PLAGUE", 9], ["SCRYING", 9]],
  Underdark: [["SPIDER_CLIMB", 3], ["WEB", 3], ["GASEOUS_FORM", 5], ["STINKING_CLOUD", 5], ["GREATER_INVISIBILITY", 7], ["STONE_SHAPE", 7], ["CLOUDKILL", 9], ["INSECT_PLAGUE", 9]],
};

export function druid() {
  const landExtras = Object.entries(LANDS).map(([land, spells]) =>
    element({
      name: `Circle Spells (${land})`,
      type: "Archetype Feature",
      id: `ID_SRD_DRUID_CIRCLE_SPELLS_${land.toUpperCase()}`,
      source: SOURCE,
      supports: ["Circle of the Land Terrain"],
      text: `Your mystical connection to the ${land.toLowerCase()} infuses you with the ability to cast certain spells, which are always prepared and don’t count against the number of spells you can prepare.`,
      sheet: false,
      // These grants live under the Circle of the Land subtree, so their levels are druid levels.
      rules: spells.map(([s, lv]) => alwaysPrepared(s, lv, "Druid")),
    }),
  );
  return buildClass({
    name: "Druid",
    hd: "d8",
    short: "A priest of the Old Faith, wielding the powers of nature and adopting animal forms.",
    primary: "Wisdom",
    wealth: "2d4x10",
    text: `Druids revere nature above all, gaining their spells and other magical powers either from the force of nature itself or from a nature deity.

Hit Dice: 1d8 per druid level. Proficiencies: light and medium armor and shields (druids will not wear armor or use shields made of metal); clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears; herbalism kit. Saving throws: Intelligence, Wisdom. Skills: choose two from Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion and Survival.`,
    saves: ["intelligence", "wisdom"],
    armor: [LIGHT, MEDIUM, SHIELDS],
    weapons: ["CLUB", "DAGGER", "DART", "JAVELIN", "MACE", "QUARTERSTAFF", "SCIMITAR", "SICKLE", "SLING", "SPEAR"].map(weaponProfId),
    tools: ["ID_PROFICIENCY_TOOL_PROFICIENCY_HERBALISM_KIT"],
    skillCount: 2,
    multiclass: { prerequisite: "Wisdom 13", requirements: "[wis:13]", proficiencies: [LIGHT, MEDIUM, SHIELDS], text: "Light armor, medium armor, shields (druids will not wear armor or use shields made of metal)" },
    spellcasting: { ability: "wisdom", prepare: true, listKnown: true, slots: "full", multiclassSlots: "FULL", cantrips: cantrips(2, 3, 4), prepareStat: "level:druid" },
    features: [
      { level: 1, name: "Druidic", text: "You know Druidic, the secret language of druids. You can speak it and use it to leave hidden messages.", sheet: false, rules: [grant({ type: "Language", id: "ID_LANGUAGE_DRUIDIC" })] },
      { level: 1, name: "Spellcasting", text: "Drawing on the divine essence of nature itself, you can cast druid spells. You prepare a number of druid spells equal to your Wisdom modifier + your druid level (minimum one). You can use a druidic focus and cast druid spells as rituals.", sheet: "Prepare {{druid:spellcasting:prepare}} druid spells." },
      {
        level: 2,
        name: "Wild Shape",
        text: "As an action, you can magically assume the shape of a beast you have seen before, twice per short or long rest. Maximum CR 1/4 with no flying or swimming speed at 2nd level; CR 1/2 without flying at 4th; CR 1 at 8th. You can stay in beast form for a number of hours equal to half your druid level.",
        sheet: [
          { text: "Transform into a beast of CR 1/4 or lower (no flying or swimming speed).", usage: "2/Short Rest", action: "Action", level: 2 },
          { text: "Transform into a beast of CR 1/2 or lower (no flying speed).", usage: "2/Short Rest", action: "Action", level: 4 },
          { text: "Transform into a beast of CR 1 or lower.", usage: "2/Short Rest", action: "Action", level: 8 },
        ],
      },
      { level: 18, name: "Timeless Body", text: "The primal magic that you wield causes you to age more slowly: for every 10 years that pass, your body ages only 1 year." },
      { level: 18, name: "Beast Spells", text: "You can cast many of your druid spells in any shape you assume using Wild Shape, performing the somatic and verbal components of a spell while in beast shape." },
      { level: 20, name: "Archdruid", text: "You can use Wild Shape an unlimited number of times. You can also ignore the verbal and somatic components of your druid spells, as well as material components that lack a cost and aren’t consumed." },
    ],
    subclass: {
      level: 2,
      featureName: "Druid Circle",
      supports: "Druid Circle",
      text: "At 2nd level you choose to identify with a circle of druids.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_CIRCLEOFTHELAND",
          name: "Circle of the Land",
          text: "The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites through a vast oral tradition.",
          extras: landExtras,
          features: [
            { level: 2, name: "Bonus Cantrip", text: "You learn one additional druid cantrip of your choice.", sheet: false, rules: [select({ type: "Spell", name: "Bonus Cantrip (Circle of the Land)", supports: "Druid,0", spellcasting: "Druid" })] },
            { level: 2, name: "Natural Recovery", text: "During a short rest, you can recover expended spell slots with a combined level equal to or less than half your druid level (rounded up), none of 6th level or higher. Once per long rest.", usage: "1/Long Rest", short: "Recover spell slots totaling up to {{level:druid:half:up}} levels during a short rest." },
            { level: 3, name: "Circle Spells", text: "Choose the land where you became a druid. You gain the circle spells for that land at 3rd, 5th, 7th and 9th level; they are always prepared.", sheet: false, rules: [select({ type: "Archetype Feature", name: "Circle of the Land Terrain", supports: "Circle of the Land Terrain" })] },
            { level: 6, name: "Land’s Stride", text: "Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed or harmed. You have advantage on saves against magically created plants that impede movement." },
            { level: 10, name: "Nature’s Ward", text: "You can’t be charmed or frightened by elementals or fey, and you are immune to poison and disease.", rules: [grant({ type: "Condition", id: "ID_INTERNAL_CONDITION_DAMAGE_IMMUNITY_POISON" })] },
            { level: 14, name: "Nature’s Sanctuary", text: "When a beast or plant creature attacks you, it must make a Wisdom saving throw against your druid spell save DC. On a failure, it must choose a different target or the attack automatically misses." },
          ],
        },
      ],
    },
  });
}

const METAMAGIC = [
  ["Careful Spell", "When you cast a spell that forces other creatures to make a saving throw, you can spend 1 sorcery point to let up to your Charisma modifier creatures automatically succeed."],
  ["Distant Spell", "Spend 1 sorcery point to double the range of a spell with a range of 5 feet or more, or make a touch spell’s range 30 feet."],
  ["Empowered Spell", "When you roll damage for a spell, spend 1 sorcery point to reroll up to your Charisma modifier damage dice. You can use this even if you already used a different Metamagic option on the spell."],
  ["Extended Spell", "Spend 1 sorcery point to double the duration of a spell with a duration of 1 minute or longer, to a maximum of 24 hours."],
  ["Heightened Spell", "Spend 3 sorcery points to give one target of a spell disadvantage on its first saving throw against the spell."],
  ["Quickened Spell", "Spend 2 sorcery points to change a spell’s casting time from 1 action to 1 bonus action."],
  ["Subtle Spell", "Spend 1 sorcery point to cast a spell without any somatic or verbal components."],
  ["Twinned Spell", "When you cast a spell that targets only one creature and doesn’t have a range of self, spend sorcery points equal to the spell’s level (1 for a cantrip) to target a second creature."],
];

const DRAGONS = [
  ["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"], ["Copper", "Acid"],
  ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"], ["Silver", "Cold"], ["White", "Cold"],
];

export function sorcerer() {
  const known = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15];
  const metamagic = METAMAGIC.map(([name, text]) =>
    element({ name, type: "Class Feature", id: `ID_SRD_METAMAGIC_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`, source: SOURCE, supports: ["Metamagic"], text, sheet: text }),
  );
  const ancestors = DRAGONS.map(([color, dmg]) =>
    element({
      name: `Dragon Ancestor (${color})`,
      type: "Archetype Feature",
      id: `ID_SRD_DRAGON_ANCESTOR_${color.toUpperCase()}`,
      source: SOURCE,
      supports: ["Dragon Ancestor"],
      text: `Your draconic ancestor was a ${color.toLowerCase()} dragon, associated with ${dmg.toLowerCase()} damage.`,
      sheet: `${color} dragon ancestry (${dmg.toLowerCase()}).`,
      setters: [["damage type", dmg]],
    }),
  );
  return buildClass({
    name: "Sorcerer",
    hd: "d6",
    short: "A spellcaster who draws on inherent magic from a gift or bloodline.",
    primary: "Charisma",
    wealth: "3d4x10",
    text: `Sorcerers carry a magical birthright conferred upon them by an exotic bloodline, some otherworldly influence or exposure to unknown cosmic forces.

Hit Dice: 1d6 per sorcerer level. Proficiencies: daggers, darts, slings, quarterstaffs, light crossbows. Saving throws: Constitution, Charisma. Skills: choose two from Arcana, Deception, Insight, Intimidation, Persuasion and Religion.`,
    saves: ["constitution", "charisma"],
    weapons: ["DAGGER", "DART", "SLING", "QUARTERSTAFF", "CROSSBOW_LIGHT"].map(weaponProfId),
    skillCount: 2,
    multiclass: { prerequisite: "Charisma 13", requirements: "[cha:13]", proficiencies: [], text: "—" },
    spellcasting: { ability: "charisma", prepare: false, slots: "full", multiclassSlots: "FULL", cantrips: cantrips(4, 5, 6), known: (lv) => known[lv] },
    extras: metamagic,
    features: [
      { level: 1, name: "Spellcasting", text: "An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic. Charisma is your spellcasting ability, and you can use an arcane focus.", sheet: false },
      {
        level: 2,
        name: "Font of Magic",
        text: "You have a number of sorcery points equal to your sorcerer level, regained on a long rest. As a bonus action you can expend a spell slot to gain sorcery points equal to its level, or spend sorcery points to create a spell slot (1st: 2 points, 2nd: 3, 3rd: 5, 4th: 6, 5th: 7; no higher than 5th level).",
        sheet: [{ text: "{{level:sorcerer}} sorcery points; convert between sorcery points and spell slots as a bonus action.", usage: "Long Rest" }],
      },
      { level: 3, name: "Metamagic", key: "METAMAGIC_3", text: "You gain the ability to twist your spells to suit your needs. You learn two Metamagic options, another at 10th level and another at 17th level. Only one Metamagic option can be used on a spell when you cast it, unless otherwise noted.", sheet: false, rules: [select({ type: "Class Feature", name: "Metamagic", supports: "Metamagic", number: 2 })] },
      { level: 10, name: "Metamagic", key: "METAMAGIC_10", text: "You learn one additional Metamagic option.", sheet: false, rules: [select({ type: "Class Feature", name: "Metamagic (10)", supports: "Metamagic" })] },
      { level: 17, name: "Metamagic", key: "METAMAGIC_17", text: "You learn one additional Metamagic option.", sheet: false, rules: [select({ type: "Class Feature", name: "Metamagic (17)", supports: "Metamagic" })] },
      { level: 20, name: "Sorcerous Restoration", text: "You regain 4 expended sorcery points whenever you finish a short rest." },
    ],
    subclass: {
      level: 1,
      featureName: "Sorcerous Origin",
      supports: "Sorcerous Origin",
      text: "Choose a sorcerous origin, which describes the source of your innate magical power.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_DRACONIC_BLOODLINE",
          name: "Draconic Bloodline",
          text: "Your innate magic comes from draconic magic that was mingled with your blood or that of your ancestors.",
          extras: ancestors,
          features: [
            {
              level: 1,
              name: "Dragon Ancestor",
              text: "You choose one type of dragon as your ancestor. You can speak, read and write Draconic, and when you interact with dragons your proficiency bonus is doubled for Charisma checks.",
              sheet: false,
              rules: [select({ type: "Archetype Feature", name: "Dragon Ancestor", supports: "Dragon Ancestor" }), grant({ type: "Language", id: "ID_LANGUAGE_DRACONIC" })],
            },
            {
              level: 1,
              name: "Draconic Resilience",
              text: "Your hit point maximum increases by 1 for each sorcerer level. When you aren’t wearing armor, your AC equals 13 + your Dexterity modifier.",
              rules: [
                ...Array.from({ length: 20 }, (_, i) => stat({ name: "hp", value: 1, level: i + 1, alt: "Draconic Resilience" })),
                stat({ name: "ac:draconic", value: 13 }),
                stat({ name: "ac:draconic", value: "dexterity:modifier" }),
                stat({ name: "ac:calculation", value: "ac:draconic", bonus: "calculation", equipped: "[armor:none]", alt: "Draconic Resilience" }),
              ],
            },
            { level: 6, name: "Elemental Affinity", text: "When you cast a spell that deals damage of the type associated with your draconic ancestry, you can add your Charisma modifier to one damage roll of that spell, and spend 1 sorcery point to gain resistance to that damage type for 1 hour." },
            { level: 14, name: "Dragon Wings", text: "As a bonus action you can sprout a pair of dragon wings, gaining a flying speed equal to your current speed, until you dismiss them. You can’t do so while wearing armor not made to accommodate them." },
            { level: 18, name: "Draconic Presence", text: "As an action, spend 5 sorcery points to exude an aura of awe or fear (your choice) to 60 feet for 1 minute. Hostile creatures starting their turn in the aura must succeed on a Wisdom save or be charmed (awe) or frightened (fear) until the aura ends." },
          ],
        },
      ],
    },
  });
}

const INVOCATIONS = [
  ["Agonizing Blast", "Prerequisite: eldritch blast cantrip. When you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.", "ID_PHB_SPELL_ELDRITCH_BLAST"],
  ["Armor of Shadows", "You can cast mage armor on yourself at will, without expending a spell slot or material components."],
  ["Ascendant Step", "Prerequisite: 9th level. You can cast levitate on yourself at will, without expending a spell slot or material components.", "[level:9]"],
  ["Beast Speech", "You can cast speak with animals at will, without expending a spell slot."],
  ["Beguiling Influence", "You gain proficiency in the Deception and Persuasion skills.", null, [grant({ type: "Proficiency", id: skillId("Deception") }), grant({ type: "Proficiency", id: skillId("Persuasion") })]],
  ["Bewitching Whispers", "Prerequisite: 7th level. You can cast compulsion once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:7]"],
  ["Book of Ancient Secrets", "Prerequisite: Pact of the Tome. You can inscribe magic rituals in your Book of Shadows. Choose two 1st-level ritual spells from any class’s list; you can add others you find later.", "ID_SRD_PACT_BOON_PACT_OF_THE_TOME"],
  ["Chains of Carceri", "Prerequisite: 15th level, Pact of the Chain. You can cast hold monster at will on a celestial, fiend or elemental, without expending a spell slot.", "[level:15],ID_SRD_PACT_BOON_PACT_OF_THE_CHAIN"],
  ["Devil’s Sight", "You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet."],
  ["Dreadful Word", "Prerequisite: 7th level. You can cast confusion once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:7]"],
  ["Eldritch Sight", "You can cast detect magic at will, without expending a spell slot."],
  ["Eldritch Spear", "Prerequisite: eldritch blast cantrip. When you cast eldritch blast, its range is 300 feet.", "ID_PHB_SPELL_ELDRITCH_BLAST"],
  ["Eyes of the Rune Keeper", "You can read all writing."],
  ["Fiendish Vigor", "You can cast false life on yourself at will as a 1st-level spell, without expending a spell slot or material components."],
  ["Gaze of Two Minds", "You can use your action to touch a willing humanoid and perceive through its senses until the end of your next turn."],
  ["Lifedrinker", "Prerequisite: 12th level, Pact of the Blade. When you hit a creature with your pact weapon, it takes extra necrotic damage equal to your Charisma modifier (minimum 1).", "[level:12],ID_SRD_PACT_BOON_PACT_OF_THE_BLADE"],
  ["Mask of Many Faces", "You can cast disguise self at will, without expending a spell slot."],
  ["Master of Myriad Forms", "Prerequisite: 15th level. You can cast alter self at will, without expending a spell slot.", "[level:15]"],
  ["Minions of Chaos", "Prerequisite: 9th level. You can cast conjure elemental once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:9]"],
  ["Mire the Mind", "Prerequisite: 5th level. You can cast slow once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:5]"],
  ["Misty Visions", "You can cast silent image at will, without expending a spell slot or material components."],
  ["One with Shadows", "Prerequisite: 5th level. When you are in an area of dim light or darkness, you can use your action to become invisible until you move or take an action or a reaction.", "[level:5]"],
  ["Otherworldly Leap", "Prerequisite: 9th level. You can cast jump on yourself at will, without expending a spell slot or material components.", "[level:9]"],
  ["Repelling Blast", "Prerequisite: eldritch blast cantrip. When you hit a creature with eldritch blast, you can push it up to 10 feet away from you in a straight line.", "ID_PHB_SPELL_ELDRITCH_BLAST"],
  ["Sculptor of Flesh", "Prerequisite: 7th level. You can cast polymorph once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:7]"],
  ["Sign of Ill Omen", "Prerequisite: 5th level. You can cast bestow curse once using a warlock spell slot. You can’t do so again until you finish a long rest.", "[level:5]"],
  ["Thief of Five Fates", "You can cast bane once using a warlock spell slot. You can’t do so again until you finish a long rest."],
  ["Thirsting Blade", "Prerequisite: 5th level, Pact of the Blade. You can attack with your pact weapon twice, instead of once, whenever you take the Attack action on your turn.", "[level:5],ID_SRD_PACT_BOON_PACT_OF_THE_BLADE"],
  ["Visions of Distant Realms", "Prerequisite: 15th level. You can cast arcane eye at will, without expending a spell slot.", "[level:15]"],
  ["Voice of the Chain Master", "Prerequisite: Pact of the Chain. You can communicate telepathically with your familiar and perceive through its senses as long as you are on the same plane of existence.", "ID_SRD_PACT_BOON_PACT_OF_THE_CHAIN"],
  ["Whispers of the Grave", "Prerequisite: 9th level. You can cast speak with dead at will, without expending a spell slot.", "[level:9]"],
  ["Witch Sight", "Prerequisite: 15th level. You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic while it is within 30 feet of you and within line of sight.", "[level:15]"],
];

const PACT_BOONS = [
  ["Pact of the Chain", "You learn the find familiar spell and can cast it as a ritual. Your familiar can take the form of an imp, pseudodragon, quasit or sprite, and can attack when you forgo one of your own attacks.", [grant({ type: "Spell", id: spellId("FIND_FAMILIAR"), spellcasting: "Warlock", prepared: "true" })]],
  ["Pact of the Blade", "You can use your action to create a pact weapon in your empty hand, choosing its form each time. You are proficient with it, and it counts as magical. You can also bond with a magic weapon to make it your pact weapon.", []],
  ["Pact of the Tome", "Your patron gives you a Book of Shadows. Choose three cantrips from any class’s spell list; while the book is on your person you can cast them at will, and they count as warlock spells for you.", [select({ type: "Spell", name: "Book of Shadows Cantrips", supports: "0", number: 3, spellcasting: "Warlock" })]],
];

export function warlock() {
  const known = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
  const invocationsKnown = [0, 0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
  const invocationElements = INVOCATIONS.map(([name, text, requirements, rules]) =>
    element({
      name,
      type: "Class Feature",
      id: `ID_SRD_ELDRITCH_INVOCATION_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`,
      source: SOURCE,
      supports: ["Eldritch Invocation"],
      requirements: requirements ?? undefined,
      prerequisite: text.startsWith("Prerequisite") ? text.slice(14, text.indexOf(".")) : undefined,
      text,
      sheet: text.replace(/^Prerequisite: [^.]+\. /, ""),
      rules: rules ?? [],
    }),
  );
  const boons = PACT_BOONS.map(([name, text, rules]) =>
    element({ name, type: "Class Feature", id: `ID_SRD_PACT_BOON_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`, source: SOURCE, supports: ["Pact Boon"], text, sheet: text, rules }),
  );
  const invocationSelects = [];
  let prev = 0;
  for (let lv = 1; lv <= 20; lv++) {
    const n = invocationsKnown[lv];
    if (n > prev) invocationSelects.push(select({ type: "Class Feature", name: "Eldritch Invocations", supports: "Eldritch Invocation", number: n - prev, level: lv }));
    prev = n;
  }
  return buildClass({
    name: "Warlock",
    hd: "d8",
    short: "A wielder of magic derived from a bargain with an extraplanar entity.",
    primary: "Charisma",
    wealth: "4d4x10",
    text: `Warlocks are seekers of the knowledge that lies hidden in the fabric of the multiverse. Through pacts with mysterious beings of supernatural power, they unlock magical effects both subtle and spectacular.

Hit Dice: 1d8 per warlock level. Proficiencies: light armor, simple weapons. Saving throws: Wisdom, Charisma. Skills: choose two from Arcana, Deception, History, Intimidation, Investigation, Nature and Religion.`,
    saves: ["wisdom", "charisma"],
    armor: [LIGHT],
    weapons: [SIMPLE],
    skillCount: 2,
    multiclass: { prerequisite: "Charisma 13", requirements: "[cha:13]", proficiencies: [LIGHT, SIMPLE], text: "Light armor, simple weapons" },
    spellcasting: { ability: "charisma", prepare: false, slots: "pact", multiclassSlots: "SOLO", cantrips: cantrips(2, 3, 4), known: (lv) => known[lv] },
    extras: [...invocationElements, ...boons],
    features: [
      { level: 1, name: "Pact Magic", text: "Your arcane research and the magic bestowed on you by your patron have given you facility with spells. All your warlock spell slots are the same level and are regained on a short or long rest. Charisma is your spellcasting ability.", sheet: false },
      { level: 2, name: "Eldritch Invocations", text: "In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability. You learn two at 2nd level and more as you gain levels. When you gain a level, you can replace one invocation you know.", sheet: false, rules: invocationSelects },
      { level: 3, name: "Pact Boon", text: "Your otherworldly patron bestows a gift upon you for your loyal service.", sheet: false, rules: [select({ type: "Class Feature", name: "Pact Boon", supports: "Pact Boon" })] },
      ...[[11, 6], [13, 7], [15, 8], [17, 9]].map(([lv, spellLv]) => ({
        level: lv,
        key: `MYSTIC_ARCANUM_${spellLv}`,
        name: `Mystic Arcanum (${spellLv}th level)`,
        text: `Your patron bestows upon you a magical secret called an arcanum. Choose one ${spellLv}th-level spell from the warlock spell list. You can cast it once without expending a spell slot, and regain the ability on a long rest.`,
        usage: "1/Long Rest",
        short: `Cast your ${spellLv}th-level arcanum spell once without a slot.`,
        rules: [select({ type: "Spell", name: `Mystic Arcanum (${spellLv}th level)`, supports: `Warlock,${spellLv}`, spellcasting: "Warlock" })],
      })),
      { level: 20, name: "Eldritch Master", text: "You can spend 1 minute entreating your patron to regain all your expended spell slots from Pact Magic. Once per long rest.", usage: "1/Long Rest", short: "Spend 1 minute to regain all Pact Magic spell slots." },
    ],
    subclass: {
      level: 1,
      featureName: "Otherworldly Patron",
      supports: "Otherworldly Patron",
      text: "At 1st level you strike a bargain with an otherworldly being of your choice.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_OTHERWORLDLY_PATRON_FIEND",
          name: "The Fiend",
          text: "You have made a pact with a fiend from the lower planes of existence, a being whose aims are evil.",
          body: `\t\t<spellcasting name="Warlock" extend="true">\n\t\t\t<extend>${["BURNING_HANDS", "COMMAND", "BLINDNESS_DEAFNESS", "SCORCHING_RAY", "FIREBALL", "STINKING_CLOUD", "FIRE_SHIELD", "WALL_OF_FIRE", "FLAME_STRIKE", "HALLOW"].map(spellId).join(",")}</extend>\n\t\t</spellcasting>`,
          features: [
            { level: 1, name: "Expanded Spell List", text: "The Fiend lets you choose from an expanded list of spells when you learn a warlock spell: burning hands, command, blindness/deafness, scorching ray, fireball, stinking cloud, fire shield, wall of fire, flame strike and hallow.", sheet: false },
            { level: 1, name: "Dark One’s Blessing", text: "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum 1).", short: "Gain {{dark ones blessing:hp}} temporary hit points when you reduce a hostile creature to 0 hit points.", sheet: undefined, rules: [stat({ name: "dark ones blessing:hp", value: "charisma:modifier" }), stat({ name: "dark ones blessing:hp", value: "level:warlock" })] },
            { level: 6, name: "Dark One’s Own Luck", text: "When you make an ability check or a saving throw, you can add a d10 to your roll, after seeing the roll but before the outcome. Once per short or long rest.", usage: "1/Short Rest", short: "Add a d10 to an ability check or saving throw." },
            { level: 10, name: "Fiendish Resilience", text: "Choose one damage type when you finish a short or long rest. You gain resistance to that damage type until you choose a different one. Damage from magical weapons or silver weapons ignores this resistance." },
            { level: 14, name: "Hurl Through Hell", text: "When you hit a creature with an attack, you can instantly transport it through the lower planes. It disappears and hurtles through a nightmare landscape, returning at the end of your next turn and taking 10d10 psychic damage if it isn’t a fiend. Once per long rest.", usage: "1/Long Rest", short: "On a hit, banish the target through the lower planes until the end of your next turn (10d10 psychic damage)." },
          ],
        },
      ],
    },
  });
}

export function wizard() {
  return buildClass({
    name: "Wizard",
    hd: "d6",
    short: "A scholarly magic-user capable of manipulating the structures of reality.",
    primary: "Intelligence",
    wealth: "4d4x10",
    text: `Wizards are supreme magic-users, defined and united as a class by the spells they cast, drawn from a spellbook of arcane formulas.

Hit Dice: 1d6 per wizard level. Proficiencies: daggers, darts, slings, quarterstaffs, light crossbows. Saving throws: Intelligence, Wisdom. Skills: choose two from Arcana, History, Insight, Investigation, Medicine and Religion.`,
    saves: ["intelligence", "wisdom"],
    weapons: ["DAGGER", "DART", "SLING", "QUARTERSTAFF", "CROSSBOW_LIGHT"].map(weaponProfId),
    skillCount: 2,
    multiclass: { prerequisite: "Intelligence 13", requirements: "[int:13]", proficiencies: [], text: "—" },
    spellcasting: { ability: "intelligence", prepare: true, slots: "full", multiclassSlots: "FULL", cantrips: cantrips(3, 4, 5), spellbook: true, prepareStat: "level:wizard" },
    features: [
      { level: 1, name: "Spellcasting", text: "As a student of arcane magic, you have a spellbook containing spells. You prepare a number of wizard spells from your spellbook equal to your Intelligence modifier + your wizard level (minimum one). You can cast wizard spells as rituals if they are in your spellbook, and use an arcane focus.", sheet: "Prepare {{wizard:spellcasting:prepare}} spells from your spellbook." },
      { level: 1, name: "Arcane Recovery", text: "Once per day when you finish a short rest, you can recover expended spell slots with a combined level equal to or less than half your wizard level (rounded up), none of 6th level or higher.", usage: "1/Long Rest", short: "Recover spell slots totaling up to {{level:wizard:half:up}} levels during a short rest." },
      {
        level: 18,
        name: "Spell Mastery",
        text: "Choose a 1st-level and a 2nd-level wizard spell in your spellbook. You can cast them at their lowest level without expending a spell slot when you have them prepared.",
        rules: [
          select({ type: "Spell", name: "Spell Mastery (1st level)", supports: "Wizard,1", spellcasting: "Wizard", prepared: "true" }),
          select({ type: "Spell", name: "Spell Mastery (2nd level)", supports: "Wizard,2", spellcasting: "Wizard", prepared: "true" }),
        ],
      },
      {
        level: 20,
        name: "Signature Spells",
        text: "Choose two 3rd-level wizard spells in your spellbook as your signature spells. You always have them prepared, they don’t count against your prepared spells, and you can cast each once at 3rd level without a spell slot per short or long rest.",
        rules: [select({ type: "Spell", name: "Signature Spells", supports: "Wizard,3", number: 2, spellcasting: "Wizard", prepared: "true" })],
      },
    ],
    subclass: {
      level: 2,
      featureName: "Arcane Tradition",
      supports: "Arcane Tradition",
      text: "At 2nd level you choose an arcane tradition, shaping your practice of magic.",
      archetypes: [
        {
          id: "ID_WOTC_PHB_ARCHETYPE_WIZARD_SCHOOL_OF_EVOCATION",
          name: "School of Evocation",
          text: "You focus your study on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, crackling lightning and burning acid.",
          features: [
            { level: 2, name: "Evocation Savant", text: "The gold and time you must spend to copy an evocation spell into your spellbook is halved." },
            { level: 2, name: "Sculpt Spells", text: "When you cast an evocation spell that affects other creatures you can see, you can choose a number of them equal to 1 + the spell’s level. They automatically succeed on their saving throws and take no damage if they would normally take half damage on a success." },
            { level: 6, name: "Potent Cantrip", text: "Your damaging cantrips affect even creatures that avoid the brunt of the effect: when a creature succeeds on a saving throw against your cantrip, it takes half the cantrip’s damage (if any) but suffers no additional effect." },
            { level: 10, name: "Empowered Evocation", text: "You can add your Intelligence modifier to one damage roll of any wizard evocation spell you cast." },
            { level: 14, name: "Overchannel", text: "When you cast a wizard spell of 1st through 5th level that deals damage, you can deal maximum damage with that spell. The first time you do so you suffer no adverse effect; each further use before a long rest deals you 2d12 necrotic damage per spell level (increasing by 1d12 per use) that ignores resistance and immunity." },
          ],
        },
      ],
    },
  });
}

/** SRD armor, weapons, tools and adventuring gear. */
import { element, grant, idPart, stat } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";
import { armorProfId, gamingSetProfId, toolProfId, weaponProfId } from "./basics.mjs";

// name, idSuffix, kind, AC, cost gp, weight lb, str requirement, stealth disadvantage
const ARMOR = [
  ["Padded", "LIGHT_PADDED", "Light", 11, 5, 8, 0, true, "PADDED"],
  ["Leather", "LIGHT_LEATHER", "Light", 11, 10, 10, 0, false, "LEATHER"],
  ["Studded Leather", "LIGHT_STUDDED_LEATHER", "Light", 12, 45, 13, 0, false, "STUDDED_LEATHER"],
  ["Hide", "MEDIUM_HIDE_ARMOR", "Medium", 12, 10, 12, 0, false, "HIDE"],
  ["Chain Shirt", "MEDIUM_CHAIN_SHIRT", "Medium", 13, 50, 20, 0, false, "CHAIN_SHIRT"],
  ["Scale Mail", "MEDIUM_SCALE_MAIL", "Medium", 14, 50, 45, 0, true, "SCALE_MAIL"],
  ["Breastplate", "MEDIUM_BREASTPLATE", "Medium", 14, 400, 20, 0, false, "BREASTPLATE"],
  ["Half Plate", "MEDIUM_HALF_PLATE", "Medium", 15, 750, 40, 0, true, "HALF_PLATE"],
  ["Ring Mail", "HEAVY_RING_MAIL", "Heavy", 14, 30, 40, 0, true, "RING_MAIL"],
  ["Chain Mail", "HEAVY_CHAIN_MAIL", "Heavy", 16, 75, 55, 13, true, "CHAIN_MAIL"],
  ["Splint", "HEAVY_SPLINT", "Heavy", 17, 200, 60, 15, true, "SPLINT"],
  ["Plate", "HEAVY_PLATE", "Heavy", 18, 1500, 65, 15, true, "PLATE"],
];

function armor() {
  const out = ARMOR.map(([name, idSuffix, kind, ac, cost, weight, str, stealth, prof]) => {
    const dex = kind === "Light" ? " + Dex modifier" : kind === "Medium" ? " + Dex modifier (max 2)" : "";
    const rules = [stat({ name: "ac:armored:armor", value: ac })];
    if (stealth) rules.unshift(grant({ type: "Grants", id: "ID_INTERNAL_GRANTS_STEALTH_DISADVANTAGE" }));
    if (str) rules.push(stat({ name: "speed", value: -10, bonus: "armor", requirements: `!([str:${str}]||ID_INTERNAL_GRANT_ARMOR_IGNORE_STRENGTH_REQUIREMENT)` }));
    return element({
      name,
      type: "Armor",
      id: `ID_WOTC_ARMOR_${idSuffix}`,
      source: SOURCE,
      supports: [`ID_INTERNAL_ARMOR_GROUP_${kind.toUpperCase()}`, `${kind} Armor`],
      text: `${kind} armor. AC ${ac}${dex}.${str ? ` Requires Strength ${str}; otherwise your speed is reduced by 10 feet.` : ""}${stealth ? " Disadvantage on Dexterity (Stealth) checks." : ""}`,
      setters: [
        ["category", "Armor"],
        ["cost", cost, { currency: "gp" }],
        ["weight", `${weight} lb.`, { lb: weight }],
        ["armor", kind],
        ["armorClass", `${ac}${dex}`],
        ...(str ? [["strength", str]] : []),
        ...(stealth ? [["stealth", "Disadvantage"]] : []),
        ["proficiency", armorProfId(prof)],
      ],
      rules,
    });
  });
  out.push(
    element({
      name: "Shield",
      type: "Armor",
      id: "ID_WOTC_GEAR_SHIELD",
      source: SOURCE,
      supports: ["ID_INTERNAL_ARMOR_GROUP_SHIELD", "Shield"],
      text: "A shield is carried in one hand. Wielding a shield increases your Armor Class by 2. You can benefit from only one shield at a time.",
      setters: [
        ["category", "Armor"],
        ["cost", 10, { currency: "gp" }],
        ["weight", "6 lb.", { lb: 6 }],
        ["armor", "Shield"],
        ["armorClass", "+2"],
        ["proficiency", armorProfId("SHIELD")],
      ],
      rules: [stat({ name: "ac:shield", value: 2, bonus: "shield", alt: "Shield" })],
    }),
  );
  return out;
}

// name, id part, category, cost, damage, damage type, weight, properties, extra
const WEAPONS = [
  ["Club", "CLUB", "Simple Melee", "1 sp", "1d4", "bludgeoning", 2, ["Light"]],
  ["Dagger", "DAGGER", "Simple Melee", "2 gp", "1d4", "piercing", 1, ["Finesse", "Light", "Thrown (range 20/60)"]],
  ["Greatclub", "GREATCLUB", "Simple Melee", "2 sp", "1d8", "bludgeoning", 10, ["Two-handed"]],
  ["Handaxe", "HANDAXE", "Simple Melee", "5 gp", "1d6", "slashing", 2, ["Light", "Thrown (range 20/60)"]],
  ["Javelin", "JAVELIN", "Simple Melee", "5 sp", "1d6", "piercing", 2, ["Thrown (range 30/120)"]],
  ["Light Hammer", "LIGHTHAMMER", "Simple Melee", "2 gp", "1d4", "bludgeoning", 2, ["Light", "Thrown (range 20/60)"], "LIGHT_HAMMER"],
  ["Mace", "MACE", "Simple Melee", "5 gp", "1d6", "bludgeoning", 4, []],
  ["Quarterstaff", "QUARTERSTAFF", "Simple Melee", "2 sp", "1d6", "bludgeoning", 4, ["Versatile (1d8)"]],
  ["Sickle", "SICKLE", "Simple Melee", "1 gp", "1d4", "slashing", 2, ["Light"]],
  ["Spear", "SPEAR", "Simple Melee", "1 gp", "1d6", "piercing", 3, ["Thrown (range 20/60)", "Versatile (1d8)"]],
  ["Light Crossbow", "CROSSBOW_LIGHT", "Simple Ranged", "25 gp", "1d8", "piercing", 5, ["Ammunition (range 80/320)", "Loading", "Two-handed"]],
  ["Dart", "DART", "Simple Ranged", "5 cp", "1d4", "piercing", 0.25, ["Finesse", "Thrown (range 20/60)"]],
  ["Shortbow", "SHORTBOW", "Simple Ranged", "25 gp", "1d6", "piercing", 2, ["Ammunition (range 80/320)", "Two-handed"]],
  ["Sling", "SLING", "Simple Ranged", "1 sp", "1d4", "bludgeoning", 0, ["Ammunition (range 30/120)"]],
  ["Battleaxe", "BATTLEAXE", "Martial Melee", "10 gp", "1d8", "slashing", 4, ["Versatile (1d10)"]],
  ["Flail", "FLAIL", "Martial Melee", "10 gp", "1d8", "bludgeoning", 2, []],
  ["Glaive", "GLAIVE", "Martial Melee", "20 gp", "1d10", "slashing", 6, ["Heavy", "Reach", "Two-handed"]],
  ["Greataxe", "GREATAXE", "Martial Melee", "30 gp", "1d12", "slashing", 7, ["Heavy", "Two-handed"]],
  ["Greatsword", "GREATSWORD", "Martial Melee", "50 gp", "2d6", "slashing", 6, ["Heavy", "Two-handed"]],
  ["Halberd", "HALBERD", "Martial Melee", "20 gp", "1d10", "slashing", 6, ["Heavy", "Reach", "Two-handed"]],
  ["Lance", "LANCE", "Martial Melee", "10 gp", "1d12", "piercing", 6, ["Reach", "Special"]],
  ["Longsword", "LONGSWORD", "Martial Melee", "15 gp", "1d8", "slashing", 3, ["Versatile (1d10)"]],
  ["Maul", "MAUL", "Martial Melee", "10 gp", "2d6", "bludgeoning", 10, ["Heavy", "Two-handed"]],
  ["Morningstar", "MORNINGSTAR", "Martial Melee", "15 gp", "1d8", "piercing", 4, []],
  ["Pike", "PIKE", "Martial Melee", "5 gp", "1d10", "piercing", 18, ["Heavy", "Reach", "Two-handed"]],
  ["Rapier", "RAPIER", "Martial Melee", "25 gp", "1d8", "piercing", 2, ["Finesse"]],
  ["Scimitar", "SCIMITAR", "Martial Melee", "25 gp", "1d6", "slashing", 3, ["Finesse", "Light"]],
  ["Shortsword", "SHORTSWORD", "Martial Melee", "10 gp", "1d6", "piercing", 2, ["Finesse", "Light"]],
  ["Trident", "TRIDENT", "Martial Melee", "5 gp", "1d6", "piercing", 4, ["Thrown (range 20/60)", "Versatile (1d8)"]],
  ["War Pick", "WAR_PICK", "Martial Melee", "5 gp", "1d8", "piercing", 2, []],
  ["Warhammer", "WARHAMMER", "Martial Melee", "15 gp", "1d8", "bludgeoning", 2, ["Versatile (1d10)"]],
  ["Whip", "WHIP", "Martial Melee", "2 gp", "1d4", "slashing", 3, ["Finesse", "Reach"]],
  ["Blowgun", "BLOWGUN", "Martial Ranged", "10 gp", "1", "piercing", 1, ["Ammunition (range 25/100)", "Loading"]],
  ["Hand Crossbow", "CROSSBOW_HAND", "Martial Ranged", "75 gp", "1d6", "piercing", 3, ["Ammunition (range 30/120)", "Light", "Loading"]],
  ["Heavy Crossbow", "CROSSBOW_HEAVY", "Martial Ranged", "50 gp", "1d10", "piercing", 18, ["Ammunition (range 100/400)", "Heavy", "Loading", "Two-handed"]],
  ["Longbow", "LONGBOW", "Martial Ranged", "50 gp", "1d8", "piercing", 2, ["Ammunition (range 150/600)", "Heavy", "Two-handed"]],
  ["Net", "NET", "Martial Ranged", "1 gp", "—", "", 3, ["Special", "Thrown (range 5/15)"]],
];

function weapons() {
  return WEAPONS.map(([name, part, category, cost, damage, type, weight, props, profPart]) => {
    const [costValue, currency] = cost.split(" ");
    const versatile = props.find((p) => p.startsWith("Versatile"))?.match(/\((.*)\)/)?.[1];
    const range = props.find((p) => p.includes("range"))?.match(/range ([\d/]+)/)?.[1];
    const propertyIds = props.map((p) => `ID_INTERNAL_WEAPON_PROPERTY_${p.replace(/\s*\(.*\)/, "").toUpperCase().replace(/[^A-Z]+/g, "")}`);
    return element({
      name,
      type: "Weapon",
      id: `ID_WOTC_PHB_WEAPON_${part}`,
      source: SOURCE,
      supports: [
        `ID_INTERNAL_WEAPON_CATEGORY_${category.toUpperCase().replace(" ", "_")}`,
        category,
        type ? `ID_INTERNAL_DAMAGE_TYPE_${type.toUpperCase()}` : undefined,
        ...propertyIds,
      ].filter(Boolean),
      text: `${category} weapon. Damage ${damage}${type ? ` ${type}` : ""}.${props.length ? ` Properties: ${props.join(", ")}.` : ""}`,
      setters: [
        ["category", "Weapons"],
        ["cost", costValue, { currency }],
        ["weight", weight ? `${weight} lb.` : "—", { lb: weight }],
        ["damage", damage, type ? { type } : {}],
        ...(versatile ? [["versatile", versatile]] : []),
        ...(range ? [["range", range]] : []),
        ["properties", props.join(", ")],
        ["proficiency", weaponProfId(profPart ?? part)],
      ],
    });
  });
}

// name, cost, weight, description
const GEAR = [
  ["Abacus", "2 gp", 2, ""],
  ["Acid (vial)", "25 gp", 1, "As an action, you can splash the contents onto a creature within 5 feet or throw it up to 20 feet. On a hit, the target takes 2d6 acid damage."],
  ["Alchemist’s Fire (flask)", "50 gp", 1, "As an action, you can throw this flask up to 20 feet. On a hit, the target takes 1d4 fire damage at the start of each of its turns until it uses an action to put out the flames (DC 10 Dexterity check)."],
  ["Arrows (20)", "1 gp", 1, "Ammunition for bows."],
  ["Blowgun Needles (50)", "1 gp", 1, "Ammunition for blowguns."],
  ["Crossbow Bolts (20)", "1 gp", 1.5, "Ammunition for crossbows."],
  ["Sling Bullets (20)", "4 cp", 1.5, "Ammunition for slings."],
  ["Antitoxin (vial)", "50 gp", 0, "A creature that drinks this vial gains advantage on saving throws against poison for 1 hour."],
  ["Arcane Focus (Crystal)", "10 gp", 1, "An arcane focus can be used as a spellcasting focus by sorcerers, warlocks and wizards."],
  ["Arcane Focus (Orb)", "20 gp", 3, "An arcane focus can be used as a spellcasting focus by sorcerers, warlocks and wizards."],
  ["Arcane Focus (Rod)", "10 gp", 2, "An arcane focus can be used as a spellcasting focus by sorcerers, warlocks and wizards."],
  ["Arcane Focus (Staff)", "5 gp", 4, "An arcane focus can be used as a spellcasting focus by sorcerers, warlocks and wizards."],
  ["Arcane Focus (Wand)", "10 gp", 1, "An arcane focus can be used as a spellcasting focus by sorcerers, warlocks and wizards."],
  ["Backpack", "2 gp", 5, "Holds 1 cubic foot or 30 pounds of gear."],
  ["Ball Bearings (bag of 1,000)", "1 gp", 2, "As an action, you can cover a 10-foot square with these. A creature moving across it must succeed on a DC 10 Dexterity saving throw or fall prone."],
  ["Bedroll", "1 gp", 7, ""],
  ["Bell", "1 gp", 0, ""],
  ["Blanket", "5 sp", 3, ""],
  ["Book", "25 gp", 5, ""],
  ["Caltrops (bag of 20)", "1 gp", 2, "As an action, you can cover a 5-foot square. A creature entering it must succeed on a DC 15 Dexterity saving throw or take 1 piercing damage and have its speed reduced by 10 feet until it regains a hit point."],
  ["Candle", "1 cp", 0, "For 1 hour, a candle sheds bright light in a 5-foot radius and dim light for an additional 5 feet."],
  ["Chain (10 feet)", "5 gp", 10, ""],
  ["Climber’s Kit", "25 gp", 12, "Includes special pitons, boot tips, gloves and a harness. As an action, you can anchor yourself so you can’t fall more than 25 feet from that point."],
  ["Clothes, Common", "5 sp", 3, ""],
  ["Clothes, Costume", "5 gp", 4, ""],
  ["Clothes, Fine", "15 gp", 6, ""],
  ["Clothes, Traveler’s", "2 gp", 4, ""],
  ["Component Pouch", "25 gp", 2, "A small, watertight leather belt pouch with compartments holding the material components and other special items you need to cast your spells."],
  ["Crowbar", "2 gp", 5, "Using a crowbar grants advantage to Strength checks where its leverage can be applied."],
  ["Druidic Focus (Sprig of Mistletoe)", "1 gp", 0, "A druid can use this as a spellcasting focus."],
  ["Druidic Focus (Wooden Staff)", "5 gp", 4, "A druid can use this as a spellcasting focus."],
  ["Druidic Focus (Yew Wand)", "10 gp", 1, "A druid can use this as a spellcasting focus."],
  ["Grappling Hook", "2 gp", 4, ""],
  ["Healer’s Kit", "5 gp", 3, "This kit has ten uses. As an action, you can expend one use to stabilize a creature that has 0 hit points, without needing a Wisdom (Medicine) check."],
  ["Holy Symbol (Amulet)", "5 gp", 1, "A cleric or paladin can use a holy symbol as a spellcasting focus."],
  ["Holy Symbol (Emblem)", "5 gp", 0, "A cleric or paladin can use a holy symbol as a spellcasting focus."],
  ["Holy Symbol (Reliquary)", "5 gp", 2, "A cleric or paladin can use a holy symbol as a spellcasting focus."],
  ["Holy Water (flask)", "25 gp", 1, "As an action, you can splash the contents onto a creature within 5 feet or throw it up to 20 feet. If the target is a fiend or undead, it takes 2d6 radiant damage."],
  ["Hunting Trap", "5 gp", 25, "When you use your action to set it, this trap forms a saw-toothed steel ring. A creature stepping on it must succeed on a DC 13 Dexterity saving throw or take 1d4 piercing damage and stop moving."],
  ["Ink (1 ounce bottle)", "10 gp", 0, ""],
  ["Ink Pen", "2 cp", 0, ""],
  ["Lamp", "5 sp", 1, "A lamp casts bright light in a 15-foot radius and dim light for an additional 30 feet. It burns for 6 hours on a flask of oil."],
  ["Lantern, Hooded", "5 gp", 2, "Casts bright light in a 30-foot radius and dim light for an additional 30 feet. It burns for 6 hours on a flask of oil."],
  ["Lock", "10 gp", 1, "A key is provided. Without the key, a creature proficient with thieves’ tools can pick this lock with a successful DC 15 Dexterity check."],
  ["Magnifying Glass", "100 gp", 0, ""],
  ["Manacles", "2 gp", 6, ""],
  ["Mirror, Steel", "5 gp", 0.5, ""],
  ["Oil (flask)", "1 sp", 1, ""],
  ["Paper (one sheet)", "2 sp", 0, ""],
  ["Parchment (one sheet)", "1 sp", 0, ""],
  ["Potion of Healing", "50 gp", 0.5, "A character who drinks the magical red fluid in this vial regains 2d4 + 2 hit points."],
  ["Pouch", "5 sp", 1, ""],
  ["Rations (1 day)", "5 sp", 2, ""],
  ["Rope, Hempen (50 feet)", "1 gp", 10, ""],
  ["Rope, Silk (50 feet)", "10 gp", 5, ""],
  ["Sack", "1 cp", 0.5, ""],
  ["Shovel", "2 gp", 5, ""],
  ["Spellbook", "50 gp", 3, "Essential for wizards, a spellbook is a leather-bound tome with 100 blank vellum pages suitable for recording spells."],
  ["Tent, Two-Person", "2 gp", 20, ""],
  ["Tinderbox", "5 sp", 1, ""],
  ["Torch", "1 cp", 1, "A torch burns for 1 hour, providing bright light in a 20-foot radius and dim light for an additional 20 feet."],
  ["Waterskin", "2 sp", 5, ""],
  ["Whetstone", "1 cp", 1, ""],
];

const PACKS = [
  ["Burglar’s Pack", "16 gp", "A backpack, a bag of 1,000 ball bearings, 10 feet of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days rations, a tinderbox and a waterskin, plus 50 feet of hempen rope."],
  ["Diplomat’s Pack", "39 gp", "A chest, 2 cases for maps and scrolls, a set of fine clothes, a bottle of ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, a vial of perfume, sealing wax and soap."],
  ["Dungeoneer’s Pack", "12 gp", "A backpack, a crowbar, a hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations and a waterskin, plus 50 feet of hempen rope."],
  ["Entertainer’s Pack", "40 gp", "A backpack, a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin and a disguise kit."],
  ["Explorer’s Pack", "10 gp", "A backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations and a waterskin, plus 50 feet of hempen rope."],
  ["Priest’s Pack", "19 gp", "A backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations and a waterskin."],
  ["Scholar’s Pack", "40 gp", "A backpack, a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a little bag of sand and a small knife."],
];

function gear() {
  const out = GEAR.map(([name, cost, weight, desc]) => {
    const [v, cur] = cost.split(" ");
    return element({
      name,
      type: "Item",
      id: `ID_SRD_ITEM_${idPart(name)}`,
      source: SOURCE,
      supports: ["Adventuring Gear"],
      text: desc || undefined,
      setters: [["category", "Adventuring Gear"], ["cost", v, { currency: cur }], ["weight", weight ? `${weight} lb.` : "—", { lb: weight }]],
    });
  });
  for (const [name, cost, contents] of PACKS) {
    const [v, cur] = cost.split(" ");
    out.push(
      element({
        name,
        type: "Item",
        id: `ID_SRD_ITEM_${idPart(name)}`,
        source: SOURCE,
        supports: ["Equipment Pack"],
        text: `Includes ${contents.charAt(0).toLowerCase()}${contents.slice(1)}`,
        setters: [["category", "Equipment Packs"], ["cost", v, { currency: cur }]],
      }),
    );
  }
  return out;
}

const TOOL_ITEMS = [
  ["Alchemist’s Supplies", "50 gp", 8, "ALCHEMISTS_SUPPLIES"],
  ["Brewer’s Supplies", "20 gp", 9, "BREWERS_SUPPLIES"],
  ["Calligrapher’s Supplies", "10 gp", 5, "CALLIGRAPHERS_SUPPLIES"],
  ["Carpenter’s Tools", "8 gp", 6, "CARPENTERS_TOOLS"],
  ["Cartographer’s Tools", "15 gp", 6, "CARTOGRAPHERS_TOOLS"],
  ["Cobbler’s Tools", "5 gp", 5, "COBBLERS_TOOLS"],
  ["Cook’s Utensils", "1 gp", 8, "COOKS_UTENSILS"],
  ["Glassblower’s Tools", "30 gp", 5, "GLASSBLOWERS_TOOLS"],
  ["Jeweler’s Tools", "25 gp", 2, "JEWELERS_TOOLS"],
  ["Leatherworker’s Tools", "5 gp", 5, "LEATHERWORKERS_TOOLS"],
  ["Mason’s Tools", "10 gp", 8, "MASONS_TOOLS"],
  ["Painter’s Supplies", "10 gp", 5, "PAINTERS_SUPPLIES"],
  ["Potter’s Tools", "10 gp", 3, "POTTERS_TOOLS"],
  ["Smith’s Tools", "20 gp", 8, "SMITHS_TOOLS"],
  ["Tinker’s Tools", "50 gp", 10, "TINKERS_TOOLS"],
  ["Weaver’s Tools", "1 gp", 5, "WEAVERS_TOOLS"],
  ["Woodcarver’s Tools", "1 gp", 5, "WOODCARVERS_TOOLS"],
  ["Disguise Kit", "25 gp", 3, "DISGUISE_KIT"],
  ["Forgery Kit", "15 gp", 5, "FORGERY_KIT"],
  ["Herbalism Kit", "5 gp", 3, "HERBALISM_KIT"],
  ["Navigator’s Tools", "25 gp", 2, "NAVIGATORS_TOOLS"],
  ["Poisoner’s Kit", "50 gp", 2, "POISONERS_KIT"],
  ["Thieves’ Tools", "25 gp", 1, "THIEVES_TOOLS"],
  ["Bagpipes", "30 gp", 6, "BAGPIPES"],
  ["Drum", "6 gp", 3, "DRUM"],
  ["Dulcimer", "25 gp", 10, "DULCIMER"],
  ["Flute", "2 gp", 1, "FLUTE"],
  ["Lute", "35 gp", 2, "LUTE"],
  ["Lyre", "30 gp", 2, "LYRE"],
  ["Horn", "3 gp", 2, "HORN"],
  ["Pan Flute", "12 gp", 2, "PAN_FLUTE"],
  ["Shawm", "2 gp", 1, "SHAWM"],
  ["Viol", "30 gp", 1, "VIOL"],
];

function tools() {
  const out = TOOL_ITEMS.map(([name, cost, weight, prof]) => {
    const [v, cur] = cost.split(" ");
    return element({
      name,
      type: "Item",
      id: `ID_SRD_ITEM_${idPart(name)}`,
      source: SOURCE,
      supports: ["Tools"],
      text: "Proficiency with these tools lets you add your proficiency bonus to ability checks you make using them.",
      setters: [["category", "Tools"], ["cost", v, { currency: cur }], ["weight", `${weight} lb.`, { lb: weight }], ["proficiency", toolProfId(prof)]],
    });
  });
  for (const [name, cost, prof] of [["Dice Set", "1 sp", "DICE_SET"], ["Playing Card Set", "5 sp", "PLAYING_CARD_SET"]]) {
    const [v, cur] = cost.split(" ");
    out.push(element({ name, type: "Item", id: `ID_SRD_ITEM_${idPart(name)}`, source: SOURCE, supports: ["Tools", "Gaming Set"], setters: [["category", "Tools"], ["cost", v, { currency: cur }], ["proficiency", gamingSetProfId(prof)]] }));
  }
  return out;
}

export function equipment() {
  return [...armor(), ...weapons(), ...gear(), ...tools()];
}

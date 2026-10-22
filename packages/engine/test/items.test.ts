import { beforeAll, describe, expect, it } from "vitest";
import {
  baseItemCandidates,
  buildSheet,
  ContentRegistry,
  equipItem,
  equipSlots,
  itemElement,
  newCharacter,
  resolveCharacter,
  selectionKey,
  type CharacterState,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

// Generic magic items written the way Aurora's DMG files write them.
const MAGIC = `<elements>
  <element name="Weapon, +1" type="Magic Item" source="Test" id="ID_TEST_WEAPON_1">
    <description><p>+1 to attack and damage rolls.</p></description>
    <setters>
      <set name="category">Magic Weapons</set>
      <set name="type" addition="Any Simple or Martial">Weapon</set>
      <set name="weapon">ID_INTERNAL_WEAPON_CATEGORY_SIMPLE_MELEE||ID_INTERNAL_WEAPON_CATEGORY_SIMPLE_RANGED||ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_MELEE||ID_INTERNAL_WEAPON_CATEGORY_MARTIAL_RANGED</set>
      <set name="rarity">Uncommon</set>
      <set name="enhancement">1</set>
      <set name="name-format">+{{enhancement}} {{parent}}</set>
    </setters>
  </element>
  <element name="Shield (+1)" type="Magic Item" source="Test" id="ID_TEST_SHIELD_1">
    <description><p>+1 AC on top of the shield's.</p></description>
    <setters>
      <set name="category">Magic Armor</set>
      <set name="type" addition="Shield">Armor</set>
      <set name="armor">ID_INTERNAL_ARMOR_GROUP_SHIELD</set>
      <set name="rarity">Uncommon</set>
      <set name="enhancement">1</set>
      <set name="name-format">{{parent}} +{{enhancement}}</set>
    </setters>
    <rules><stat name="ac:shield" value="1" bonus="enhancement" /></rules>
  </element>
</elements>`;

const SWORD = "ID_WOTC_PHB_WEAPON_LONGSWORD";
const SHORTSWORD = "ID_WOTC_PHB_WEAPON_SHORTSWORD";
const GREATSWORD = "ID_WOTC_PHB_WEAPON_GREATSWORD";
const SHIELD = "ID_WOTC_GEAR_SHIELD";

describe("generic magic items", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = new ContentRegistry();
    loadDirs(registry, coreDir, srdDir);
    registry.addXml(MAGIC, "test.xml");
    registry.finalize();
  });

  function fighter(inventory: CharacterState["inventory"]) {
    const s = newCharacter();
    s.abilities = { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 };
    s.levels = ["ID_WOTC_PHB_CLASS_FIGHTER"];
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
    s.inventory = inventory;
    return buildSheet(resolveCharacter(registry, s));
  }

  it("goes in the off hand when it is a shield, and in a hand when it is a weapon", () => {
    expect(equipSlots(registry.get("ID_TEST_SHIELD_1"))).toEqual(["offhand"]);
    expect(equipSlots(registry.get("ID_TEST_WEAPON_1"))).toEqual(["main", "offhand"]);
  });

  it("offers the base items that fit", () => {
    const weapons = baseItemCandidates(registry, registry.get("ID_TEST_WEAPON_1")!).map((e) => e.id);
    expect(weapons).toContain(SWORD);
    expect(weapons).not.toContain(SHIELD);
    expect(baseItemCandidates(registry, registry.get("ID_TEST_SHIELD_1")!).map((e) => e.id)).toEqual([SHIELD]);
  });

  it("becomes its base item with the magic on top", () => {
    const sword = itemElement(registry, { id: "ID_TEST_WEAPON_1", base: SWORD })!;
    expect(sword).toMatchObject({ name: "+1 Longsword", type: "Weapon" });
    expect(itemElement(registry, { id: "ID_TEST_SHIELD_1", base: SHIELD })!.name).toBe("Shield +1");

    const sheet = fighter([
      { uid: "a", id: "ID_TEST_WEAPON_1", base: SWORD, quantity: 1, equipped: "main" },
      { uid: "b", id: "ID_TEST_SHIELD_1", base: SHIELD, quantity: 1, equipped: "offhand" },
    ]);
    // STR 16 +3, proficiency +2, magic +1.
    expect(sheet.attacks[0]).toMatchObject({ name: "+1 Longsword", attack: 6, damage: "1d8+4", proficient: true });
    const unarmored = fighter([]).armorClass;
    expect(sheet.armorClass).toBe(unarmored + 3);
  });

  it("lets two one-handed weapons be wielded together", () => {
    const inv: CharacterState["inventory"] = [
      { uid: "sword", id: SWORD, quantity: 1, equipped: "main" },
      { uid: "magic", id: "ID_TEST_WEAPON_1", base: SHORTSWORD, quantity: 1 },
    ];
    equipItem(registry, inv, "magic", "main");
    expect(inv.map((i) => i.equipped)).toEqual(["offhand", "main"]);
    // The off hand is taken: the main-hand weapon is swapped out.
    equipItem(registry, inv, "sword", "main");
    expect(inv.map((i) => i.equipped)).toEqual(["main", "offhand"]);
  });

  it("keeps a two-handed weapon and the off hand apart", () => {
    const inv: CharacterState["inventory"] = [
      { uid: "shield", id: "ID_TEST_SHIELD_1", base: SHIELD, quantity: 1, equipped: "offhand" },
      { uid: "great", id: GREATSWORD, quantity: 1 },
    ];
    equipItem(registry, inv, "great", "main");
    expect(inv.map((i) => i.equipped)).toEqual([undefined, "main"]);
    equipItem(registry, inv, "shield", "offhand");
    expect(inv.map((i) => i.equipped)).toEqual(["offhand", undefined]);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionKey, type CharacterState } from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const FIGHTER = "ID_WOTC_PHB_CLASS_FIGHTER";

describe("weapon attacks", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
  });

  /** Level 1 human fighter, STR 16 DEX 14 before the human +1 (so STR +3, DEX +2), with a fighting style. */
  function fighter(style: string, inventory: CharacterState["inventory"]) {
    const s = newCharacter();
    s.abilities = { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 };
    s.levels = [FIGHTER];
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
    s.inventory = inventory;
    let rc = resolveCharacter(registry, s);
    const point = rc.selections.find((p) => p.rule.name === "Fighting Style (Fighter)")!;
    s.selections[point.key] = [style];
    rc = resolveCharacter(registry, s);
    return buildSheet(rc).attacks;
  }

  it("computes melee, finesse, versatile and ranged attacks", () => {
    const attacks = fighter("ID_SRD_FIGHTING_STYLE_DEFENSE", [
      { uid: "bow", id: "ID_WOTC_PHB_WEAPON_LONGBOW", quantity: 1 },
      { uid: "sword", id: "ID_WOTC_PHB_WEAPON_LONGSWORD", quantity: 1, equipped: "main" },
      { uid: "rapier", id: "ID_WOTC_PHB_WEAPON_RAPIER", quantity: 1 },
    ]);
    // Equipped weapons come first; the unarmed strike is always last.
    expect(attacks.map((a) => a.name)).toEqual(["Longsword", "Longbow", "Rapier", "Unarmed Strike"]);
    const [sword, bow, rapier, unarmed] = attacks;
    expect(sword).toMatchObject({ ability: "strength", attack: 5, damage: "1d8+3", versatile: "1d10+3", damageType: "slashing", reach: 5, proficient: true, equipped: "main" });
    expect(bow).toMatchObject({ ability: "dexterity", attack: 4, damage: "1d8+2", range: { normal: 150, long: 600 } });
    expect(bow.reach).toBeUndefined();
    // Finesse uses the better of STR and DEX.
    expect(rapier).toMatchObject({ ability: "strength", attack: 5, damage: "1d8+3", properties: ["Finesse"] });
    expect(unarmed).toMatchObject({ attack: 5, damage: "4", damageType: "bludgeoning" });
  });

  it("applies Archery to ranged attacks only", () => {
    const [sword, bow] = fighter("ID_SRD_FIGHTING_STYLE_ARCHERY", [
      { uid: "sword", id: "ID_WOTC_PHB_WEAPON_LONGSWORD", quantity: 1, equipped: "main" },
      { uid: "bow", id: "ID_WOTC_PHB_WEAPON_LONGBOW", quantity: 1 },
    ]);
    expect(sword.attack).toBe(5);
    expect(bow.attack).toBe(6);
    expect(bow.attackBreakdown.map((p) => p.source)).toContain("Archery");
  });

  it("applies Dueling to a one-handed weapon with no off-hand weapon", () => {
    const [sword] = fighter("ID_SRD_FIGHTING_STYLE_DUELING", [
      { uid: "sword", id: "ID_WOTC_PHB_WEAPON_LONGSWORD", quantity: 1, equipped: "main" },
      { uid: "shield", id: "ID_WOTC_GEAR_SHIELD", quantity: 1, equipped: "offhand" },
    ]);
    expect(sword.damage).toBe("1d8+5");
    // Two hands on a versatile weapon: no Dueling.
    expect(sword.versatile).toBe("1d10+3");
  });

  it("leaves the ability modifier off off-hand damage unless the character has Two-Weapon Fighting", () => {
    const inventory: CharacterState["inventory"] = [
      { uid: "a", id: "ID_WOTC_PHB_WEAPON_SHORTSWORD", quantity: 1, equipped: "main" },
      { uid: "b", id: "ID_WOTC_PHB_WEAPON_SHORTSWORD", quantity: 1, equipped: "offhand" },
    ];
    const [, offhand] = fighter("ID_SRD_FIGHTING_STYLE_DEFENSE", inventory);
    expect(offhand).toMatchObject({ equipped: "offhand", damage: "1d6" });
    const [, twf] = fighter("ID_SRD_FIGHTING_STYLE_TWO_WEAPON_FIGHTING", inventory);
    expect(twf.damage).toBe("1d6+3");
  });

  it("marks weapons the character is not proficient with", () => {
    const s = newCharacter();
    s.levels = ["ID_WOTC_PHB_CLASS_WIZARD"];
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
    s.inventory = [
      { uid: "a", id: "ID_WOTC_PHB_WEAPON_LONGSWORD", quantity: 1 },
      { uid: "b", id: "ID_WOTC_PHB_WEAPON_DAGGER", quantity: 1 },
    ];
    const [sword, dagger] = buildSheet(resolveCharacter(registry, s)).attacks;
    expect(sword.proficient).toBe(false);
    expect(dagger.proficient).toBe(true);
    expect(dagger.range).toEqual({ normal: 20, long: 60 });
  });
});

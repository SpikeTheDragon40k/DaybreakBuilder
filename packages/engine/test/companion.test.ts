import { beforeAll, describe, expect, it } from "vitest";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionOptions, type CharacterState } from "../src/index.js";
import { auroraLegacyDir, coreDir, hasAuroraLegacy, loadDirs } from "./helpers.js";

const RANGER = "ID_WOTC_PHB_CLASS_RANGER";

describe.skipIf(!hasAuroraLegacy)("companions", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  function beastMaster(level: number): CharacterState {
    const s = newCharacter();
    s.levels = Array(level).fill(RANGER);
    let rc = resolveCharacter(registry, s);
    const arch = rc.selections.find((p) => p.rule.type === "Archetype")!;
    s.selections[arch.key] = ["ID_WOTC_ARCHETYPE_RANGER_BEAST_MASTER"];
    rc = resolveCharacter(registry, s);
    const pet = rc.selections.find((p) => p.rule.type === "Companion")!;
    const names = selectionOptions(rc, pet).map((o) => o.element.name);
    expect(names).toContain("Wolf");
    expect(names).not.toContain("Ape"); // CR 1/2
    s.selections[pet.key] = ["ID_WOTC_PHB_COMPANION_WOLF"];
    return s;
  }

  it("builds a ranger's wolf companion", () => {
    const sheet = buildSheet(resolveCharacter(registry, beastMaster(3)));
    const c = sheet.companion!;
    expect(c.name).toBe("Wolf");
    expect(c.proficiencyBonus).toBe(2);
    expect(c.abilities.find((a) => a.ability === "dexterity")).toMatchObject({ score: 15, modifier: 2 });
    // 13 natural armor + ranger proficiency bonus
    expect(c.armorClass).toBe(15);
    // max(11, 4 x ranger level 3)
    expect(c.maxHp).toBe(12);
    expect(c.speed.walk).toBe(40);
    expect(c.skills).toEqual(expect.arrayContaining([{ name: "Perception", total: 3 }, { name: "Stealth", total: 4 }]));
    expect(c.actions.map((a) => a.name)).toEqual(["Bite"]);
    expect(c.traits).toHaveLength(2);
    expect(c.attackBonus).toBe(2);
  });

  it("scales companion hit points with ranger level", () => {
    const sheet = buildSheet(resolveCharacter(registry, beastMaster(5)));
    expect(sheet.companion!.maxHp).toBe(20);
    expect(sheet.companion!.armorClass).toBe(16);
  });
});

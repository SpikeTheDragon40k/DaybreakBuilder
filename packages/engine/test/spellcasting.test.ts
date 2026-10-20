import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSheet,
  ContentRegistry,
  findCasters,
  newCharacter,
  preparableSpells,
  resolveCharacter,
  selectionOptions,
  spellLevel,
  type CharacterState,
} from "../src/index.js";
import { auroraLegacyDir, coreDir, hasAuroraLegacy, loadDirs } from "./helpers.js";

const WIZARD = "ID_WOTC_PHB_CLASS_WIZARD";
const CLERIC = "ID_WOTC_PHB_CLASS_CLERIC";

describe.skipIf(!hasAuroraLegacy)("spellcasting", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  const character = (levels: string[]): CharacterState => {
    const s = newCharacter();
    s.abilities = { strength: 8, dexterity: 14, constitution: 14, intelligence: 16, wisdom: 15, charisma: 10 };
    s.levels = levels;
    s.selections["ID_LEVEL_1|Race"] = ["ID_SRD_RACE_HUMAN"];
    return s;
  };

  it("spells implicitly support their level and school", () => {
    const fireball = registry.get("ID_PHB_SPELL_FIREBALL")!;
    expect(fireball.supports).toEqual(expect.arrayContaining(["Wizard", "3", "Evocation"]));
  });

  it("filters wizard cantrips and spellbook choices by list and slot level", () => {
    const rc = resolveCharacter(registry, character(Array(5).fill(WIZARD)));
    const cantrips = rc.selections.filter((p) => p.rule.name === "Cantrip (Wizard)");
    // Level 1 and level 4 selects coexist with distinct keys.
    expect(cantrips.map((p) => p.rule.level)).toEqual([1, 4]);
    expect(new Set(cantrips.map((p) => p.key)).size).toBe(2);
    const cantripOptions = selectionOptions(rc, cantrips[0]);
    expect(cantripOptions.length).toBeGreaterThan(10);
    expect(cantripOptions.every((o) => spellLevel(o.element) === 0)).toBe(true);
    expect(cantripOptions.map((o) => o.element.name)).toContain("Fire Bolt");

    // Gained at wizard level 3: spells of level 1-2 only.
    const book3 = rc.selections.find((p) => p.rule.name === "Spellbook (Wizard)" && p.rule.level === 3)!;
    const levels3 = new Set(selectionOptions(rc, book3).map((o) => spellLevel(o.element)));
    expect([...levels3].sort()).toEqual([1, 2]);
    // Gained at wizard level 5: up to level 3 (Fireball).
    const book5 = rc.selections.find((p) => p.rule.name === "Spellbook (Wizard)" && p.rule.level === 5)!;
    expect(selectionOptions(rc, book5).map((o) => o.element.name)).toContain("Fireball");
  });

  it("wizard prepares from the spellbook; limit = INT mod + level", () => {
    const state = character([WIZARD]);
    let rc = resolveCharacter(registry, state);
    const book = rc.selections.find((p) => p.rule.name === "Spellbook (Wizard)")!;
    const picks = selectionOptions(rc, book).slice(0, 6).map((o) => o.element.id);
    state.selections[book.key] = picks;
    state.preparedSpells.Wizard = picks.slice(0, 2);
    rc = resolveCharacter(registry, state);
    const caster = findCasters(rc).find((c) => c.name === "Wizard")!;
    expect(caster.mode).toBe("spellbook");
    expect(preparableSpells(rc, caster)).toHaveLength(6);
    const row = buildSheet(rc).spellcasting.find((r) => r.name === "Wizard")!;
    expect(row.prepareCount).toBe(3 + 1);
    expect(row.preparedCount).toBe(2);
    expect(row.spells.filter((s) => s.prepared)).toHaveLength(2);
    expect(row.slots.slice(0, 2)).toEqual([2, 0]);
    expect(row.dc).toBe(8 + 2 + 3);
    expect(row.attack).toBe(2 + 3);
  });

  it("cleric prepares from the whole class list", () => {
    const rc = resolveCharacter(registry, character(Array(3).fill(CLERIC)));
    const caster = findCasters(rc).find((c) => c.name === "Cleric")!;
    expect(caster.mode).toBe("list");
    const prep = preparableSpells(rc, caster);
    expect(prep.map((e) => e.name)).toEqual(expect.arrayContaining(["Cure Wounds", "Spiritual Weapon"]));
    expect(prep.every((e) => [1, 2].includes(spellLevel(e)))).toBe(true);
  });

  it("uses the shared multiclass slot table for two full casters", () => {
    const rc = resolveCharacter(registry, character([WIZARD, WIZARD, WIZARD, CLERIC, CLERIC]));
    const sheet = buildSheet(rc);
    expect(sheet.multiclassSpellcasting?.casterLevel).toBe(5);
    expect(sheet.multiclassSpellcasting?.slots.slice(0, 3)).toEqual([4, 3, 2]);
    expect(sheet.spellcasting.find((r) => r.name === "Wizard")?.slots.slice(0, 3)).toEqual([4, 3, 2]);
  });
});

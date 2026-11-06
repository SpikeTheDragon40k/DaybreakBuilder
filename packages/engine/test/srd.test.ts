/** The bundled SRD content pack must be self-contained and playable. */
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSheet,
  ContentRegistry,
  newCharacter,
  resolveCharacter,
  selectionKey,
  selectionOptions,
  type CharacterState,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
const classId = (c: string) => `ID_WOTC_PHB_CLASS_${c.toUpperCase()}`;

describe("SRD content pack", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
  });

  it("loads cleanly", () => {
    const problems = registry.warnings.filter((w) => !w.message.startsWith("duplicate id"));
    expect(problems).toEqual([]);
    expect(registry.ofType("Race")).toHaveLength(9);
    expect(registry.ofType("Class")).toHaveLength(12);
    expect(registry.ofType("Archetype")).toHaveLength(12);
    expect(registry.ofType("Spell").length).toBeGreaterThan(300);
  });

  it("references only elements that exist", () => {
    const missing = new Set<string>();
    for (const el of registry.all()) {
      for (const r of el.rules) if (r.kind === "grant" && !registry.get(r.id)) missing.add(`${el.id} -> ${r.id}`);
    }
    expect([...missing]).toEqual([]);
  });

  /** Make every choice with the first available option, repeatedly, until nothing is left open. */
  function autoChoose(state: CharacterState): CharacterState {
    for (let pass = 0; pass < 12; pass++) {
      const rc = resolveCharacter(registry, state);
      let changed = false;
      for (const point of rc.selections) {
        if (point.rule.type === "Class" || point.rule.optional) continue;
        if (!point.chosen.some((c) => c === null)) continue;
        if (point.rule.type === "List") {
          state.selections[point.key] = point.chosen.map((c) => c ?? String(point.rule.items[0]?.id));
          changed = true;
          continue;
        }
        const options = selectionOptions(rc, point).filter((o) => o.available);
        const picks = [...point.chosen];
        const used = new Set(picks.filter(Boolean));
        for (let i = 0; i < picks.length; i++) {
          if (picks[i]) continue;
          const next = options.find((o) => !used.has(o.element.id));
          if (!next) break;
          picks[i] = next.element.id;
          used.add(next.element.id);
        }
        if (picks.some((p, i) => p !== point.chosen[i])) {
          state.selections[point.key] = picks;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return state;
  }

  for (const cls of CLASSES) {
    it(`builds a level 20 ${cls} with every choice made`, () => {
      const s = newCharacter();
      s.abilities = { strength: 15, dexterity: 14, constitution: 14, intelligence: 13, wisdom: 13, charisma: 13 };
      s.levels = Array(20).fill(classId(cls));
      s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
      s.selections[selectionKey("ID_LEVEL_1", "Background")] = ["ID_BACKGROUND_ACOLYTE"];
      autoChoose(s);
      const rc = resolveCharacter(registry, s);
      expect(rc.issues).toEqual([]);
      const sheet = buildSheet(rc);
      expect(sheet.classSummary).toMatch(new RegExp(`^${cls} \\(.+\\) 20$`));
      expect(sheet.proficiencyBonus).toBe(6);
      const open = rc.selections.filter((p) => !p.rule.optional && p.rule.type !== "Class" && p.chosen.some((c) => c === null));
      expect(open.map((p) => p.rule.name)).toEqual([]);
      expect(sheet.features.length).toBeGreaterThan(5);
      expect(sheet.features.filter((f) => `${f.text}${f.usage ?? ""}`.includes("{{")).map((f) => f.name)).toEqual([]);
    });
  }

  it("computes a level 5 hill dwarf fighter", () => {
    const s = newCharacter();
    s.abilities = { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 };
    s.levels = Array(5).fill(classId("Fighter"));
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_SRD_RACE_DWARF"];
    s.selections[selectionKey("ID_LEVEL_1/ID_SRD_RACE_DWARF", "Dwarven Subrace")] = ["ID_SUB_RACE_HILL_DWARF"];
    s.inventory = [
      { uid: "a", id: "ID_WOTC_ARMOR_HEAVY_CHAIN_MAIL", quantity: 1, equipped: "armor" },
      { uid: "b", id: "ID_WOTC_GEAR_SHIELD", quantity: 1, equipped: "offhand" },
    ];
    let rc = resolveCharacter(registry, s);
    const style = rc.selections.find((p) => p.rule.name === "Fighting Style (Fighter)")!;
    s.selections[style.key] = ["ID_SRD_FIGHTING_STYLE_DEFENSE"];
    rc = resolveCharacter(registry, s);
    const sheet = buildSheet(rc);
    expect(sheet.abilities.find((a) => a.ability === "constitution")?.score).toBe(16);
    // 16 chain mail + 2 shield + 1 Defense
    expect(sheet.armorClass).toBe(19);
    // 10 + 4 x 6 + 5 x (3 + 1)
    expect(sheet.maxHp).toBe(54);
    // Dwarves ignore the heavy armor speed penalty.
    expect(sheet.speed.walk).toBe(25);
    expect(sheet.vision).toEqual([{ name: "Darkvision", range: 60 }]);
    expect(sheet.features.map((f) => f.name)).toEqual(expect.arrayContaining(["Second Wind", "Action Surge", "Extra Attack", "Defense"]));
  });

  it("applies unarmored defense and caps it against armor", () => {
    const s = newCharacter();
    s.abilities = { strength: 10, dexterity: 16, constitution: 10, intelligence: 10, wisdom: 16, charisma: 10 };
    s.levels = Array(2).fill(classId("Monk"));
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
    const sheet = buildSheet(resolveCharacter(registry, s));
    // 10 + DEX 3 + WIS 3 (human +1 doesn't change the modifiers)
    expect(sheet.armorClass).toBe(16);
    expect(sheet.speed.walk).toBe(40);
  });

  it("shares the multiclass spell slot table whichever caster class comes first", () => {
    for (const order of [["Wizard", "Cleric"], ["Cleric", "Wizard"]]) {
      const s = newCharacter();
      s.abilities = { strength: 10, dexterity: 14, constitution: 14, intelligence: 15, wisdom: 15, charisma: 10 };
      s.levels = [classId(order[0]), classId(order[0]), classId(order[1]), classId(order[1])];
      s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
      const sheet = buildSheet(resolveCharacter(registry, s));
      expect(sheet.multiclassSpellcasting, order.join("/")).toEqual({ casterLevel: 4, slots: [4, 3, 0, 0, 0, 0, 0, 0, 0] });
      for (const row of sheet.spellcasting) expect(row.slots.slice(0, 3), `${order.join("/")}: ${row.name}`).toEqual([4, 3, 0]);
    }
  });

  it("offers wizard cantrips and spellbook spells from the SRD", () => {
    const s = newCharacter();
    s.levels = [classId("Wizard")];
    const rc = resolveCharacter(registry, s);
    const cantrip = rc.selections.find((p) => p.rule.name === "Cantrip (Wizard)")!;
    const names = selectionOptions(rc, cantrip).map((o) => o.element.name);
    expect(names).toEqual(expect.arrayContaining(["Fire Bolt", "Mage Hand", "Ray of Frost"]));
    expect(names).not.toContain("Sacred Flame");
    const book = rc.selections.find((p) => p.rule.name === "Spellbook (Wizard)")!;
    expect(book.rule.number).toBe(6);
    expect(selectionOptions(rc, book).map((o) => o.element.name)).toEqual(expect.arrayContaining(["Magic Missile", "Shield"]));
  });
});

/**
 * Integration tests against the community content repository
 * (github.com/AuroraLegacy/elements). Skipped unless a local checkout is
 * available at fixtures/external/aurora-legacy or $AURORA_LEGACY_DIR.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSheet,
  ContentRegistry,
  findCaster,
  newCharacter,
  preparableSpells,
  resolveCharacter,
  selectionKey,
  selectionOptions,
  type CharacterState,
} from "../src/index.js";
import { auroraLegacyDir, coreDir, hasAuroraLegacy, loadDirs } from "./helpers.js";

const FIGHTER = "ID_WOTC_PHB_CLASS_FIGHTER";
const WIZARD = "ID_WOTC_PHB_CLASS_WIZARD";

describe.skipIf(!hasAuroraLegacy)("AuroraLegacy content", () => {
  let registry: ContentRegistry;

  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  it("loads all files", () => {
    const parseErrors = registry.warnings.filter((w) => w.message.startsWith("failed to parse"));
    expect(parseErrors).toEqual([]);
    expect(registry.size).toBeGreaterThan(10000);
    expect(registry.get(FIGHTER)?.type).toBe("Class");
    expect(registry.multiclassOf(FIGHTER)?.id).toBe("ID_WOTC_PHB_MULTICLASS_FIGHTER");
  });

  function hillDwarfFighter(level: number): CharacterState {
    const s = newCharacter();
    s.rules = "2014";
    s.abilities = { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 };
    s.levels = Array(level).fill(FIGHTER);
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_SRD_RACE_DWARF"];
    s.selections[selectionKey("ID_LEVEL_1/ID_SRD_RACE_DWARF/ID_RACIAL_TRAIT_DWARVEN_SUBRACE", "Dwarven Subrace")] = ["ID_SUB_RACE_HILL_DWARF"];
    return s;
  }

  it("builds a level 1 hill dwarf fighter", () => {
    const rc = resolveCharacter(registry, hillDwarfFighter(1));
    const sheet = buildSheet(rc);
    expect(sheet.race).toBe("Dwarf");
    expect(sheet.subrace).toBe("Hill Dwarf");
    expect(sheet.classSummary).toBe("Fighter 1");
    expect(sheet.proficiencyBonus).toBe(2);
    // CON 14 + 2 (dwarf), WIS 12 + 1 (hill dwarf)
    expect(sheet.abilities.find((a) => a.ability === "constitution")?.score).toBe(16);
    expect(sheet.abilities.find((a) => a.ability === "wisdom")?.score).toBe(13);
    // d10 + CON 3 + 1 (Dwarven Toughness)
    expect(sheet.maxHp).toBe(14);
    expect(sheet.speed.walk).toBe(25);
    expect(sheet.armorClass).toBe(11);
    expect(sheet.initiative).toBe(1);
    expect(sheet.savingThrows.find((s) => s.ability === "strength")).toMatchObject({ proficient: true, total: 4 });
    expect(sheet.savingThrows.find((s) => s.ability === "dexterity")).toMatchObject({ proficient: false, total: 1 });
    expect(sheet.languages).toEqual(expect.arrayContaining(["Common", "Dwarvish"]));
    expect(sheet.vision.map((v) => v.name)).toContain("Darkvision");
    expect(sheet.features.map((f) => f.name)).toEqual(expect.arrayContaining(["Fighting Style", "Second Wind"]));
    expect(rc.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("offers class skill choices and applies them", () => {
    const state = hillDwarfFighter(1);
    let rc = resolveCharacter(registry, state);
    const point = rc.selections.find((p) => p.rule.name === "Skill Proficiency (Fighter)");
    expect(point).toBeDefined();
    const names = selectionOptions(rc, point!).map((o) => o.element.name);
    expect(names).toEqual(expect.arrayContaining(["Athletics", "Perception", "Survival"]));
    expect(names).not.toContain("Stealth");
    state.selections[point!.key] = ["ID_PROFICIENCY_SKILL_ATHLETICS", "ID_PROFICIENCY_SKILL_PERCEPTION"];
    rc = resolveCharacter(registry, state);
    const sheet = buildSheet(rc);
    expect(sheet.skills.find((s) => s.name === "Athletics")).toMatchObject({ proficient: true, total: 4 });
    expect(sheet.skills.find((s) => s.name === "Perception")).toMatchObject({ proficient: true, total: 3 });
    expect(sheet.passivePerception).toBe(13);
  });

  it("levels up: proficiency, hit points and level-gated features", () => {
    const rc = resolveCharacter(registry, hillDwarfFighter(5));
    const sheet = buildSheet(rc);
    expect(sheet.proficiencyBonus).toBe(3);
    // 10 + 4 * 6 (average d10) + 5 * (CON 3 + toughness 1)
    expect(sheet.maxHp).toBe(10 + 24 + 20);
    expect(sheet.features.map((f) => f.name)).toEqual(expect.arrayContaining(["Action Surge", "Extra Attack"]));
    expect(rc.selections.some((p) => p.rule.name.startsWith("Martial Archetype"))).toBe(true);
  });

  it("applies equipped armor and shield", () => {
    const state = hillDwarfFighter(1);
    state.inventory = [
      { uid: "1", id: "ID_WOTC_ARMOR_HEAVY_CHAIN_MAIL", quantity: 1, equipped: "armor" },
      { uid: "2", id: "ID_WOTC_PHB_ARMOR_SHIELD", quantity: 1, equipped: "offhand" },
    ];
    const sheet = buildSheet(resolveCharacter(registry, state));
    if (registry.get("ID_WOTC_PHB_ARMOR_SHIELD")) expect(sheet.armorClass).toBe(18);
    else expect(sheet.armorClass).toBe(16);
  });

  it("multiclasses with the multiclass proficiency subset", () => {
    const state = hillDwarfFighter(3);
    state.abilities.intelligence = 13;
    state.levels = [FIGHTER, FIGHTER, WIZARD];
    const rc = resolveCharacter(registry, state);
    const sheet = buildSheet(rc);
    expect(sheet.classSummary).toBe("Fighter 2 / Wizard 1");
    // Wizard saving throws are not gained from multiclassing.
    expect(sheet.savingThrows.find((s) => s.ability === "intelligence")?.proficient).toBe(false);
    expect(sheet.spellcasting.map((s) => s.name)).toContain("Wizard");
    const wiz = sheet.spellcasting.find((s) => s.name === "Wizard")!;
    expect(wiz.slots[0]).toBe(2);
    expect(rc.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("2024: the background grants its Origin feat and ability score increases", () => {
    const acolyte = "ID_WOTC_PHB24_BACKGROUND_ACOLYTE";
    const combo = "ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_INT_WIS_CHA";
    const state = hillDwarfFighter(1);
    state.rules = "2024";
    state.selections[selectionKey("ID_LEVEL_1", "Background")] = [acolyte];
    state.selections[selectionKey(`ID_LEVEL_1/${acolyte}/${combo}`, "Ability Score Improvement Option")] = [`${combo}_1`];
    let rc = resolveCharacter(registry, state);
    const plus2 = rc.selections.find((p) => p.rule.name === "Background Ability Score Improvement +2")!;
    const plus1 = rc.selections.find((p) => p.rule.name === "Background Ability Score Improvement +1")!;
    state.selections[plus2.key] = ["ID_WOTC_TCOE_OPTION_CUSTOMIZED_ASI_WISDOM_INCREASE_2"];
    state.selections[plus1.key] = ["ID_WOTC_TCOE_OPTION_CUSTOMIZED_ASI_CHARISMA_INCREASE_1"];
    rc = resolveCharacter(registry, state);
    const sheet = buildSheet(rc);
    const score = (a: string) => sheet.abilities.find((x) => x.ability === a)?.score;
    // WIS 12 + 2, CHA 10 + 1; the 2014 dwarf's own CON +2 / WIS +1 give way to the background.
    expect([score("wisdom"), score("charisma"), score("constitution")]).toEqual([14, 11, 14]);
    // The Acolyte's feat is the Cleric option of Magic Initiate, with its own choices.
    expect(rc.selections.map((p) => p.rule.name)).toContain("Spellcasting Ability (Magic Initiate)");

    state.selections[selectionKey("ID_LEVEL_1", "Background")] = ["ID_WOTC_PHB24_BACKGROUND_CRIMINAL"];
    const criminal = buildSheet(resolveCharacter(registry, state));
    expect(criminal.features.find((f) => f.name === "Alert")).toMatchObject({ category: "Origin", origin: "Criminal" });
  });

  it("2024: Origin feat choices offer only Origin feats", () => {
    const state = hillDwarfFighter(1);
    state.selections[selectionKey("ID_LEVEL_1", "Background")] = ["ID_WOTC_DMG24_BACKGROUND_CUSTOM"];
    const rc = resolveCharacter(registry, state);
    const point = rc.selections.find((p) => p.rule.name === "Origin Feat (Custom Background)")!;
    const options = selectionOptions(rc, point);
    expect(options.length).toBeGreaterThan(5);
    expect(options.every((o) => o.element.supports.includes("Origin"))).toBe(true);
    expect(options.map((o) => o.element.name)).toEqual(expect.arrayContaining(["Alert", "Lucky", "Tough"]));
  });

  it("2024 rules: species choices drop the 2014 core races and their subraces", () => {
    const state = newCharacter();
    state.levels = ["ID_WOTC_PHB24_CLASS_FIGHTER"];
    let rc = resolveCharacter(registry, state);
    const racePoint = rc.selections.find((p) => p.key === selectionKey("ID_LEVEL_1", "Race"))!;
    const races = selectionOptions(rc, racePoint).map((o) => o.element);
    const sources = new Set(races.map((r) => r.source));
    expect(sources).toContain("Player’s Handbook (2024)");
    for (const legacy of ["Player’s Handbook", "System Reference Document 5.1"]) expect(sources).not.toContain(legacy);
    // Supplements stay available (2024 rules allow older species).
    expect(races.some((r) => r.source.includes("Tasha") || r.source.includes("Monsters of the Multiverse"))).toBe(true);
    expect(races.filter((r) => r.name === "Elf").map((r) => r.id)).toEqual(["ID_WOTC_PHB24_RACE_ELF"]);

    // 2014 rules show the 2014 races again.
    state.rules = "2014";
    rc = resolveCharacter(registry, state);
    expect(selectionOptions(rc, racePoint).map((o) => o.element.id)).toContain("ID_RACE_ELF");
  });

  it.each([
    ["Druid", "ID_WOTC_PHB24_CLASS_DRUID", 4, 7],
    ["Cleric", "ID_WOTC_PHB24_CLASS_CLERIC", 5, 9],
  ])("2024: a %s prepares spells from the whole class list", (name, id, level, count) => {
    const state = newCharacter();
    state.abilities.wisdom = 15;
    state.levels = Array(level).fill(id);
    let rc = resolveCharacter(registry, state);
    const caster = findCaster(rc, name)!;
    expect(caster.mode).toBe("list");
    let row = buildSheet(rc).spellcasting.find((r) => r.name === name)!;
    expect(row).toMatchObject({ prepareCount: count, preparedCount: 0 });
    expect(buildSheet(rc).warnings).toContain(`Prepared Spells (${name}): ${count} spells to prepare`);

    const options = preparableSpells(rc, caster);
    expect(options.length).toBeGreaterThan(count);
    state.preparedSpells[name] = options.slice(0, count).map((el) => el.id);
    rc = resolveCharacter(registry, state);
    const sheet = buildSheet(rc);
    row = sheet.spellcasting.find((r) => r.name === name)!;
    expect(row.preparedCount).toBe(count);
    expect(row.spells.filter((s) => s.prepared && s.level > 0).length).toBeGreaterThanOrEqual(count);
    expect(sheet.warnings.some((w) => w.startsWith("Prepared Spells"))).toBe(false);
  });

  it("2024 rules: a species never offers its own ability scores, even before a background is chosen", () => {
    const state = newCharacter();
    state.levels = ["ID_WOTC_PHB24_CLASS_FIGHTER"];
    const speciesAsi = () =>
      resolveCharacter(registry, state).selections.filter((p) => p.rule.type === "Ability Score Improvement").map((p) => p.rule.name);
    for (const race of ["ID_WOTC_PHB24_RACE_HALFLING", "ID_WOTC_MOTM_RACE_GOBLIN"]) {
      state.selections[selectionKey("ID_LEVEL_1", "Race")] = [race];
      state.rules = "2024";
      expect(speciesAsi()).toEqual([]);
      // 2014 rules keep the flexible increase on a Monsters of the Multiverse race until a 2024 background takes over.
      state.rules = "2014";
      if (race === "ID_WOTC_MOTM_RACE_GOBLIN") expect(speciesAsi()).toEqual(["Ability Score Improvement Option (Goblin)"]);
    }
  });

  it("2024 rules: a 2014 race chosen before keeps its subraces", () => {
    const state = newCharacter();
    state.levels = ["ID_WOTC_PHB24_CLASS_FIGHTER"];
    state.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_ELF"];
    const rc = resolveCharacter(registry, state);
    const subrace = rc.selections.find((p) => p.rule.type === "Sub Race")!;
    expect(selectionOptions(rc, subrace).map((o) => o.element.name)).toContain("High Elf");
  });
});

export { auroraLegacyDir };

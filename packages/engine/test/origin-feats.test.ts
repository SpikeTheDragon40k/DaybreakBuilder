/**
 * 2024 rules: backgrounds grant an Origin feat and the ability score increases
 * (+2/+1 or +1/+1/+1 over three abilities), and species stop granting their own.
 * The fixture follows the shape of 2024 content written for Aurora.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSheet,
  ContentRegistry,
  featCategory,
  newCharacter,
  resolveCharacter,
  selectionKey,
  selectionOptions,
  type Ability,
  type CharacterState,
  type ResolvedCharacter,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const FIXTURE = `<elements>
  <element name="Watchful" type="Feat" source="Test 2024" id="ID_TEST_FEAT_WATCHFUL">
    <supports>Origin</supports>
    <description><p>You add your proficiency bonus to initiative.</p></description>
    <sheet><description>Add proficiency bonus to initiative.</description></sheet>
    <rules><stat name="initiative" value="proficiency" /></rules>
  </element>
  <element name="Handy" type="Feat" source="Test 2024" id="ID_TEST_FEAT_HANDY">
    <supports>Origin</supports>
    <description><p>You gain proficiency in a skill.</p></description>
    <rules><select type="Proficiency" name="Skill (Handy)" supports="Skill" /></rules>
  </element>
  <element name="Brawny" type="Feat" source="Test 2024" id="ID_TEST_FEAT_BRAWNY">
    <supports>General</supports>
    <prerequisite>Level 4+</prerequisite>
    <requirements>[level:4]</requirements>
    <description><p>Increase your Strength by 1.</p></description>
  </element>
  <element name="Temple Hand" type="Background" source="Test 2024" id="ID_TEST_BACKGROUND_TEMPLE_HAND">
    <description><p>Ability Scores: Intelligence, Wisdom, Charisma. Feat: Watchful.</p></description>
    <rules>
      <grant type="Ability Score Improvement" id="ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_INT_WIS_CHA" />
      <grant type="Feat" id="ID_TEST_FEAT_WATCHFUL" />
      <grant type="Proficiency" id="ID_PROFICIENCY_SKILL_INSIGHT" />
      <grant type="Grants" id="ID_INTERNAL_GRANTS_BACKGROUND_ASI" />
    </rules>
  </element>
  <element name="Made-Up Past" type="Background" source="Test 2024" id="ID_TEST_BACKGROUND_CUSTOM">
    <description><p>Choose three abilities and an Origin feat.</p></description>
    <rules>
      <select type="Ability Score Improvement" name="Ability Score Combination" supports="Custom Background Ability Score Combination" />
      <select type="Feat" name="Origin Feat (Custom Background)" supports="Origin" />
      <grant type="Grants" id="ID_INTERNAL_GRANTS_BACKGROUND_ASI" />
    </rules>
  </element>
</elements>`;

const TEMPLE = "ID_TEST_BACKGROUND_TEMPLE_HAND";
const CUSTOM = "ID_TEST_BACKGROUND_CUSTOM";
const COMBO = "ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_INT_WIS_CHA";
const increase = (a: Ability, n: 1 | 2) => `ID_WOTC_TCOE_OPTION_CUSTOMIZED_ASI_${a.toUpperCase()}_INCREASE_${n}`;

describe("2024 backgrounds and Origin feats", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
    registry.addXml(FIXTURE, "origin-feats.xml");
    registry.finalize();
  });

  function character(background: string, race = "ID_SRD_RACE_HUMAN"): CharacterState {
    const s = newCharacter();
    s.abilities = { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 };
    s.levels = ["ID_WOTC_PHB_CLASS_FIGHTER"];
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = [race];
    s.selections[selectionKey("ID_LEVEL_1", "Background")] = [background];
    return s;
  }

  const score = (rc: ResolvedCharacter, a: Ability) => rc.stats.abilityScore(a);
  const point = (rc: ResolvedCharacter, name: string) => {
    const p = rc.selections.find((x) => x.rule.name === name);
    expect(p, name).toBeDefined();
    return p!;
  };

  it("tags feats with their category", () => {
    expect(featCategory(registry.get("ID_TEST_FEAT_WATCHFUL")!)).toBe("Origin");
    expect(featCategory(registry.get("ID_TEST_FEAT_BRAWNY")!)).toBe("General");
    expect(featCategory(registry.get(TEMPLE)!)).toBeUndefined();
  });

  it("grants the background's Origin feat and shows it as such on the sheet", () => {
    const rc = resolveCharacter(registry, character(TEMPLE));
    const sheet = buildSheet(rc);
    const feat = sheet.features.find((f) => f.id === "ID_TEST_FEAT_WATCHFUL");
    expect(feat).toMatchObject({ category: "Origin", origin: "Temple Hand" });
    // Fighter level 1: proficiency +2, DEX 13 → +1
    expect(sheet.initiative).toBe(3);
  });

  it("applies +1/+1/+1 to the background's three abilities", () => {
    const s = character(TEMPLE, "ID_SRD_RACE_DWARF");
    s.selections[selectionKey(`ID_LEVEL_1/${TEMPLE}/${COMBO}`, "Ability Score Improvement Option")] = [`${COMBO}_2`];
    const rc = resolveCharacter(registry, s);
    expect(score(rc, "intelligence")).toBe(9);
    expect(score(rc, "wisdom")).toBe(13);
    expect(score(rc, "charisma")).toBe(11);
    // The species' own increase (dwarf CON +2) is replaced by the background's.
    expect(score(rc, "constitution")).toBe(14);
  });

  it("applies +2 and +1 to two different abilities", () => {
    const s = character(TEMPLE);
    const optionKey = selectionKey(`ID_LEVEL_1/${TEMPLE}/${COMBO}`, "Ability Score Improvement Option");
    s.selections[optionKey] = [`${COMBO}_1`];
    let rc = resolveCharacter(registry, s);
    const plus2 = point(rc, "Background Ability Score Improvement +2");
    expect(selectionOptions(rc, plus2).map((o) => o.element.id).sort()).toEqual(
      [increase("charisma", 2), increase("intelligence", 2), increase("wisdom", 2)].sort(),
    );
    s.selections[plus2.key] = [increase("wisdom", 2)];
    rc = resolveCharacter(registry, s);
    const plus1 = point(rc, "Background Ability Score Improvement +1");
    const available = selectionOptions(rc, plus1).filter((o) => o.available).map((o) => o.element.id);
    expect(available.sort()).toEqual([increase("charisma", 1), increase("intelligence", 1)].sort());
    s.selections[plus1.key] = [increase("charisma", 1)];
    rc = resolveCharacter(registry, s);
    expect(score(rc, "wisdom")).toBe(14);
    expect(score(rc, "charisma")).toBe(11);
    expect(score(rc, "intelligence")).toBe(8);
    // Human +1 to everything doesn't apply alongside a 2024 background.
    expect(score(rc, "strength")).toBe(15);
    expect(buildSheet(rc).warnings.filter((w) => w.includes("Ability Score"))).toEqual([]);
  });

  it("keeps species increases with a background that has none", () => {
    const rc = resolveCharacter(registry, character("ID_BACKGROUND_ACOLYTE", "ID_SRD_RACE_DWARF"));
    expect(rc.registry.get("ID_BACKGROUND_ACOLYTE")).toBeDefined();
    expect(score(rc, "constitution")).toBe(16);
  });

  it("does not raise a score above 20", () => {
    const s = character(TEMPLE);
    s.abilities.wisdom = 20;
    s.selections[selectionKey(`ID_LEVEL_1/${TEMPLE}/${COMBO}`, "Ability Score Improvement Option")] = [`${COMBO}_2`];
    expect(score(resolveCharacter(registry, s), "wisdom")).toBe(20);
  });

  it("lets a custom background choose any three abilities and any Origin feat", () => {
    const s = character(CUSTOM);
    let rc = resolveCharacter(registry, s);
    const combos = selectionOptions(rc, point(rc, "Ability Score Combination"));
    expect(combos).toHaveLength(20);
    const feats = selectionOptions(rc, point(rc, "Origin Feat (Custom Background)")).map((o) => o.element.name);
    expect(feats).toContain("Watchful");
    expect(feats).toContain("Handy");
    expect(feats).not.toContain("Brawny");

    s.selections[point(rc, "Origin Feat (Custom Background)").key] = ["ID_TEST_FEAT_HANDY"];
    s.selections[point(rc, "Ability Score Combination").key] = ["ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_COMBINATION_STR_DEX_CON"];
    rc = resolveCharacter(registry, s);
    // The chosen feat's own choices become available.
    expect(point(rc, "Skill (Handy)").key).toBe(`ID_LEVEL_1/${CUSTOM}/ID_TEST_FEAT_HANDY|Skill (Handy)`);
    expect(point(rc, "Ability Score Improvement Option").owner.element.name).toBe("Strength, Dexterity, Constitution");
  });
});

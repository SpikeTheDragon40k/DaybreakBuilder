/**
 * The 2014 / 2024 rules switch: with 2024 content loaded, a 2024 character's
 * choices leave out the 2014 core options (SRD 5.1 races and their subraces)
 * and anything reprinted in a 2024 book; supplements stay.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  ContentRegistry,
  hasRevisedContent,
  loadCharacterJson,
  newCharacter,
  resolveCharacter,
  selectionKey,
  selectionOptions,
  type CharacterState,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const FIXTURE = `<elements>
  <element name="Test Handbook (2024)" type="Source" source="Core" id="ID_TEST_SOURCE_HANDBOOK_2024">
    <setters><set name="release">20240917</set></setters>
  </element>
  <element name="Elf" type="Race" source="Test Handbook (2024)" id="ID_TEST24_RACE_ELF">
    <rules>
      <grant type="Racial Trait" id="ID_TEST24_RACIAL_TRAIT_ELVEN_LINEAGE" />
    </rules>
  </element>
  <element name="Elven Lineage" type="Racial Trait" source="Test Handbook (2024)" id="ID_TEST24_RACIAL_TRAIT_ELVEN_LINEAGE">
    <rules><select type="Racial Trait" name="Elven Lineage" supports="Elven Lineage 2024" /></rules>
  </element>
  <element name="Drow" type="Racial Trait" source="Test Handbook (2024)" id="ID_TEST24_LINEAGE_DROW"><supports>Elven Lineage 2024</supports></element>
  <element name="Wood Elf" type="Racial Trait" source="Test Handbook (2024)" id="ID_TEST24_LINEAGE_WOOD_ELF"><supports>Elven Lineage 2024</supports></element>
  <element name="Human" type="Race" source="Test Handbook (2024)" id="ID_TEST24_RACE_HUMAN" />
  <element name="Owlfolk" type="Race" source="Test Supplement" id="ID_TEST_RACE_OWLFOLK" />
</elements>`;

const RACE_KEY = selectionKey("ID_LEVEL_1", "Race");

describe("2014 / 2024 rules", () => {
  let registry: ContentRegistry;
  let srdOnly: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
    registry.addXml(FIXTURE, "test-2024.xml");
    registry.finalize();
    srdOnly = loadDirs(new ContentRegistry(), coreDir, srdDir);
  });

  function raceChoices(state: CharacterState, reg = registry): string[] {
    const rc = resolveCharacter(reg, state);
    const point = rc.selections.find((p) => p.key === RACE_KEY)!;
    return selectionOptions(rc, point).map((o) => `${o.element.name} (${o.element.source})`);
  }

  it("detects 2024 content", () => {
    expect(hasRevisedContent(registry)).toBe(true);
    expect(hasRevisedContent(srdOnly)).toBe(false);
  });

  it("new characters use the 2024 rules; older saves keep 2014", () => {
    expect(newCharacter().rules).toBe("2024");
    const { rules: _, ...old } = newCharacter();
    expect(loadCharacterJson(old).rules).toBe("2014");
    expect(loadCharacterJson({ ...old, rules: "2024" }).rules).toBe("2024");
  });

  it("2024 characters only see 2024 species and supplements", () => {
    expect(raceChoices(newCharacter()).sort()).toEqual([
      "Elf (Test Handbook (2024))",
      "Human (Test Handbook (2024))",
      "Owlfolk (Test Supplement)",
    ]);
  });

  it("2014 characters see everything", () => {
    const s = newCharacter();
    s.rules = "2014";
    const races = raceChoices(s);
    expect(races).toContain("Elf (System Reference Document 5.1)");
    expect(races).toContain("Elf (Test Handbook (2024))");
    expect(races).toContain("Half-Orc (System Reference Document 5.1)");
  });

  it("does nothing without 2024 content, so there is always something to pick", () => {
    expect(raceChoices(newCharacter(), srdOnly)).toHaveLength(9);
  });

  it("a 2024 elf picks a lineage, not a subrace; a 2024 human has neither", () => {
    const elf = newCharacter();
    elf.selections[RACE_KEY] = ["ID_TEST24_RACE_ELF"];
    const rc = resolveCharacter(registry, elf);
    const own = rc.selections.filter((p) => p.owner.path.includes("ID_TEST24_RACE_ELF"));
    expect(own.map((p) => [p.rule.name, p.rule.type])).toEqual([["Elven Lineage", "Racial Trait"]]);
    expect(selectionOptions(rc, own[0]).map((o) => o.element.name)).toEqual(["Drow", "Wood Elf"]);

    const human = newCharacter();
    human.selections[RACE_KEY] = ["ID_TEST24_RACE_HUMAN"];
    expect(resolveCharacter(registry, human).selections.filter((p) => p.owner.path.includes("ID_TEST24_RACE_HUMAN"))).toEqual([]);
  });

  it("keeps a 2014 race chosen earlier, with its own subraces", () => {
    const s = newCharacter();
    s.selections[RACE_KEY] = ["ID_RACE_ELF"];
    const rc = resolveCharacter(registry, s);
    expect(raceChoices(s)).toContain("Elf (System Reference Document 5.1)");
    const subrace = rc.selections.find((p) => p.rule.type === "Sub Race")!;
    expect(selectionOptions(rc, subrace).map((o) => o.element.name)).toEqual(["High Elf"]);
  });
});

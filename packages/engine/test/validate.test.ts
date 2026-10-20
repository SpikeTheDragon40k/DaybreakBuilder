import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { validateContent, type ContentFile, type ValidationIssue } from "../src/index.js";
import { coreDir, repoRoot, srdDir, xmlFiles } from "./helpers.js";

const load = (dir: string): ContentFile[] =>
  xmlFiles(dir).map((f) => ({ path: relative(repoRoot, f), xml: readFileSync(f, "utf8") }));

const base = [...load(coreDir), ...load(srdDir)];

const file = (body: string, path = "custom/test.xml"): ContentFile => ({
  path,
  xml: `<?xml version="1.0" encoding="utf-8"?>\n<elements>\n${body}\n</elements>\n`,
});

const messages = (issues: ValidationIssue[], severity?: ValidationIssue["severity"]) =>
  issues.filter((i) => !severity || i.severity === severity).map((i) => `${i.element ?? ""}: ${i.message}`);

describe("validateContent", () => {
  it("passes the bundled SRD pack", () => {
    const result = validateContent(load(coreDir), load(srdDir));
    expect(messages(result.issues)).toEqual([]);
    expect(result.builds).toBeGreaterThan(30);
  });

  it("accepts a well-formed subclass, feat and spell", () => {
    const result = validateContent(base, [
      file(`
	<element name="School of Testing" type="Archetype" source="Test" id="ID_TEST_ARCHETYPE_WIZARD_TESTING">
		<supports>Arcane Tradition, Wizard</supports>
		<description><p>You study tests.</p></description>
		<rules><grant type="Archetype Feature" id="ID_TEST_ARCHETYPE_FEATURE_TESTING_SAVANT" level="2" /></rules>
	</element>
	<element name="Testing Savant" type="Archetype Feature" source="Test" id="ID_TEST_ARCHETYPE_FEATURE_TESTING_SAVANT">
		<description><p>You are good at tests.</p></description>
		<sheet><description>Proficiency bonus {{proficiency}}.</description></sheet>
	</element>
	<element name="Tester" type="Feat" source="Test" id="ID_TEST_FEAT_TESTER">
		<prerequisite>Intelligence 13</prerequisite>
		<requirements>[int:13]</requirements>
		<description><p>You test.</p></description>
		<rules><stat name="intelligence" value="1" /></rules>
	</element>
	<element name="Test Bolt" type="Spell" source="Test" id="ID_TEST_SPELL_TEST_BOLT">
		<supports>Wizard, Sorcerer</supports>
		<description><p>A bolt of testing.</p></description>
		<setters>
			<set name="level">1</set><set name="school">Evocation</set><set name="time">1 action</set>
			<set name="range">60 feet</set><set name="duration">Instantaneous</set>
			<set name="hasVerbalComponent">true</set><set name="hasSomaticComponent">true</set>
			<set name="hasMaterialComponent">false</set><set name="isConcentration">false</set><set name="isRitual">false</set>
		</setters>
	</element>`),
    ]);
    expect(messages(result.issues)).toEqual([]);
    expect(result.elements).toBe(4);
    expect(result.builds).toBe(1);
  });

  it("reports XML errors with a line number", () => {
    const result = validateContent(base, [file(`\t<element name="Broken" type="Feat" id="ID_TEST_BROKEN">\n\t\t<description><p>oops</description>\n\t</element>`)]);
    expect(result.issues).toEqual([expect.objectContaining({ severity: "error", file: "custom/test.xml", line: 4 })]);
    expect(result.issues[0].message).toMatch(/not well-formed XML: Mismatched closing tag/);
  });

  it("reports broken references, selects and setters", () => {
    const result = validateContent(base, [
      file(`
	<element name="Bad Feat" type="Feat" source="Test" id="ID_TEST_FEAT_BAD">
		<requirements>ID_TEST_NOWHERE &amp;&amp; (</requirements>
		<description><p>Bad.</p></description>
		<rules>
			<grant type="Feat Feature" id="ID_TEST_MISSING" />
			<select type="Language" name="Typo Language" supports="Standrad" />
			<select type="Widget" name="Widget" />
		</rules>
	</element>
	<element name="Bad Spell" type="Spell" source="Test" id="ID_TEST_SPELL_BAD">
		<supports>Wizard</supports>
		<description><p>Bad.</p></description>
		<setters><set name="level">first</set><set name="school">Evocaton</set></setters>
	</element>
	<element name="Lonely Feature" type="Class Feature" source="Test" id="ID_TEST_LONELY">
		<description><p>Nobody grants me.</p></description>
	</element>`),
    ]);
    const errors = messages(result.issues, "error");
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ID_TEST_FEAT_BAD: requirements .* doesn't parse/),
        "ID_TEST_FEAT_BAD: grants ID_TEST_MISSING, which doesn't exist",
        'ID_TEST_FEAT_BAD: select "Typo Language" (type "Language", supports "Standrad") matches no elements',
        'ID_TEST_FEAT_BAD: select "Widget" chooses type "Widget", but no element has that type',
        'ID_TEST_SPELL_BAD: spell level setter must be 0-9 (found "first")',
      ]),
    );
    const warnings = messages(result.issues, "warning");
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ID_TEST_SPELL_BAD: school "Evocaton" isn't one of/),
        "ID_TEST_SPELL_BAD: spell has no time setter",
        "ID_TEST_LONELY: nothing grants or offers this element; it only shows up in the compendium",
      ]),
    );
    const grant = result.issues.find((i) => i.message.includes("ID_TEST_MISSING"))!;
    expect(grant).toMatchObject({ file: "custom/test.xml", line: 4 });
  });

  it("reports ids defined twice in the checked files and notes overrides of base content", () => {
    const feat = (desc: string) =>
      `<element name="Tester" type="Feat" source="Test" id="ID_TEST_FEAT_TWICE"><description><p>${desc}</p></description></element>`;
    const override = `<element name="Grappler" type="Feat" source="Test" id="ID_PHB_FEAT_GRAPPLER"><description><p>Full text.</p></description></element>`;
    const result = validateContent(base, [file(feat("one"), "custom/a.xml"), file(feat("two") + override, "custom/b.xml")]);
    expect(messages(result.issues, "error")).toEqual([
      "ID_TEST_FEAT_TWICE: id is defined more than once (custom/a.xml, custom/b.xml); the last one wins",
    ]);
    expect(result.overrides).toBe(1);
    expect(messages(result.issues, "info")).toEqual([": 1 element(s) replace elements with the same id from the base content"]);
  });

  it("builds subraces on a test character and reports choices that can't be filled", () => {
    const result = validateContent(base, [
      file(`
	<element name="Test Dwarf" type="Sub Race" source="Test" id="ID_TEST_SUB_RACE_TEST_DWARF">
		<supports>Dwarf</supports>
		<description><p>Test.</p></description>
		<rules>
			<select type="Feat" name="Test Feats" supports="ID_PHB_FEAT_GRAPPLER|ID_TEST_NO_SUCH_FEAT" number="3" />
		</rules>
	</element>`),
    ]);
    expect(result.builds).toBe(1);
    expect(messages(result.issues)).toEqual([
      'ID_TEST_SUB_RACE_TEST_DWARF: select "Test Feats" asks for 3 choices but only 1 element(s) match',
      'ID_TEST_SUB_RACE_TEST_DWARF: test character (Fighter 5): select "Test Feats" (level 1) could only fill 1 of 3 choices',
    ]);
  });
});

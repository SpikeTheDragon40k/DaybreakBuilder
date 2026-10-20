import { beforeAll, describe, expect, it } from "vitest";
import { buildSheet, ContentRegistry, importAuroraCharacter, resolveCharacter, selectionKey } from "../src/index.js";
import { auroraLegacyDir, coreDir, hasAuroraLegacy, loadDirs } from "./helpers.js";

// Shape of a character file written by Aurora (trimmed to what the importer reads).
const DND5E = `<?xml version="1.0" encoding="utf-8"?>
<character version="1.19.331" preview="false">
	<display-properties favorite="false"><name>Thorin</name><level>3</level></display-properties>
	<build>
		<input>
			<name>Thorin</name><gender>Male</gender><player-name>Ada</player-name><experience>900</experience>
			<currency><copper>5</copper><silver>0</silver><electrum>0</electrum><gold>12</gold><platinum>0</platinum></currency>
		</input>
		<appearance><age>80</age><height>4'5"</height><weight>160</weight><eyes>Brown</eyes><skin>Tan</skin><hair>Black</hair></appearance>
		<abilities available-points="0"><strength>15</strength><dexterity>12</dexterity><constitution>14</constitution><intelligence>13</intelligence><wisdom>10</wisdom><charisma>8</charisma></abilities>
		<elements level-count="3" registered-count="6">
			<element type="Option" name="Feats" id="ID_INTERNAL_OPTION_ALLOW_FEATS" />
			<element type="Level" name="1" id="ID_LEVEL_1" rndhp="10,7">
				<element type="Race" name="Race" requiredLevel="1" checksum="x" registered="ID_SRD_RACE_DWARF">
					<element type="Racial Trait" name="Dwarven Subrace" id="ID_RACIAL_TRAIT_DWARVEN_SUBRACE">
						<element type="Sub Race" name="Dwarven Subrace" requiredLevel="1" checksum="x" registered="ID_SUB_RACE_HILL_DWARF" />
					</element>
				</element>
				<element type="Class" name="Class" requiredLevel="1" checksum="x" registered="ID_WOTC_PHB_CLASS_FIGHTER">
					<element type="Proficiency" name="Skill Proficiency (Fighter)" requiredLevel="1" number="1" checksum="x" registered="ID_PROFICIENCY_SKILL_ATHLETICS" />
					<element type="Proficiency" name="Skill Proficiency (Fighter)" requiredLevel="1" number="2" checksum="x" registered="ID_PROFICIENCY_SKILL_PERCEPTION" />
				</element>
			</element>
			<element type="Level" name="2" id="ID_LEVEL_2" />
			<element type="Level" name="3" id="ID_LEVEL_3" multiclass="true" starting="true" rndhp="5" class="ID_WOTC_PHB_MULTICLASS_WIZARD">
				<element type="Multiclass" name="Multiclass (Level 3)" requiredLevel="3" checksum="x" registered="ID_WOTC_PHB_MULTICLASS_WIZARD" />
			</element>
		</elements>
		<equipment>
			<item identifier="a" name="Chain Mail" id="ID_WOTC_ARMOR_HEAVY_CHAIN_MAIL"><equipped location="Armor">true</equipped><details card="false"><name /><notes /></details></item>
			<item identifier="b" name="Rations" id="ID_UNKNOWN_RATIONS" amount="5"><details card="false"><name /><notes>Trail food</notes></details></item>
		</equipment>
	</build>
</character>`;

describe.skipIf(!hasAuroraLegacy)("Aurora .dnd5e import", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  it("maps levels, choices, abilities and inventory", () => {
    const { state, warnings } = importAuroraCharacter(DND5E, registry);
    expect(state.name).toBe("Thorin");
    expect(state.playerName).toBe("Ada");
    expect(state.details.hair).toBe("Black");
    expect(state.abilities.strength).toBe(15);
    expect(state.currency.gp).toBe(12);
    expect(state.levels).toEqual(["ID_WOTC_PHB_CLASS_FIGHTER", "ID_WOTC_PHB_CLASS_FIGHTER", "ID_WOTC_PHB_CLASS_WIZARD"]);
    expect(state.hitPoints.method).toBe("rolled");
    expect(state.hitPoints.rolls).toEqual({ 2: 7, 3: 5 });
    expect(state.options.ID_INTERNAL_OPTION_ALLOW_FEATS).toBe(true);
    expect(state.selections[selectionKey("ID_LEVEL_1", "Race")]).toEqual(["ID_SRD_RACE_DWARF"]);
    expect(state.selections[selectionKey("ID_LEVEL_1/ID_WOTC_PHB_CLASS_FIGHTER", "Skill Proficiency (Fighter)")]).toEqual([
      "ID_PROFICIENCY_SKILL_ATHLETICS",
      "ID_PROFICIENCY_SKILL_PERCEPTION",
    ]);
    expect(state.inventory[0]).toMatchObject({ id: "ID_WOTC_ARMOR_HEAVY_CHAIN_MAIL", equipped: "armor" });
    expect(state.inventory[1]).toMatchObject({ quantity: 5, notes: "Trail food" });
    expect(warnings.some((w) => w.includes("Rations"))).toBe(true);
  });

  it("resolves the imported character", () => {
    const { state } = importAuroraCharacter(DND5E, registry);
    const sheet = buildSheet(resolveCharacter(registry, state));
    expect(sheet.subrace).toBe("Hill Dwarf");
    expect(sheet.classSummary).toBe("Fighter 2 / Wizard 1");
    expect(sheet.skills.find((s) => s.name === "Athletics")?.proficient).toBe(true);
    expect(sheet.armorClass).toBe(16);
    // 10 + 7 + 5 rolled, +3 CON (16 → +3) per level, +1 per level from Dwarven Toughness.
    expect(sheet.maxHp).toBe(22 + 9 + 3);
  });
});

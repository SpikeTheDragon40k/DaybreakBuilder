#!/usr/bin/env node
/**
 * Generates content/srd/*.xml: the System Reference Document 5.1 (CC-BY-4.0)
 * as Aurora-format content. Element ids match the community content where the
 * same thing exists there, so characters stay valid when both are loaded.
 *
 * Run: node scripts/generate-srd.mjs
 */
import { join } from "node:path";
import { repoRoot, writeElementsFile } from "./lib/content.mjs";
import { FILE_INFO } from "./srd/common.mjs";
import { basics } from "./srd/basics.mjs";
import { races } from "./srd/races.mjs";
import { barbarian, fighter, monk, rogue } from "./srd/classes-martial.mjs";
import { paladin, ranger } from "./srd/classes-half.mjs";
import { bard, cleric, druid, sorcerer, warlock, wizard } from "./srd/classes-casters.mjs";
import { fightingStyles } from "./srd/options.mjs";
import { improvementOptions } from "./srd/class-builder.mjs";
import { backgrounds, feats } from "./srd/backgrounds-feats.mjs";
import { equipment } from "./srd/equipment.mjs";
import { spells } from "./srd/spells.mjs";

const out = (name) => join(repoRoot, "content", "srd", name);

writeElementsFile(out("basics.xml"), FILE_INFO("SRD 5.1: Basics", "Skills, saving throws, proficiencies, languages, alignments and senses."), basics());
writeElementsFile(out("races.xml"), FILE_INFO("SRD 5.1: Races", "Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc and Tiefling."), races());
writeElementsFile(out("class-options.xml"), FILE_INFO("SRD 5.1: Class Options", "Fighting styles and ability score improvement options."), [
  ...fightingStyles(),
  ...improvementOptions(),
]);
for (const [name, build] of Object.entries({ barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard })) {
  writeElementsFile(out(`classes/class-${name}.xml`), FILE_INFO(`SRD 5.1: ${name.charAt(0).toUpperCase() + name.slice(1)}`, `The ${name} class with its SRD subclass.`), build());
}
writeElementsFile(out("backgrounds.xml"), FILE_INFO("SRD 5.1: Backgrounds", "The Acolyte background."), backgrounds());
writeElementsFile(out("feats.xml"), FILE_INFO("SRD 5.1: Feats", "The Grappler feat."), feats());
writeElementsFile(out("equipment.xml"), FILE_INFO("SRD 5.1: Equipment", "Armor, weapons, adventuring gear, packs and tools."), equipment());
writeElementsFile(out("spells.xml"), FILE_INFO("SRD 5.1: Spells", "All spells from the SRD 5.1."), spells());

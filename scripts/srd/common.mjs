/** Shared constants for the SRD 5.1 content pack. */
export const SOURCE = "System Reference Document 5.1";

export const LICENSE =
  "This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast LLC, " +
  "available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative " +
  "Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode). " +
  "Text has been condensed and adapted for this application.";

export const FILE_INFO = (title, description) => ({
  title,
  description,
  author: "DaybreakBuilder contributors (SRD 5.1 content by Wizards of the Coast, CC-BY-4.0)",
  authorUrl: "https://github.com/SpikeTheDragon40k/DaybreakBuilder",
  license: LICENSE,
});

export const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];

export const classId = (c) => `ID_WOTC_PHB_CLASS_${c.toUpperCase()}`;
export const multiclassId = (c) => `ID_WOTC_PHB_MULTICLASS_${c.toUpperCase()}`;

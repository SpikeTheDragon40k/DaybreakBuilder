/** The SRD background (Acolyte) and feat (Grappler). */
import { element, grant, select } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";
import { skillId } from "./basics.mjs";

export function backgrounds() {
  return [
    element({
      name: "Acolyte",
      type: "Background",
      id: "ID_BACKGROUND_ACOLYTE",
      source: SOURCE,
      text: `You have spent your life in the service of a temple to a specific god or pantheon of gods, acting as an intermediary between the realm of the holy and the mortal world.

Skill Proficiencies: Insight, Religion. Languages: two of your choice. Equipment: a holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes and a pouch containing 15 gp.`,
      sheet: false,
      setters: [["short", "You have spent your life in the service of a temple."]],
      rules: [
        grant({ type: "Proficiency", id: skillId("Insight") }),
        grant({ type: "Proficiency", id: skillId("Religion") }),
        select({ type: "Language", name: "Languages (Acolyte)", supports: "Standard||Exotic", number: 2 }),
        grant({ type: "Background Feature", id: "ID_SRD_BACKGROUND_FEATURE_SHELTER_OF_THE_FAITHFUL" }),
      ],
    }),
    element({
      name: "Shelter of the Faithful",
      type: "Background Feature",
      id: "ID_SRD_BACKGROUND_FEATURE_SHELTER_OF_THE_FAITHFUL",
      source: SOURCE,
      text: "You command the respect of those who share your faith, and you can perform the religious ceremonies of your deity. You and your companions can expect free healing and care at a temple, shrine or other established presence of your faith. You might also have ties to a specific temple where you have a residence.",
      sheet: "You and your companions can receive free healing and care at temples of your faith, and those who share your faith will support you at a modest lifestyle.",
    }),
  ];
}

export function feats() {
  return [
    element({
      name: "Grappler",
      type: "Feat",
      id: "ID_PHB_FEAT_GRAPPLER",
      source: SOURCE,
      prerequisite: "Strength 13 or higher",
      requirements: "[str:13]",
      text: "You’ve developed the skills necessary to hold your own in close-quarters grappling. You have advantage on attack rolls against a creature you are grappling, and you can use your action to try to pin a creature grappled by you: make another grapple check, and if you succeed, you and the creature are both restrained until the grapple ends.",
      sheet: "Advantage on attacks against a creature you are grappling; you can use your action to try to pin a grappled creature (both restrained).",
    }),
  ];
}

/** Choices shared by several classes. */
import { element, stat } from "../lib/content.mjs";
import { SOURCE } from "./common.mjs";

const STYLES = [
  ["Archery", "You gain a +2 bonus to attack rolls you make with ranged weapons.", ["Fighter", "Ranger"], [stat({ name: "ranged:attack", value: 2, alt: "Archery" })]],
  [
    "Defense",
    "While you are wearing armor, you gain a +1 bonus to AC.",
    ["Fighter", "Paladin", "Ranger"],
    [stat({ name: "ac:misc", value: 1, equipped: "[armor:any]", alt: "Defense" })],
  ],
  ["Dueling", "When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.", ["Fighter", "Paladin", "Ranger"], []],
  [
    "Great Weapon Fighting",
    "When you roll a 1 or 2 on a damage die for an attack with a melee weapon you are wielding with two hands, you can reroll the die and must use the new roll. The weapon must have the two-handed or versatile property.",
    ["Fighter", "Paladin"],
    [],
  ],
  [
    "Protection",
    "When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.",
    ["Fighter", "Paladin"],
    [],
  ],
  ["Two-Weapon Fighting", "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.", ["Fighter", "Ranger"], []],
];

export function fightingStyles() {
  return STYLES.map(([name, text, classes, rules]) =>
    element({
      name,
      type: "Class Feature",
      id: `ID_SRD_FIGHTING_STYLE_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`,
      source: SOURCE,
      supports: ["Fighting Style", ...classes],
      text,
      sheet: text,
      rules,
    }),
  );
}

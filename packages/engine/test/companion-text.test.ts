import { describe, expect, it } from "vitest";
import { companionText, StatValues } from "../src/index.js";

const stats = new StatValues({
  contributions: [{ stat: "proficiency", value: "3", source: "test" }],
  seeds: [],
  baseAbilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 8, wisdom: 16, charisma: 6 },
  useAbilityMaximum: true,
});
const owner = { stats, classLevels: new Map([["ranger", 5]]), spellAttack: 6, spellDc: 14 };

describe("companionText", () => {
  it("fills in the character's numbers", () => {
    expect(companionText("Melee Attack Roll: Your spell attack modifier to hit. Hit: 1d8 + 2 + your Wisdom modifier Piercing damage.", owner)).toBe(
      "Melee Attack Roll: +6 to hit. Hit: 1d8 + 5 Piercing damage.",
    );
    expect(companionText("escape DC equals your spell save DC", owner)).toBe("escape DC equals 14");
    expect(companionText("Hit: 1d6 + PB fire damage.", owner)).toBe("Hit: 1d6 + 3 fire damage.");
    expect(companionText("Dex +1 plus PB, Perception +0 plus PB × 2", owner)).toBe("Dex +4, Perception +6");
    expect(companionText("5 + five times your ranger level", owner)).toBe("5 + five times 5");
  });

  it("handles negative modifiers", () => {
    expect(companionText("Hit: 1d4 + your Charisma modifier damage", owner)).toBe("Hit: 1d4 - 2 damage");
    expect(companionText("Hit: 1d4 + 1 + your Charisma modifier damage", owner)).toBe("Hit: 1d4 - 1 damage");
  });

  it("leaves what it can't work out and ordinary numbers alone", () => {
    expect(companionText("your spell attack modifier", { stats, classLevels: new Map() })).toBe("your spell attack modifier");
    expect(companionText("your wizard level", owner)).toBe("your wizard level");
    expect(companionText("Recharge 5-6. Range 30/120 ft. Hit: 7 (2d4 + 2)", owner)).toBe("Recharge 5-6. Range 30/120 ft. Hit: 7 (2d4 + 2)");
  });
});

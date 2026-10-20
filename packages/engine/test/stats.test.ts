import { describe, expect, it } from "vitest";
import { StatValues, type StatContribution } from "../src/index.js";

const base = { strength: 10, dexterity: 14, constitution: 12, intelligence: 8, wisdom: 13, charisma: 15 };

function stats(contributions: Partial<StatContribution>[], seeds: { stat: string; value: number }[] = []) {
  return new StatValues({
    contributions: contributions.map((c) => ({ source: "test", value: "0", stat: "x", ...c })),
    seeds: seeds.map((s) => ({ ...s, source: "seed" })),
    baseAbilities: base,
    useAbilityMaximum: true,
  });
}

describe("StatValues", () => {
  it("sums plain contributions and references", () => {
    const s = stats([
      { stat: "proficiency", value: "2" },
      { stat: "athletics:proficiency", value: "proficiency", bonus: "proficiency" },
      { stat: "athletics:misc", value: "1" },
    ]);
    expect(s.get("athletics:proficiency")).toBe(2);
    expect(s.get("athletics:misc")).toBe(1);
  });

  it("takes only the highest value per bonus type", () => {
    const s = stats([
      { stat: "speed", value: "30", bonus: "base" },
      { stat: "speed", value: "25", bonus: "base" },
      { stat: "speed", value: "10" },
    ]);
    expect(s.get("speed")).toBe(40);
  });

  it("stacks different bonus types (expertise doubles proficiency)", () => {
    const s = stats([
      { stat: "proficiency", value: "3" },
      { stat: "stealth:proficiency", value: "proficiency", bonus: "proficiency" },
      { stat: "stealth:proficiency", value: "proficiency", bonus: "double" },
    ]);
    expect(s.get("stealth:proficiency")).toBe(6);
  });

  it("computes ability scores, maximums and modifiers", () => {
    const s = stats([
      { stat: "strength", value: "2" },
      { stat: "charisma", value: "6" },
      { stat: "charisma:max", value: "20" },
    ]);
    expect(s.abilityScore("strength")).toBe(12);
    expect(s.abilityModifier("strength")).toBe(1);
    expect(s.abilityScore("charisma")).toBe(20);
    expect(s.abilityModifier("intelligence")).toBe(-1);
  });

  it("supports caps referencing other stats and negative references", () => {
    const s = stats([
      { stat: "cap", value: "2" },
      { stat: "ac:dex", value: "dexterity:modifier", maximum: "cap" },
      { stat: "neg", value: "-dexterity:modifier" },
    ]);
    expect(s.get("ac:dex")).toBe(2);
    expect(s.get("neg")).toBe(-2);
  });

  it("derives :half and :half:up", () => {
    const s = stats([], [{ stat: "level", value: 5 }]);
    expect(s.get("level:half")).toBe(2);
    expect(s.get("level:half:up")).toBe(3);
  });

  it("merges positive AC components", () => {
    const s = stats([
      { stat: "ac:calculation", value: "13", bonus: "calculation" },
      { stat: "ac:calculation", value: "12", bonus: "calculation" },
      { stat: "ac:shield", value: "2" },
      { stat: "ac:misc", value: "-1" },
    ]);
    expect(s.get("ac")).toBe(15);
  });

  it("survives reference cycles", () => {
    const s = stats([
      { stat: "a", value: "b" },
      { stat: "b", value: "a" },
    ]);
    expect(s.get("a")).toBe(0);
  });
});

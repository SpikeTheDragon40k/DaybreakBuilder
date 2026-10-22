import { describe, expect, it } from "vitest";
import { challengeXp, encounterBudget, encounterMultiplier, normalizeChallenge, rateEncounter } from "../src/index.js";

describe("encounters", () => {
  it("reads challenge ratings in any common spelling", () => {
    expect(normalizeChallenge("1/4")).toBe("1/4");
    expect(normalizeChallenge("0.5")).toBe("1/2");
    expect(normalizeChallenge("CR 5")).toBe("5");
    expect(normalizeChallenge("2 (450 XP)")).toBe("2");
    expect(normalizeChallenge("31")).toBe("");
    expect(challengeXp("1/8")).toBe(25);
    expect(challengeXp("30")).toBe(155000);
  });

  it("adds up the 2024 XP budget per character level", () => {
    expect(encounterBudget([1, 1, 1, 1], "2024")).toEqual({ low: 200, moderate: 300, high: 400 });
    expect(encounterBudget([5, 5, 5, 5], "2024")).toEqual({ low: 2000, moderate: 3000, high: 4400 });
    expect(encounterBudget([20], "2024")).toEqual({ low: 6400, moderate: 13200, high: 22000 });
  });

  it("adds up the 2014 thresholds per character level", () => {
    expect(encounterBudget([1, 1, 1, 1], "2014")).toEqual({ easy: 100, medium: 200, hard: 300, deadly: 400 });
    expect(encounterBudget([5, 3], "2014")).toEqual({ easy: 325, medium: 650, hard: 975, deadly: 1500 });
    // Out-of-range levels are clamped.
    expect(encounterBudget([0, 25], "2014")).toEqual(encounterBudget([1, 20], "2014"));
  });

  it("applies the 2014 multiplier by monster count and party size", () => {
    expect(encounterMultiplier(1, 4)).toBe(1);
    expect(encounterMultiplier(2, 4)).toBe(1.5);
    expect(encounterMultiplier(6, 4)).toBe(2);
    expect(encounterMultiplier(10, 4)).toBe(2.5);
    expect(encounterMultiplier(14, 4)).toBe(3);
    expect(encounterMultiplier(15, 4)).toBe(4);
    // Small parties step up, big parties step down.
    expect(encounterMultiplier(1, 2)).toBe(1.5);
    expect(encounterMultiplier(15, 1)).toBe(5);
    expect(encounterMultiplier(1, 6)).toBe(0.5);
  });

  it("rates a 2024 encounter by summing XP against the budget", () => {
    // Four level-3 characters: Low 600, Moderate 900, High 1600.
    const levels = [3, 3, 3, 3];
    const goblins = (count: number) => [{ cr: "1/4", count }];
    expect(rateEncounter(levels, [], "2024").difficulty).toBe("trivial");
    expect(rateEncounter(levels, goblins(8), "2024")).toMatchObject({ totalXp: 400, difficulty: "trivial", toNext: 200 });
    expect(rateEncounter(levels, goblins(12), "2024")).toMatchObject({ difficulty: "low", toNext: 300 });
    expect(rateEncounter(levels, [{ cr: "3", count: 2 }], "2024")).toMatchObject({ totalXp: 1400, difficulty: "moderate" });
    expect(rateEncounter(levels, [{ cr: "5", count: 1 }], "2024")).toMatchObject({ difficulty: "high", overBudget: true, highestCr: 5 });
  });

  it("rates a 2014 encounter with the multiplier", () => {
    // Four level-3 characters: 300 / 600 / 900 / 1600. Four orcs: 400 XP × 2.
    const r = rateEncounter([3, 3, 3, 3], [{ name: "Orc", cr: "1/2", count: 4 }], "2014");
    expect(r).toMatchObject({ totalXp: 400, multiplier: 2, adjustedXp: 800, difficulty: "medium", toNext: 100 });
    // A custom XP value wins over the CR.
    expect(rateEncounter([1], [{ cr: "1", xp: 10, count: 1 }], "2014").totalXp).toBe(10);
  });
});

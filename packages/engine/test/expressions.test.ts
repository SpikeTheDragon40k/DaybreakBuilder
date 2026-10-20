import { describe, expect, it } from "vitest";
import { evaluateString, matchesSupports, parseBracket } from "../src/index.js";

const has = (ids: string[]) => (id: string) => ids.includes(id);

describe("requirements expressions", () => {
  it("handles ids, negation, and/or and grouping", () => {
    expect(evaluateString("ID_A", { id: has(["ID_A"]) })).toBe(true);
    expect(evaluateString("!ID_A", { id: has(["ID_A"]) })).toBe(false);
    expect(evaluateString("ID_A,ID_B", { id: has(["ID_A"]) })).toBe(false);
    expect(evaluateString("ID_A||ID_B", { id: has(["ID_B"]) })).toBe(true);
    expect(evaluateString("!(ID_A||ID_B)", { id: has([]) })).toBe(true);
    expect(evaluateString("ID_A&amp;&amp;ID_B", { id: has(["ID_A", "ID_B"]) })).toBe(true);
    // AND binds tighter than OR.
    expect(evaluateString("ID_A||ID_B,ID_C", { id: has(["ID_A"]) })).toBe(true);
    expect(evaluateString("(ID_A||ID_B),ID_C", { id: has(["ID_A"]) })).toBe(false);
  });

  it("delegates bracket checks", () => {
    const seen: string[] = [];
    const ok = evaluateString("(([str:13]||[dex:13]),!ID_X)||ID_Y", {
      id: has([]),
      bracket: (k, v) => {
        seen.push(`${k}=${v}`);
        return k === "dex" && Number(v) <= 14;
      },
    });
    expect(ok).toBe(true);
    expect(seen).toEqual(["str=13", "dex=13"]);
  });

  it("parses multi-part bracket keys", () => {
    expect(parseBracket("level:fighter:3")).toEqual({ key: "level:fighter", value: "3" });
    expect(parseBracket("armor:none")).toEqual({ key: "armor", value: "none" });
  });

  it("treats malformed expressions as unmet", () => {
    expect(evaluateString("(ID_A", { id: has(["ID_A"]) })).toBe(false);
  });
});

describe("supports matching", () => {
  const el = { id: "ID_ATHLETICS", supports: ["Skill", "Strength", "Fighter"] };
  it("matches keyword expressions", () => {
    expect(matchesSupports("Skill,Fighter", el)).toBe(true);
    expect(matchesSupports("Skill,Rogue", el)).toBe(false);
    expect(matchesSupports("Weapon||Skill", el)).toBe(true);
    expect(matchesSupports(undefined, el)).toBe(true);
  });
  it("matches id ranges", () => {
    expect(matchesSupports("ID_X|ID_ATHLETICS", el)).toBe(true);
    expect(matchesSupports("ID_X|ID_Y", el)).toBe(false);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionKey } from "@daybreakbuilder/engine";
import { describe, expect, it } from "vitest";
import { cleanSavedEncounters, combatForEncounter, currencyInGp, formatGp, lineFromTemplate, memberFromSheet, summarizeParty, templateForLine, type PartyMember } from "../src/state/party";

const root = join(import.meta.dirname, "..", "..", "..", "content");

function load(): ContentRegistry {
  const reg = new ContentRegistry();
  const walk = (d: string) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith(".xml")) reg.addXml(readFileSync(p, "utf8"), p);
    }
  };
  walk(join(root, "core"));
  walk(join(root, "srd"));
  reg.finalize();
  return reg;
}

describe("party", () => {
  const registry = load();

  function member(name: string, race: string, cls: string, level: number, gp = 0) {
    const s = newCharacter();
    s.name = name;
    s.abilities = { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 10 };
    s.levels = Array(level).fill(cls);
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = [race];
    s.currency.gp = gp;
    return memberFromSheet(name, s, buildSheet(resolveCharacter(registry, s)));
  }

  it("converts coin to gold", () => {
    expect(currencyInGp({ cp: 150, sp: 5, ep: 2, gp: 10, pp: 1 })).toBeCloseTo(23);
    expect(formatGp(12.5)).toBe("12.5 gp");
  });

  it("summarizes members for the DM", () => {
    const party = [
      member("Thora", "ID_RACE_HUMAN", "ID_WOTC_PHB_CLASS_FIGHTER", 3, 10),
      member("Ilien", "ID_RACE_ELF", "ID_WOTC_PHB_CLASS_CLERIC", 2, 5),
    ];
    const [thora, ilien] = party;
    expect(thora.level).toBe(3);
    expect(thora.armorClass).toBeGreaterThan(0);
    expect(thora.maxHp).toBeGreaterThan(0);
    expect(ilien.spellDcs.length).toBe(1);
    expect(thora.spellDcs).toEqual([]);

    const sum = summarizeParty(party);
    expect(sum.size).toBe(2);
    expect(sum.averageLevel).toBe(2.5);
    expect(sum.wealthGp).toBe(15);
    // Elves have darkvision, humans don't.
    expect(sum.noDarkvision).toEqual(["Thora"]);
    // Common is spoken by everyone and listed first.
    expect(sum.languages[0]).toEqual({ name: "Common", speakers: ["Thora", "Ilien"] });
    expect(sum.saves.find((s) => s.ability === "wisdom")?.proficient).toEqual(["Ilien"]);
    expect(sum.skills.map((k) => k.name)).toContain("Perception");
    expect(sum.passivePerception.value).toBe(Math.max(thora.passivePerception, ilien.passivePerception));
  });

  it("handles an empty party", () => {
    const sum = summarizeParty([]);
    expect(sum.size).toBe(0);
    expect(sum.averageLevel).toBe(0);
    expect(sum.skills).toEqual([]);
  });
});

describe("saved encounters", () => {
  const goblin = { elementId: "ID_GOBLIN", name: "Goblin", source: "SRD", challenge: "1/4", ac: 15, hp: 7, initiativeBonus: 2 };
  const member = { id: "c1", name: "Mira", armorClass: 13, initiative: 3 } as PartyMember;

  it("makes encounter lines from picked monsters and finds them again by id", () => {
    const line = lineFromTemplate("l1", goblin);
    expect(line).toEqual({ id: "l1", name: "Goblin", cr: "1/4", xp: 0, count: 1, elementId: "ID_GOBLIN" });
    expect(templateForLine({ ...line, name: "Sneaky goblin" }, [goblin])).toBe(goblin);
    expect(templateForLine({ id: "x", name: "goblin ", cr: "1", xp: 0, count: 1 }, [goblin])).toBe(goblin);
  });

  it("starts a combat with the party and the encounter's monsters", () => {
    let n = 0;
    const id = () => `id${n++}`;
    const lines = [lineFromTemplate("l1", goblin), { id: "l2", name: "Bandit chief", cr: "2", xp: 0, count: 1 }, { id: "l3", name: "", cr: "1", xp: 0, count: 3 }];
    lines[0].count = 2;
    const c = combatForEncounter("Ambush", [member], lines, [goblin], id);
    expect(c.round).toBe(0);
    expect(c.combatants.map((x) => x.name)).toEqual(["Mira", "Goblin A", "Goblin B", "Bandit chief"]);
    expect(c.combatants.find((x) => x.name === "Goblin A")?.ac).toBe(15);
    expect(c.log.at(-1)).toMatch(/Ambush/);
  });

  it("cleans saved encounters read from a file", () => {
    expect(cleanSavedEncounters("nope")).toEqual([]);
    expect(cleanSavedEncounters([{ id: "e", monsters: [{ name: "Orc", count: 2 }, null] }, { name: "no id" }])).toEqual([
      { id: "e", name: "Encounter", notes: "", monsters: [{ name: "Orc", count: 2 }] },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  addMonsters,
  concentrationDc,
  ContentRegistry,
  damageMonster,
  healMonster,
  monsterLetter,
  monsterTemplates,
  newCombat,
  newCombatant,
  nextTurn,
  previousTurn,
  turnOrder,
  updateCombatant,
  type Combat,
} from "../src/index.js";

let n = 0;
const id = () => `c${++n}`;

function combat(): Combat {
  return {
    ...newCombat(),
    combatants: [
      newCombatant("fighter", { kind: "character", name: "Fighter", initiative: 15, initiativeBonus: 1 }),
      newCombatant("wizard", { kind: "character", name: "Wizard", initiative: 15, initiativeBonus: 3 }),
      newCombatant("ogre", { kind: "monster", name: "Ogre", initiative: 8, maxHp: 59, hp: 59, legendary: { max: 2, used: 2 } }),
      newCombatant("late", { kind: "monster", name: "Late", initiative: null }),
    ],
  };
}

describe("initiative tracker", () => {
  it("orders by initiative, then bonus; missing initiative goes last", () => {
    expect(turnOrder(combat().combatants).map((x) => x.id)).toEqual(["wizard", "fighter", "ogre", "late"]);
  });

  it("runs turns and rounds, skipping creatures without initiative or defeated", () => {
    let c = nextTurn(combat());
    expect([c.round, c.turnId]).toEqual([1, "wizard"]);
    c = nextTurn(nextTurn(c));
    expect([c.round, c.turnId]).toEqual([1, "ogre"]);
    c = nextTurn(c);
    expect([c.round, c.turnId]).toEqual([2, "wizard"]);
    expect(c.log).toContain("Round 2.");
    c = updateCombatant(c, "fighter", (x) => ({ ...x, defeated: true }));
    expect(nextTurn(c).turnId).toBe("ogre");
    expect(previousTurn(c).turnId).toBe("ogre"); // back into round 1's last turn
    expect(previousTurn(c).round).toBe(1);
  });

  it("counts condition durations down at the start of the creature's turn and resets legendary actions", () => {
    let c = updateCombatant(combat(), "ogre", (x) => ({ ...x, conditions: [{ name: "Stunned", rounds: 1 }, { name: "Prone" }, { name: "Frightened", rounds: 2 }] }));
    c = nextTurn(nextTurn(nextTurn(c))); // ogre's turn
    const ogre = c.combatants.find((x) => x.id === "ogre")!;
    expect(ogre.conditions).toEqual([{ name: "Prone" }, { name: "Frightened", rounds: 1 }]);
    expect(ogre.legendary).toEqual({ max: 2, used: 0 });
    expect(c.log.at(-1)).toBe("Ogre: Stunned ended.");
  });

  it("damages and heals monsters, with concentration saves", () => {
    let c = updateCombatant(combat(), "ogre", (x) => ({ ...x, tempHp: 5, concentrating: true }));
    c = damageMonster(c, "ogre", 25);
    expect(c.combatants.find((x) => x.id === "ogre")).toMatchObject({ hp: 39, tempHp: 0 });
    expect(c.log.at(-1)).toBe("Ogre takes 25 damage (39/59 HP); Constitution save DC 12 to keep concentrating.");
    c = damageMonster(c, "ogre", 100);
    expect(c.combatants.find((x) => x.id === "ogre")).toMatchObject({ hp: 0, defeated: true });
    c = healMonster(c, "ogre", 10);
    expect(c.combatants.find((x) => x.id === "ogre")).toMatchObject({ hp: 10, defeated: false });
    expect([concentrationDc(5), concentrationDc(31), concentrationDc(200)]).toEqual([10, 15, 30]);
  });

  it("labels several monsters of a kind with letters", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(monsterLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
    const goblin = { name: "Goblin", ac: 15, hp: 7, initiativeBonus: 2 };
    let c = addMonsters(newCombat(), goblin, 1, id);
    expect(c.combatants.map((x) => x.name)).toEqual(["Goblin"]);
    c = addMonsters(c, goblin, 2, id);
    expect(c.combatants.map((x) => x.name)).toEqual(["Goblin A", "Goblin B", "Goblin C"]);
    c = addMonsters(c, goblin, 1, id);
    expect(c.combatants.at(-1)!.name).toBe("Goblin D");
    expect(addMonsters(newCombat(), goblin, 3, id).combatants.map((x) => x.name)).toEqual(["Goblin A", "Goblin B", "Goblin C"]);
    expect(c.combatants[0]).toMatchObject({ ac: 15, hp: 7, maxHp: 7, initiativeBonus: 2 });
  });

  it("reads monsters from creatures and text stat blocks in the content", () => {
    const r = new ContentRegistry();
    r.addXml(
      `<elements>
        <element name="Wolf" type="Companion" source="MM" id="ID_WOLF"><setters>
          <set name="ac">13 (natural armor)</set><set name="hp">11 (2d8+2)</set><set name="dexterity">15</set><set name="challenge">1/4</set>
        </setters></element>
        <element name="Ogre" type="Information" source="MM" id="ID_OGRE_STATBLOCK"><description>
          <ul><li><b>AC</b> 11</li><li><b>Initiative</b> −1 (9)</li><li><b>HP</b> 68 (8d10 + 24)</li></ul><ul><li><b>CR</b> 2 (XP 450; PB +2)</li></ul>
        </description></element>
        <element name="Lore" type="Information" source="MM" id="ID_LORE"><description><p>Not a stat block.</p></description></element>
      </elements>`,
    );
    r.finalize();
    expect(monsterTemplates(r)).toEqual([
      { elementId: "ID_OGRE_STATBLOCK", name: "Ogre", source: "MM", challenge: "2", ac: 11, hp: 68, initiativeBonus: -1 },
      { elementId: "ID_WOLF", name: "Wolf", source: "MM", challenge: "1/4", ac: 13, hp: 11, initiativeBonus: 2 },
    ]);
  });
});

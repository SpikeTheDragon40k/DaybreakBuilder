import { beforeAll, describe, expect, it } from "vitest";
import {
  averageWealth,
  buildSheet,
  backgroundGold,
  clearStartingWealth,
  coinWeight,
  consolidateCurrency,
  ContentRegistry,
  currencyValue,
  emptyCurrency,
  formatCurrency,
  formatPrice,
  itemCost,
  newCharacter,
  parseWealth,
  resolveCharacter,
  rollWealth,
  selectionKey,
  spendCurrency,
  startingWealth,
  takeStartingWealth,
  type Currency,
  type ElementDef,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const purse = (c: Partial<Currency>): Currency => ({ ...emptyCurrency(), ...c });

const FIXTURE = `<elements>
  <element name="Fighter" type="Class" source="Test Handbook 2024" id="ID_TEST24_CLASS_FIGHTER">
    <description><p>A fighter.</p></description>
    <setters><set name="hd">d10</set></setters>
  </element>
  <element name="Sage" type="Background" source="Test Handbook 2024" id="ID_TEST24_BACKGROUND_SAGE">
    <description><p>Ability Scores: Constitution, Intelligence, Wisdom.</p><p>Equipment: Choose A or B: (A) Quarterstaff, Calligrapher's Supplies, Book (history), Parchment (8 sheets), Robe, 8 GP; or (B) 50 GP</p></description>
  </element>
  <element name="Sailor" type="Background" source="Test Book" id="ID_TEST_BACKGROUND_SAILOR">
    <description><p>Skill Proficiencies: Athletics, Perception.</p><p>Equipment: A belaying pin (club), 50 feet of silk rope, a lucky charm, a set of common clothes, and a belt pouch containing 10 gp.</p><p>Feature: Ship's Passage. Worth 100 gp of favours.</p></description>
  </element>
</elements>`;

describe("currency", () => {
  it("values and formats coins", () => {
    const c = purse({ pp: 1, gp: 12, ep: 1, sp: 3, cp: 4 });
    expect(currencyValue(c)).toBe(1000 + 1200 + 50 + 30 + 4);
    expect(formatCurrency(c)).toBe("1 pp, 12 gp, 1 ep, 3 sp, 4 cp");
    expect(formatCurrency(emptyCurrency())).toBe("0 gp");
    expect(formatPrice(1500)).toBe("15 gp");
    expect(formatPrice(150000)).toBe("1,500 gp");
    expect(formatPrice(1234)).toBe("12.34 gp");
    expect(formatPrice(50)).toBe("5 sp");
    expect(formatPrice(3)).toBe("3 cp");
    expect(coinWeight(purse({ gp: 100 }))).toBe(2);
  });

  it("reads item prices", () => {
    const item = (value: string, currency?: string) =>
      ({ setters: [{ name: "cost", value, attrs: currency ? { currency } : {} }] }) as unknown as ElementDef;
    expect(itemCost(item("5", "gp"))).toBe(500);
    expect(itemCost(item("2", "sp"))).toBe(20);
    expect(itemCost(item("1,500", "gp"))).toBe(150000);
    expect(itemCost(item("10 gp"))).toBe(1000);
    expect(itemCost(item("—"))).toBeUndefined();
    expect(itemCost({ setters: [] } as unknown as ElementDef)).toBeUndefined();
  });

  it("pays with the largest coins that fit and gives change", () => {
    expect(spendCurrency(purse({ gp: 10, sp: 5 }), 500)).toEqual(purse({ gp: 5, sp: 5 }));
    expect(spendCurrency(purse({ gp: 10, sp: 5 }), 20)).toEqual(purse({ gp: 10, sp: 3 }));
    // 2 sp from 1 gp: break the gold piece, change in silver.
    expect(spendCurrency(purse({ gp: 1 }), 20)).toEqual(purse({ sp: 8 }));
    // 2.5 gp with only platinum: change 7 gp 5 sp.
    expect(spendCurrency(purse({ pp: 1 }), 250)).toEqual(purse({ gp: 7, sp: 5 }));
    // Copper first fails to cover it, so the smallest coin left (sp) is broken.
    expect(spendCurrency(purse({ sp: 3, cp: 2 }), 25)).toEqual(purse({ cp: 7 }));
    expect(spendCurrency(purse({ gp: 1 }), 101)).toBeNull();
    for (const [c, cost] of [
      [purse({ pp: 2, gp: 3, ep: 3, sp: 9, cp: 11 }), 1777],
      [purse({ ep: 5 }), 120],
    ] as const) {
      const after = spendCurrency(c, cost)!;
      expect(currencyValue(after)).toBe(currencyValue(c) - cost);
    }
  });

  it("exchanges loose coins up into gold", () => {
    expect(consolidateCurrency(purse({ cp: 250, sp: 25, ep: 3, gp: 1, pp: 2 }))).toEqual(purse({ gp: 7, sp: 5, pp: 2 }));
    expect(consolidateCurrency(purse({ cp: 7, sp: 13 }))).toEqual(purse({ gp: 1, sp: 3, cp: 7 }));
  });
});

describe("starting wealth", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
    registry.addXml(FIXTURE, "starting-wealth.xml");
    registry.finalize();
  });

  const character = (cls: string, background?: string) => {
    const s = newCharacter();
    s.levels = [cls];
    if (background) s.selections[selectionKey("ID_LEVEL_1", "Background")] = [background];
    return s;
  };

  it("parses and averages wealth dice", () => {
    expect(parseWealth("5d4x10")).toEqual({ count: 5, sides: 4, multiplier: 10 });
    expect(parseWealth("5d4 × 10 gp")).toEqual({ count: 5, sides: 4, multiplier: 10 });
    expect(parseWealth("155")).toMatchObject({ fixed: 155 });
    expect(parseWealth("lots")).toBeUndefined();
    expect(averageWealth(parseWealth("5d4x10")!)).toBe(120);
    expect(averageWealth(parseWealth("5d4")!)).toBe(12);
    const max = rollWealth(parseWealth("5d4x10")!, () => 0.999);
    expect(max).toEqual({ gp: 200, rolls: [4, 4, 4, 4, 4] });
    expect(rollWealth(parseWealth("2d4x10")!, () => 0).gp).toBe(20);
  });

  it("reads background gold from the setter or the equipment text", () => {
    expect(backgroundGold(registry.get("ID_BACKGROUND_ACOLYTE")!)).toEqual({ withEquipment: 15 });
    expect(backgroundGold(registry.get("ID_TEST_BACKGROUND_SAILOR")!)).toEqual({ withEquipment: 10 });
    expect(backgroundGold(registry.get("ID_TEST24_BACKGROUND_SAGE")!)).toEqual({ withEquipment: 8, instead: 50 });
  });

  it("offers 2014 equipment, rolled or average gold", () => {
    const rc = resolveCharacter(registry, character("ID_WOTC_PHB_CLASS_FIGHTER", "ID_BACKGROUND_ACOLYTE"));
    const w = startingWealth(rc);
    expect(w.rules).toBe("2014");
    expect(w.className).toBe("Fighter");
    expect(w.backgroundName).toBe("Acolyte");
    expect(w.options.map((o) => [o.key, o.gp])).toEqual([
      ["equipment", 15],
      ["roll", 0],
      ["average", 120],
    ]);
  });

  it("offers 2024 class and background gold separately", () => {
    const rc = resolveCharacter(registry, character("ID_TEST24_CLASS_FIGHTER", "ID_TEST24_BACKGROUND_SAGE"));
    const w = startingWealth(rc);
    expect(w.rules).toBe("2024");
    expect(w.options.map((o) => [o.key, o.gp])).toEqual([
      ["equipment", 8],
      ["class-gold", 163],
      ["background-gold", 50],
      ["all-gold", 205],
    ]);
  });

  it("lists unchosen starting wealth as an open choice for a new character", () => {
    const s = character("ID_WOTC_PHB_CLASS_FIGHTER", "ID_BACKGROUND_ACOLYTE");
    expect(buildSheet(resolveCharacter(registry, s)).warnings).toContain("Starting wealth: not chosen");
    takeStartingWealth(s, startingWealth(resolveCharacter(registry, s)).options[0]);
    expect(buildSheet(resolveCharacter(registry, s)).warnings).not.toContain("Starting wealth: not chosen");
  });

  it("grants starting gold once and can take it back", () => {
    const s = character("ID_WOTC_PHB_CLASS_FIGHTER", "ID_BACKGROUND_ACOLYTE");
    s.currency.sp = 4;
    const options = startingWealth(resolveCharacter(registry, s)).options;
    const roll = options.find((o) => o.key === "roll")!;
    expect(takeStartingWealth(s, roll, () => 0.5)).toEqual({ option: "roll", gp: 150, rolls: [3, 3, 3, 3, 3] });
    expect(s.currency).toEqual(purse({ gp: 150, sp: 4 }));
    // Changing the choice replaces the earlier gold rather than adding to it.
    takeStartingWealth(s, options.find((o) => o.key === "average")!);
    expect(s.currency).toEqual(purse({ gp: 120, sp: 4 }));
    clearStartingWealth(s);
    expect(s.currency).toEqual(purse({ sp: 4 }));
    expect(s.startingWealth).toBeUndefined();
  });
});

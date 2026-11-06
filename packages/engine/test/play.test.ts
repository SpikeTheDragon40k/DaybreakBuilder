import { beforeAll, describe, expect, it } from "vitest";
import {
  buildSheet,
  ContentRegistry,
  currentHp,
  damageRoll,
  damageTotal,
  exhaustionPenalty,
  gainTempHp,
  heal,
  hitDiceLeft,
  loadCharacterJson,
  longRest,
  newCharacter,
  newPlayState,
  playResources,
  resolveAttack,
  resolveCharacter,
  selectionKey,
  shortRest,
  slotKey,
  slotsLeft,
  spendHitDie,
  takeDamage,
  usesLeft,
  type AttackRow,
  type CharacterSheet,
  type PlayState,
} from "../src/index.js";
import { coreDir, loadDirs, srdDir } from "./helpers.js";

const CLASS = (c: string) => `ID_WOTC_PHB_CLASS_${c.toUpperCase()}`;

describe("play mode", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, srdDir);
  });

  function sheetFor(levels: string[], inventory: { id: string; equipped?: "main" }[] = []): CharacterSheet {
    const s = newCharacter();
    s.abilities = { strength: 16, dexterity: 14, constitution: 14, intelligence: 14, wisdom: 14, charisma: 14 };
    s.levels = levels.map(CLASS);
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_HUMAN"];
    s.inventory = inventory.map((i, n) => ({ uid: String(n), quantity: 1, ...i }));
    return buildSheet(resolveCharacter(registry, s));
  }

  it("finds features with limited uses and when they come back", () => {
    const res = playResources(sheetFor(Array(5).fill("Fighter")));
    const byName = Object.fromEntries(res.features.map((f) => [f.name, f]));
    expect(byName["Second Wind"]).toMatchObject({ max: 1, recharge: "short" });
    expect(byName["Action Surge"]).toMatchObject({ max: 1, recharge: "short" });
    expect(res.hitDice).toEqual([{ die: "d10", total: 5 }]);
    expect(res.slots).toEqual([]);
  });

  it("tracks spell slots, with Pact Magic coming back on a Short Rest", () => {
    const wizard = playResources(sheetFor(Array(3).fill("Wizard")));
    expect(wizard.slots).toEqual([{ key: "Wizard", label: "Spell slots", slots: [4, 2, 0, 0, 0, 0, 0, 0, 0], recharge: "long" }]);

    const warlock = playResources(sheetFor(Array(3).fill("Warlock")));
    expect(warlock.slots).toHaveLength(1);
    expect(warlock.slots[0]).toMatchObject({ key: "Warlock", recharge: "short", slots: [0, 2, 0, 0, 0, 0, 0, 0, 0] });

    let play: PlayState = { ...newPlayState(), spentSlots: { [slotKey("Warlock", 2)]: 2 } };
    expect(slotsLeft(play, warlock.slots[0], 2)).toBe(0);
    play = shortRest(play, warlock);
    expect(slotsLeft(play, warlock.slots[0], 2)).toBe(2);

    const spent = { ...newPlayState(), spentSlots: { [slotKey("Wizard", 1)]: 3 } };
    expect(slotsLeft(shortRest(spent, wizard), wizard.slots[0], 1)).toBe(1);
  });

  it("shares one slot table between multiclass casters", () => {
    const shared = [4, 3, 0, 0, 0, 0, 0, 0, 0];
    const sheet = {
      features: [],
      hitDice: "2d6 + 2d8",
      multiclassSpellcasting: { casterLevel: 4, slots: shared },
      spellcasting: [
        { name: "Wizard", slots: shared },
        { name: "Cleric", slots: shared },
        { name: "Warlock", slots: [0, 1, 0, 0, 0, 0, 0, 0, 0] },
      ],
    } as unknown as CharacterSheet;
    const res = playResources(sheet);
    expect(res.slots).toEqual([
      { key: "shared", label: "Spell slots", slots: shared, recharge: "long" },
      { key: "Warlock", label: "Warlock (Pact Magic)", slots: [0, 1, 0, 0, 0, 0, 0, 0, 0], recharge: "short" },
    ]);
    expect(res.hitDice).toEqual([
      { die: "d8", total: 2 },
      { die: "d6", total: 2 },
    ]);
  });

  it("takes damage from temporary hit points first and tracks dying", () => {
    let play = gainTempHp(newPlayState(), 5);
    play = takeDamage(play, 20, 8);
    expect(play.tempHp).toBe(0);
    expect(currentHp(play, 20)).toBe(17);
    play = takeDamage(play, 20, 30);
    expect(currentHp(play, 20)).toBe(0);
    expect(play.log.at(-1)!.text).toBe("Took 30 damage: dropped to 0 HP.");
    play = takeDamage(play, 20, 3);
    expect(play.deathSaves.failures).toBe(1);
    play = heal(play, 20, 4);
    expect(currentHp(play, 20)).toBe(4);
    expect(play.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(heal(play, 20, 100).hp).toBeNull();
    expect(takeDamage(newPlayState(), 20, 40).log.at(-1)!.text).toContain("instant death");
    // A character without a class yet has no hit points; never show negative ones.
    expect(currentHp(newPlayState(), -1)).toBe(0);
  });

  it("keeps the higher temporary hit points", () => {
    expect(gainTempHp(gainTempHp(newPlayState(), 8), 5).tempHp).toBe(8);
    expect(gainTempHp(gainTempHp(newPlayState(), 5), 8).tempHp).toBe(8);
  });

  it("spends hit dice on a Short Rest and gets them back on a Long Rest", () => {
    const res = playResources(sheetFor(Array(4).fill("Fighter")));
    const pool = res.hitDice[0];
    let play = takeDamage(newPlayState(), 30, 20);
    play = spendHitDie(play, 30, pool, 9);
    play = spendHitDie(play, 30, pool, 7);
    expect(currentHp(play, 30)).toBe(26);
    expect(hitDiceLeft(play, pool)).toBe(2);
    play = { ...play, usedFeatures: { [res.features[0].id]: 1 }, exhaustion: 2, tempHp: 4 };

    const rested2024 = longRest(play, res, "2024");
    expect(rested2024).toMatchObject({ hp: null, tempHp: 0, exhaustion: 1, usedFeatures: {}, hitDiceSpent: {} });
    expect(usesLeft(rested2024, res.features[0])).toBe(res.features[0].max);
    // 2014: regain half the total (4 → 2), so both spent dice come back here.
    expect(longRest(play, res, "2014").hitDiceSpent).toEqual({});
    const spentAll = { ...play, hitDiceSpent: { d10: 4 } };
    expect(longRest(spentAll, res, "2014").hitDiceSpent).toEqual({ d10: 2 });
  });

  it("resolves an attack and its damage from dice rolled at the table", () => {
    const sheet = sheetFor(Array(5).fill("Fighter"), [{ id: "ID_WOTC_PHB_WEAPON_LONGSWORD", equipped: "main" }]);
    const sword = sheet.attacks.find((a) => a.name === "Longsword")!;
    // STR 16 (+3, +1 from human = 17 → +3) and proficiency +3.
    expect(sword.attack).toBe(6);
    expect(sword.damage).toBe("1d8+3");
    expect(resolveAttack(sword, 12, { targetAc: 18 })).toEqual({ d20: 12, total: 18, critical: false, fumble: false, hit: true });
    expect(resolveAttack(sword, 11, { targetAc: 18 }).hit).toBe(false);
    expect(resolveAttack(sword, 20, { targetAc: 30 })).toMatchObject({ critical: true, hit: true });
    expect(resolveAttack(sword, 1, { targetAc: 2 })).toMatchObject({ fumble: true, hit: false });
    expect(resolveAttack(sword, 10).hit).toBeUndefined();

    expect(damageRoll(sword)).toEqual({ dice: "1d8", bonus: 3 });
    expect(damageRoll(sword, { critical: true })).toEqual({ dice: "2d8", bonus: 3 });
    expect(damageRoll(sword, { versatile: true })).toEqual({ dice: "1d10", bonus: 3 });
    expect(damageTotal(sword, 6)).toBe(9);

    const unarmed = sheet.attacks.find((a) => a.key === "unarmed")!;
    expect(damageRoll(unarmed)).toEqual({ dice: "", bonus: 4 });
    expect(damageTotal(unarmed, 0)).toBe(4);
  });

  it("applies Exhaustion to attack rolls under the 2024 rules", () => {
    const attack = { attack: 5, damage: "1d6" } as AttackRow;
    const play = { ...newPlayState(), exhaustion: 2 };
    expect(exhaustionPenalty(play, "2024")).toBe(4);
    expect(exhaustionPenalty(play, "2014")).toBe(0);
    expect(resolveAttack(attack, 10, { penalty: 4 }).total).toBe(11);
    expect(damageRoll({ ...attack, damage: "1d6−1" })).toEqual({ dice: "1d6", bonus: -1 });
  });

  it("saves the play state with the character", () => {
    const s = newCharacter();
    s.play = takeDamage(newPlayState(), 10, 3);
    const loaded = loadCharacterJson(JSON.parse(JSON.stringify(s)));
    expect(loaded.play).toMatchObject({ hp: 7, tempHp: 0, conditions: [] });
    expect(loadCharacterJson(JSON.parse(JSON.stringify(newCharacter()))).play).toBeUndefined();
    expect(loadCharacterJson({ ...s, play: { hp: 4, exhaustion: 9 } }).play).toMatchObject({ hp: 4, exhaustion: 6, log: [] });
  });
});

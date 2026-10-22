import { beforeAll, describe, expect, it } from "vitest";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionOptions, type CharacterState } from "../src/index.js";
import { auroraLegacyDir, coreDir, hasAuroraLegacy, loadDirs } from "./helpers.js";

const RANGER = "ID_WOTC_PHB_CLASS_RANGER";

describe.skipIf(!hasAuroraLegacy)("companions", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  function beastMaster(level: number): CharacterState {
    const s = newCharacter();
    s.levels = Array(level).fill(RANGER);
    let rc = resolveCharacter(registry, s);
    const arch = rc.selections.find((p) => p.rule.type === "Archetype")!;
    s.selections[arch.key] = ["ID_WOTC_ARCHETYPE_RANGER_BEAST_MASTER"];
    rc = resolveCharacter(registry, s);
    const pet = rc.selections.find((p) => p.rule.type === "Companion")!;
    const names = selectionOptions(rc, pet).map((o) => o.element.name);
    expect(names).toContain("Wolf");
    expect(names).not.toContain("Ape"); // CR 1/2
    s.selections[pet.key] = ["ID_WOTC_PHB_COMPANION_WOLF"];
    return s;
  }

  it("builds a ranger's wolf companion", () => {
    const sheet = buildSheet(resolveCharacter(registry, beastMaster(3)));
    const c = sheet.companion!;
    expect(c.name).toBe("Wolf");
    expect(c.proficiencyBonus).toBe(2);
    expect(c.abilities.find((a) => a.ability === "dexterity")).toMatchObject({ score: 15, modifier: 2 });
    // 13 natural armor + ranger proficiency bonus
    expect(c.armorClass).toBe(15);
    // max(11, 4 x ranger level 3)
    expect(c.maxHp).toBe(12);
    expect(c.speed.walk).toBe(40);
    expect(c.skills).toEqual(expect.arrayContaining([{ name: "Perception", total: 3 }, { name: "Stealth", total: 4 }]));
    expect(c.actions.map((a) => a.name)).toEqual(["Bite"]);
    expect(c.traits).toHaveLength(2);
    expect(c.attackBonus).toBe(2);
  });

  it("scales companion hit points with ranger level", () => {
    const sheet = buildSheet(resolveCharacter(registry, beastMaster(5)));
    expect(sheet.companion!.maxHp).toBe(20);
    expect(sheet.companion!.armorClass).toBe(16);
  });
});

describe.skipIf(!hasAuroraLegacy)("companions under the 2024 rules", () => {
  let registry: ContentRegistry;
  beforeAll(() => {
    registry = loadDirs(new ContentRegistry(), coreDir, auroraLegacyDir);
  });

  function choose(s: CharacterState, name: string | RegExp, pick: (ids: string[]) => string) {
    const rc = resolveCharacter(registry, s);
    const p = rc.selections.find((x) => (typeof name === "string" ? x.rule.name === name || x.rule.type === name : name.test(x.rule.name)))!;
    expect(p, String(name)).toBeDefined();
    s.selections[p.key] = [pick(selectionOptions(rc, p).map((o) => o.element.id)), ...Array(p.rule.number - 1).fill(null)];
  }

  function character(levels: string[]): CharacterState {
    const s = newCharacter();
    s.rules = "2024";
    s.abilities = { strength: 10, dexterity: 14, constitution: 14, intelligence: 16, wisdom: 16, charisma: 10 };
    s.levels = levels;
    return s;
  }

  const LAND = "ID_WOTC_PHB24_COMPANION_RANGER_BEAST_MASTER_PRIMAL_COMPANION_BEAST_OF_THE_LAND";
  const SKY = "ID_WOTC_PHB24_COMPANION_RANGER_BEAST_MASTER_PRIMAL_COMPANION_BEAST_OF_THE_SKY";

  it("flags the Primal Companion choice until a beast is picked", () => {
    const s = character(Array(3).fill("ID_WOTC_PHB24_CLASS_RANGER"));
    choose(s, "Archetype", () => "ID_WOTC_PHB24_ARCHETYPE_RANGER_BEAST_MASTER");
    const sheet = buildSheet(resolveCharacter(registry, s));
    expect(sheet.companions).toEqual([]);
    expect(sheet.pendingCompanions).toEqual(["Primal Companion"]);
    expect(sheet.warnings).toContain("Primal Companion: 1 choice remaining");
  });

  it("scales the Beast of the Land with ranger level, Wisdom and proficiency bonus", () => {
    const s = character(Array(5).fill("ID_WOTC_PHB24_CLASS_RANGER"));
    choose(s, "Archetype", () => "ID_WOTC_PHB24_ARCHETYPE_RANGER_BEAST_MASTER");
    choose(s, "Primal Companion", () => LAND);
    const sheet = buildSheet(resolveCharacter(registry, s));
    const c = sheet.companion!;
    expect(sheet.companions).toHaveLength(1);
    expect(sheet.pendingCompanions).toEqual([]);
    expect(c).toMatchObject({ name: "Beast of the Land", grantedBy: "Primal Companion", proficiencyBonus: 3, hitDice: "5d8" });
    expect(c.armorClass).toBe(16); // 13 + Wisdom modifier
    expect(c.maxHp).toBe(30); // 5 + 5 x ranger level
    expect(c.speed).toMatchObject({ walk: 40, climb: 40 });
    // Primal Bond: proficiency bonus on every check and save.
    expect(c.savingThrows.find((x) => x.name === "Intelligence")).toMatchObject({ total: 2, proficient: true });
    expect(c.skills.find((x) => x.name === "Perception")!.total).toBe(5);
    expect(c.passivePerception).toBe(15);
    expect(c.senses).toBe("Darkvision 60 ft.; Passive Perception 15");
    const strike = c.actions.find((a) => a.name === "Beast's Strike")!.text;
    expect(strike).toContain("Melee Attack Roll: +6 to hit");
    expect(strike).toContain("Hit: 1d8 + 5 Bludgeoning");

    s.levels = Array(11).fill("ID_WOTC_PHB24_CLASS_RANGER");
    const later = buildSheet(resolveCharacter(registry, s)).companion!;
    expect(later).toMatchObject({ maxHp: 60, proficiencyBonus: 4, hitDice: "11d8" });
  });

  it("keeps a familiar and a primal beast apart", () => {
    const s = character(["ID_WOTC_PHB24_CLASS_WIZARD", ...Array(4).fill("ID_WOTC_PHB24_CLASS_RANGER")]);
    choose(s, "Archetype", () => "ID_WOTC_PHB24_ARCHETYPE_RANGER_BEAST_MASTER");
    choose(s, /^Spellbook/, () => "ID_WOTC_PHB24_SPELL_FIND_FAMILIAR");
    expect(buildSheet(resolveCharacter(registry, s)).pendingCompanions).toEqual(["Find Familiar", "Primal Companion"]);
    choose(s, "Find Familiar", () => "ID_WOTC_MM25_COMPANION_OWL");
    choose(s, "Primal Companion", () => SKY);
    const sheet = buildSheet(resolveCharacter(registry, s));
    expect(sheet.companions.map((c) => `${c.grantedBy}: ${c.name}`)).toEqual(["Find Familiar: Owl", "Primal Companion: Beast of the Sky"]);
    const [owl, sky] = sheet.companions;
    // The owl keeps its own numbers: no Primal Companion AC or hit points, no Primal Bond.
    expect(owl).toMatchObject({ armorClass: 11, maxHp: 1, proficiencyBonus: 2 });
    expect(owl.savingThrows.every((x) => !x.proficient)).toBe(true);
    expect(sky).toMatchObject({ armorClass: 16, maxHp: 20, hitDice: "4d6", proficiencyBonus: 3 });
    expect(sky.actions[0].text).toContain("Hit: 1d4 + 6 Slashing");
  });

  it("builds a Drakewarden drake that grows with the ranger", () => {
    const s = character(Array(7).fill("ID_WOTC_PHB24_CLASS_RANGER"));
    choose(s, "Archetype", () => "ID_WOTC_FTOD_ARCHETYPE_RANGER_DRAKEWARDEN");
    const c = buildSheet(resolveCharacter(registry, s)).companion!;
    expect(c).toMatchObject({ name: "Drake Companion", summary: "Medium dragon, Unaligned", armorClass: 17, maxHp: 40, hitDice: "7d10" });
    expect(c.speed.fly).toBe(40);
  });

  it("builds a Wildfire Spirit with the druid's spell attack", () => {
    const s = character(Array(5).fill("ID_WOTC_PHB24_CLASS_DRUID"));
    choose(s, "Archetype", () => "ID_WOTC_TCOE_ARCHETYPE_DRUID_CIRCLE_OF_WILDFIRE");
    choose(s, "Wildfire Spirit", () => "ID_WOTC_TCOE_COMPANION_WILDFIRE_SPIRIT");
    const c = buildSheet(resolveCharacter(registry, s)).companion!;
    expect(c.maxHp).toBe(30);
    expect(c.actions.map((a) => a.text).join("\n")).toContain("+6 to hit, range 60 ft., one target you can see. Hit: 1d6 + 3 fire damage.");
  });

  it("builds a Battle Smith's Steel Defender", () => {
    const s = character(Array(5).fill("ID_WOTC_TCOE_CLASS_ARTIFICER"));
    s.rules = "2014";
    choose(s, "Archetype", () => "ID_WOTC_TCOE_ARCHETYPE_ARTIFICER_BATTLE_SMITH");
    const c = buildSheet(resolveCharacter(registry, s)).companion!;
    expect(c).toMatchObject({ name: "Steel Defender", armorClass: 15, maxHp: 30, hitDice: "5d8", passivePerception: 16 });
    expect(c.reactions.map((r) => r.name)).toEqual(["Deflect Attack"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  attachmentPath,
  entryFor,
  fillTemplate,
  generateEncounter,
  generateName,
  generateNpc,
  individualTreasure,
  isTemplate,
  newNote,
  noteFromTemplate,
  noteGraph,
  parseNote,
  parseRandomTable,
  resolveAsset,
  rollDiceIn,
  rollNoteTable,
  seededRng,
  starterTemplates,
  templateForType,
  type MonsterTemplate,
  type Note,
} from "../src/index.js";

describe("random tables", () => {
  it("reads a numbered table with ranges and d100 00", () => {
    const t = parseRandomTable("Intro\n\n| d100 | Weather |\n|---|---|\n| 01-50 | Clear |\n| 51–90 | Rain |\n| 91-00 | Storm |\n")!;
    expect(t.die).toBe(100);
    expect(t.entries).toEqual([
      { min: 1, max: 50, text: "Clear" },
      { min: 51, max: 90, text: "Rain" },
      { min: 91, max: 100, text: "Storm" },
    ]);
    expect(entryFor(t, 95).text).toBe("Storm");
  });

  it("reads plain tables and lists with one result per line", () => {
    expect(parseRandomTable("| Name | Note |\n| --- | --- |\n| Bob | tall |\n| Ann | |\n")).toEqual({ die: 2, entries: [{ min: 1, max: 1, text: "Bob — tall" }, { min: 2, max: 2, text: "Ann" }] });
    expect(parseRandomTable("Rumors:\n- The mill is haunted\n- [ ] The mayor lies\n\nOther text")?.entries.map((e) => e.text)).toEqual(["The mill is haunted", "The mayor lies"]);
    expect(parseRandomTable("No table here.")).toBeNull();
  });

  it("rolls dice in results and nested tables", () => {
    const rng = seededRng(7);
    expect(rollDiceIn("2d6 goblins and d4+1 wolves", rng)).toMatch(/^\d+ \(2d6\) goblins and \d+ \(d4\+1\) wolves$/);
    const notes: Note[] = [
      parseNote("Tables/Loot.md", "---\ntype: table\n---\n- A pouch with [[Gems]]\n"),
      parseNote("Tables/Gems.md", "---\ntype: table\n---\n- 1d4 rubies\n"),
    ];
    const r = rollNoteTable(notes[0], notes, rng)!;
    expect(r.table).toBe("Loot");
    expect(r.die).toBe(1);
    expect(r.text).toMatch(/^A pouch with \d \(1d4\) rubies$/);
  });
});

describe("generators", () => {
  it("makes names and NPCs", () => {
    const rng = seededRng(1);
    expect(generateName("Dwarf", rng)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(generateName("Orc", rng)).toMatch(/^[A-Z][a-z]+$/);
    const npc = generateNpc(rng, "Elf");
    expect(npc.species).toBe("Elf");
    expect(npc.name && npc.occupation && npc.trait && npc.want && npc.quirk).toBeTruthy();
  });

  it("builds an encounter within the budget", () => {
    const templates: MonsterTemplate[] = [
      { elementId: "g", name: "Goblin", source: "", challenge: "1/4", ac: 15, hp: 7, initiativeBonus: 2 },
      { elementId: "o", name: "Ogre", source: "", challenge: "2", ac: 11, hp: 68, initiativeBonus: -1 },
      { elementId: "d", name: "Dragon", source: "", challenge: "17", ac: 19, hp: 200, initiativeBonus: 0 },
    ];
    for (let seed = 0; seed < 20; seed++) {
      const e = generateEncounter(templates, [3, 3, 3, 3], "2024", "moderate", seededRng(seed))!;
      expect(e.budget).toBe(900);
      expect(e.xp).toBeLessThanOrEqual(900);
      expect(e.xp).toBeGreaterThan(0);
      expect(e.monsters.some((m) => m.name === "Dragon")).toBe(false);
    }
    expect(generateEncounter(templates.slice(2), [1], "2024", "low", seededRng(1))).toBeNull();
  });

  it("rolls coin treasure by challenge rating", () => {
    expect(individualTreasure(2, seededRng(3))).toMatch(/^\d+ gp$/);
    expect(individualTreasure(20, seededRng(3))).toMatch(/^\d+00 pp$/);
  });
});

describe("templates, images and graph", () => {
  it("makes notes from templates", () => {
    const tpl = parseNote("Templates/NPC.md", "---\ntype: npc\ntags: [person]\naliases: [\"{{title}}\"]\n---\n# {{title}}\nMet on {{date}}.");
    expect(isTemplate(tpl)).toBe(true);
    const n = noteFromTemplate(tpl, "Mira", [], new Date(2026, 10, 7, 9, 5));
    expect(n.path).toBe("Notes/Mira.md");
    expect(n.type).toBe("npc");
    expect(n.tags).toEqual(["person"]);
    expect(n.body).toBe("# Mira\nMet on 2026-11-07.");
    expect(n.frontMatter.find((e) => e.key === "aliases")?.raw).toBe('aliases: ["Mira"]');
    expect(fillTemplate("{{ time }}", "x", new Date(2026, 0, 1, 7, 3))).toBe("07:03");
    expect(templateForType("npc", [tpl])?.path).toBe(tpl.path);
    const starters = starterTemplates([tpl]);
    expect(starters.map((s) => s.title)).not.toContain("NPC");
    expect(starters.every((s) => isTemplate(s))).toBe(true);
  });

  it("finds images by name or path and names new ones", () => {
    const assets = ["Attachments/Map.png", "Maps/region/map.png", "Notes/pics/door.jpg"];
    expect(resolveAsset("map.png", assets)).toBe("Attachments/Map.png");
    expect(resolveAsset("region/map.png", assets)).toBe("Maps/region/map.png");
    expect(resolveAsset("pics/door.jpg", assets, "Notes/Tavern.md")).toBe("Notes/pics/door.jpg");
    expect(resolveAsset("Maps%2Fregion/map.png".replace("%2F", "/"), assets)).toBe("Maps/region/map.png");
    expect(resolveAsset("nope.png", assets)).toBeUndefined();
    expect(attachmentPath("Map.PNG", assets)).toBe("Attachments/Map 2.png");
    expect(attachmentPath("my: map?.webp", [])).toBe("Attachments/my map.webp");
  });

  it("builds the link graph without templates or duplicates", () => {
    const notes = [
      parseNote("Notes/A.md", "[[B]] and [[B|again]] and [[C]] and [[Missing]]"),
      parseNote("Notes/B.md", "back to [[A]]"),
      parseNote("Notes/C.md", ""),
      parseNote("Templates/T.md", "[[A]]"),
    ];
    const g = noteGraph(notes);
    expect(g.nodes.map((n) => [n.title, n.degree])).toEqual([["A", 2], ["B", 1], ["C", 1]]);
    expect(g.edges).toEqual([[0, 1], [0, 2]]);
    expect(newNote("table", "Weather", []).path).toBe("Tables/Weather.md");
  });
});

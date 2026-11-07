import { describe, expect, it } from "vitest";
import {
  backlinks,
  newNote,
  nextSessionNumber,
  parseLinks,
  parseNote,
  renameNote,
  resolveNote,
  safeTitle,
  searchNotes,
  serializeNote,
  uniqueTitle,
  type Note,
} from "../src/index.js";

const note = (path: string, text: string) => parseNote(path, text);

describe("front matter", () => {
  it("reads managed keys and keeps others as written", () => {
    const text = `---\ntype: npc\ntags:\n  - smith\n  - "#ally"\naliases: [Mira, The Smith]\ncssclasses:\n  - wide\n---\n# Mira\nOwns the forge.\n`;
    const n = note("Notes/Mira the Smith.md", text);
    expect(n.title).toBe("Mira the Smith");
    expect(n.type).toBe("npc");
    expect(n.tags).toEqual(["smith", "ally"]);
    expect(n.body).toBe("# Mira\nOwns the forge.\n");
    // Unchanged round trip keeps the file byte for byte apart from managed values written back the same.
    expect(serializeNote({ ...n, tags: ["smith", "#ally"] })).toBe(text);
    const edited = serializeNote({ ...n, tags: ["smith"], type: "location" });
    expect(edited).toContain("aliases: [Mira, The Smith]");
    expect(edited).toContain("cssclasses:\n  - wide");
    expect(edited).toContain("type: location");
    expect(edited).toContain("tags:\n  - smith\n");
  });

  it("reads and writes session and quest fields", () => {
    const s = newNote("session", "Session 3", [], { session: { number: 3, date: "2026-11-06", inGameDate: "15 Mirtul 1492", present: ["Aria", "Borin Ironfist"], xp: 450, loot: "50 gp: a Potion of Healing" } });
    expect(s.path).toBe("Sessions/Session 3.md");
    const text = serializeNote({ ...s, body: "Recap." });
    expect(text).toBe(
      `---\ntype: session\nsession: 3\ndate: 2026-11-06\nin_game_date: 15 Mirtul 1492\npresent:\n  - Aria\n  - Borin Ironfist\nxp: 450\nloot: "50 gp: a Potion of Healing"\n---\nRecap.`,
    );
    const back = parseNote(s.path, text);
    expect(back.session).toEqual({ number: 3, date: "2026-11-06", inGameDate: "15 Mirtul 1492", present: ["Aria", "Borin Ironfist"], xp: 450, loot: "50 gp: a Potion of Healing" });
    const q = parseNote("Quests/Find the mine.md", serializeNote({ ...newNote("quest", "Find the mine", []), status: "done" }));
    expect(q.type).toBe("quest");
    expect(q.status).toBe("done");
    expect(parseNote("x.md", "---\npresent: [[Aria]], Borin\n---\n").session.present).toEqual(["Aria", "Borin"]);
  });

  it("leaves plain notes without front matter", () => {
    const n = note("Notes/Plain.md", "Just text with --- inside.\n");
    expect(n.type).toBe("general");
    expect(serializeNote({ ...n, body: "Changed." })).toBe("Changed.");
    expect(serializeNote({ ...n, tags: ["x"] })).toBe("---\ntags:\n  - x\n---\nJust text with --- inside.\n");
  });

  it("quotes values YAML would misread", () => {
    const n = { ...newNote("session", "S", []), session: { present: [], inGameDate: "yes", loot: "#1 prize" } };
    const text = serializeNote(n);
    expect(text).toContain('in_game_date: "yes"');
    expect(text).toContain('loot: "#1 prize"');
    expect(parseNote(n.path, text).session.inGameDate).toBe("yes");
  });
});

describe("links", () => {
  const notes: Note[] = [
    note("Notes/Mira the Smith.md", "Lives in [[Phandalin]]."),
    note("Notes/Phandalin.md", "Home of [[mira the smith|Mira]] and [[Notes/Mira the Smith#Forge]]. ![[Map]]"),
    note("Sessions/Session 1.md", "Met [[Mira the Smith]]. Cast [[Fireball]]."),
  ];

  it("parses targets, headings, aliases and embeds", () => {
    expect(parseLinks("a [[X#h|shown]] b ![[Y]] [[]]")).toEqual([
      { from: 2, to: 15, target: "X", heading: "h", alias: "shown", embed: false },
      { from: 18, to: 24, target: "Y", heading: undefined, alias: undefined, embed: true },
    ]);
  });

  it("resolves by title (any case) or by path", () => {
    expect(resolveNote("MIRA THE SMITH", notes)?.path).toBe("Notes/Mira the Smith.md");
    expect(resolveNote("Notes/Phandalin", notes)?.path).toBe("Notes/Phandalin.md");
    expect(resolveNote("Fireball", notes)).toBeUndefined();
  });

  it("lists backlinks with their lines", () => {
    const b = backlinks(notes, notes[0]);
    expect(b.map((x) => x.note.title)).toEqual(["Phandalin", "Session 1"]);
    expect(b[1].lines).toEqual(["Met [[Mira the Smith]]. Cast [[Fireball]]."]);
  });

  it("renames a note and every link to it", () => {
    const r = renameNote(notes, "Notes/Mira the Smith.md", "Mira Brightforge");
    expect(r.renamed.path).toBe("Notes/Mira Brightforge.md");
    expect(r.changed.sort()).toEqual(["Notes/Phandalin.md", "Sessions/Session 1.md"]);
    const by = (p: string) => r.notes.find((n) => n.path === p)!.body;
    expect(by("Notes/Phandalin.md")).toBe("Home of [[Mira Brightforge|Mira]] and [[Notes/Mira Brightforge#Forge]]. ![[Map]]");
    expect(by("Sessions/Session 1.md")).toBe("Met [[Mira Brightforge]]. Cast [[Fireball]].");
    expect(by("Notes/Mira Brightforge.md")).toBe("Lives in [[Phandalin]].");
  });

  it("keeps titles unique and file-safe", () => {
    expect(safeTitle(' What: is "this"? / ok. ')).toBe("What is this ok");
    expect(safeTitle("CON")).toBe("CON note");
    expect(uniqueTitle("phandalin", notes)).toBe("phandalin 2");
    expect(nextSessionNumber([parseNote("a.md", "---\ntype: session\nsession: 4\n---\n")])).toBe(5);
  });
});

describe("search", () => {
  const notes: Note[] = [
    note("Notes/Città di Neverwinter.md", "---\ntags: [city]\n---\nThe big city on the Sword Coast."),
    note("Notes/Mira.md", "---\ntype: npc\ntags: [ally]\n---\nShe sells swords in Neverwinter.\nAnother line."),
    note("Quests/Lost mine.md", "---\ntype: quest\n---\nFind the mine near Phandalin."),
  ];

  it("needs every term, ranks title matches first and highlights", () => {
    const hits = searchNotes(notes, "neverwinter");
    expect(hits.map((h) => h.note.title)).toEqual(["Città di Neverwinter", "Mira"]);
    expect(hits[1].snippets).toEqual([{ text: "She sells swords in Neverwinter.", ranges: [[20, 31]] }]);
    expect(searchNotes(notes, "sword neverwinter").map((h) => h.note.title)).toEqual(["Città di Neverwinter", "Mira"]);
    expect(searchNotes(notes, '"sword coast"').map((h) => h.note.title)).toEqual(["Città di Neverwinter"]);
    expect(searchNotes(notes, "citta")[0].titleRanges).toEqual([[0, 5]]);
  });

  it("shows links in snippets as their text", () => {
    const n = [note("a.md", "Met [[Mira the Smith|Mira]] and [[Tor#Forge]] at the forge.")];
    expect(searchNotes(n, "forge")[0].snippets[0].text).toBe("Met Mira and Tor at the forge.");
  });

  it("filters by type and tag", () => {
    expect(searchNotes(notes, "", { type: "quest" }).map((h) => h.note.title)).toEqual(["Lost mine"]);
    expect(searchNotes(notes, "", { tag: "ALLY" }).map((h) => h.note.title)).toEqual(["Mira"]);
    expect(searchNotes(notes, "swords", { type: "npc" })).toHaveLength(1);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionKey, selectionOptions } from "@dndbuilder/engine";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { characterSheetPdf } from "../src/pdf/characterSheetPdf";

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

describe("character sheet PDF", () => {
  const registry = load();

  function wizard(level: number) {
    const s = newCharacter();
    s.name = "Zoë “Quill” Ashford";
    s.abilities = { strength: 8, dexterity: 14, constitution: 14, intelligence: 15, wisdom: 12, charisma: 10 };
    s.levels = Array(level).fill("ID_WOTC_PHB_CLASS_WIZARD");
    s.selections[selectionKey("ID_LEVEL_1", "Race")] = ["ID_RACE_TIEFLING"];
    s.selections[selectionKey("ID_LEVEL_1", "Background")] = ["ID_BACKGROUND_ACOLYTE"];
    s.details.backstory = "Raised in a temple library.\n\nLeft to find a lost tome.";
    s.inventory = [{ uid: "1", id: "ID_SRD_ITEM_SPELLBOOK", quantity: 1 }];
    s.currency.gp = 15;
    let rc = resolveCharacter(registry, s);
    for (const p of rc.selections.filter((p) => p.rule.type === "Spell")) {
      s.selections[p.key] = selectionOptions(rc, p).slice(0, p.rule.number).map((o) => o.element.id);
    }
    rc = resolveCharacter(registry, s);
    const book = rc.selections.filter((p) => p.rule.name.startsWith("Spellbook")).flatMap((p) => p.chosen).filter(Boolean) as string[];
    s.preparedSpells.Wizard = book.slice(0, 4);
    return s;
  }

  for (const paper of ["letter", "a4"] as const) {
    it(`renders a valid ${paper} PDF`, async () => {
      const state = wizard(9);
      const sheet = buildSheet(resolveCharacter(registry, state));
      const bytes = await characterSheetPdf(sheet, state, registry, { paper });
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
      expect(doc.getTitle()).toContain("Quill");
      const [w] = [doc.getPage(0).getWidth()];
      expect(Math.round(w)).toBe(paper === "letter" ? 612 : 595);
    });
  }
});

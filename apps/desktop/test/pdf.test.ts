import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSheet, ContentRegistry, newCharacter, resolveCharacter, selectionKey, selectionOptions } from "@daybreakbuilder/engine";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { characterSheetPdf, htmlToRuns } from "../src/pdf/characterSheetPdf";

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

  it("embeds the portrait in the header", async () => {
    const pageImages = async (bytes: Uint8Array) => {
      const res = (await PDFDocument.load(bytes)).getPage(0).node.Resources();
      return res?.lookupMaybe(PDFName.of("XObject"), PDFDict)?.keys().length ?? 0;
    };
    const state = wizard(1);
    const sheet = buildSheet(resolveCharacter(registry, state));
    expect(await pageImages(await characterSheetPdf(sheet, state, registry))).toBe(0);
    // 1x1 PNG.
    state.portrait = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    expect(await pageImages(await characterSheetPdf(sheet, state, registry))).toBe(1);
    state.portrait = "data:image/png;base64,bm90IGFuIGltYWdl";
    expect(await pageImages(await characterSheetPdf(sheet, state, registry))).toBe(0);
  });

  it("renders each colour style", async () => {
    const state = wizard(5);
    const sheet = buildSheet(resolveCharacter(registry, state));
    const out: Record<string, Uint8Array> = {};
    for (const style of ["classic", "print", "dark"] as const) {
      out[style] = await characterSheetPdf(sheet, state, registry, { style });
      expect((await PDFDocument.load(out[style])).getPageCount()).toBe((await PDFDocument.load(out.classic)).getPageCount());
    }
    expect(Buffer.from(out.print).equals(Buffer.from(out.classic))).toBe(false);
    expect(Buffer.from(out.dark).equals(Buffer.from(out.classic))).toBe(false);
    if (process.env.PDF_OUT) {
      const { writeFileSync } = await import("node:fs");
      for (const [style, bytes] of Object.entries(out)) writeFileSync(join(process.env.PDF_OUT, `${style}.pdf`), bytes);
    }
  });

  it("renders metric units when asked", async () => {
    const state = wizard(5);
    const sheet = buildSheet(resolveCharacter(registry, state));
    const imperial = await characterSheetPdf(sheet, state, registry);
    const metric = await characterSheetPdf(sheet, state, registry, { units: "metric" });
    expect((await PDFDocument.load(metric)).getPageCount()).toBe((await PDFDocument.load(imperial)).getPageCount());
    expect(Buffer.from(metric).equals(Buffer.from(imperial))).toBe(false);
    if (process.env.PDF_OUT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(process.env.PDF_OUT, "imperial.pdf"), imperial);
      writeFileSync(join(process.env.PDF_OUT, "metric.pdf"), metric);
    }
  });
});

describe("htmlToRuns", () => {
  it("drops XML indentation and keeps run-in headings bold", () => {
    const html = `
			<p>You manifest a minor wonder.</p>
			<p class="indent"><b><i>Altered Eyes.</i></b> You alter the appearance of your eyes.</p>
			<p><strong>Cantrip Upgrade.</strong> The beam&nbsp;count increases.</p>`;
    expect(htmlToRuns(html)).toEqual([
      [{ text: "You manifest a minor wonder.", bold: false, italic: false }],
      [
        { text: "Altered Eyes.", bold: true, italic: true },
        { text: " You alter the appearance of your eyes.", bold: false, italic: false },
      ],
      [
        { text: "Cantrip Upgrade.", bold: true, italic: false },
        { text: " The beam count increases.", bold: false, italic: false },
      ],
    ]);
  });
});

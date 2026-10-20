/**
 * Character sheet PDF export, drawn with pdf-lib so it works the same in the
 * desktop app and the browser. The layout is our own (the official sheet is
 * not redistributable): a summary page, then spellcasting, companion and
 * background pages as needed. Long sections flow onto continuation pages.
 */
import { attackDetails, convertUnits, formatModifier, type CharacterSheet, type CharacterState, type ContentRegistry, type UnitSystem } from "@dndbuilder/engine";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

export type PaperSize = "letter" | "a4";

/** Look of the exported sheet: the usual red accent, black ink only for printing, or light text on a dark page. */
export type PdfStyle = "classic" | "print" | "dark";

const SIZES: Record<PaperSize, [number, number]> = { letter: [612, 792], a4: [595.28, 841.89] };
const MARGIN = 32;

interface Palette {
  /** Page fill; left out for white paper so printers spend no ink on it. */
  page?: RGB;
  /** Fill behind stat and ability boxes. */
  panel?: RGB;
  accent: RGB;
  ink: RGB;
  muted: RGB;
  rule: RGB;
}

const PALETTES: Record<PdfStyle, Palette> = {
  classic: { accent: rgb(0.545, 0.118, 0.118), ink: rgb(0.1, 0.1, 0.1), muted: rgb(0.42, 0.4, 0.37), rule: rgb(0.75, 0.72, 0.68) },
  print: { accent: rgb(0, 0, 0), ink: rgb(0, 0, 0), muted: rgb(0.33, 0.33, 0.33), rule: rgb(0.55, 0.55, 0.55) },
  // Matches the app's dark theme.
  dark: {
    page: rgb(0.078, 0.075, 0.09),
    panel: rgb(0.118, 0.114, 0.137),
    accent: rgb(0.898, 0.451, 0.408),
    ink: rgb(0.925, 0.91, 0.882),
    muted: rgb(0.62, 0.6, 0.58),
    rule: rgb(0.3, 0.29, 0.33),
  },
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/** Replace characters the standard (WinAnsi) fonts can't encode. */
function makeSanitizer(font: PDFFont): (s: string) => string {
  const supported = new Set(font.getCharacterSet());
  const map: Record<string, string> = { "−": "-", "●": "*", "◯": "o", "✕": "x", "→": "->", "≥": ">=", "≤": "<=", "×": "x", " ": " " };
  return (s: string) => {
    let out = "";
    for (const ch of s.normalize("NFC")) {
      const cp = ch.codePointAt(0)!;
      if (ch === "\n" || supported.has(cp)) out += ch;
      else if (map[ch]) out += map[ch];
      else {
        const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
        out += base && [...base].every((c) => supported.has(c.codePointAt(0)!)) ? base : "?";
      }
    }
    return out;
  };
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Hard-break words longer than the column.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    lines.push(line);
  }
  return lines;
}

/** A column of flowing content that continues on a new page when full. */
class Flow {
  y: number;
  constructor(
    private ctx: Ctx,
    public page: PDFPage,
    public x: number,
    public width: number,
    public top: number,
    private continuationTitle: string,
  ) {
    this.y = top;
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN) return;
    this.page = this.ctx.newPage();
    this.ctx.pageTitle(this.page, this.continuationTitle);
    this.x = MARGIN;
    this.width = this.page.getWidth() - 2 * MARGIN;
    this.y = this.page.getHeight() - MARGIN - 28;
  }

  heading(text: string) {
    this.ensure(30);
    this.y -= 4;
    this.ctx.text(this.page, text.toUpperCase(), this.x, this.y - 9, 8.5, this.ctx.fonts.bold, this.ctx.pal.accent);
    this.y -= 13;
    this.page.drawLine({ start: { x: this.x, y: this.y }, end: { x: this.x + this.width, y: this.y }, thickness: 0.6, color: this.ctx.pal.accent });
    this.y -= 5;
  }

  paragraph(text: string, opts: { size?: number; font?: PDFFont; color?: RGB; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 8.5;
    const font = opts.font ?? this.ctx.fonts.regular;
    const indent = opts.indent ?? 0;
    const lines = wrap(this.ctx.clean(text), font, size, this.width - indent);
    const lh = size * 1.25;
    for (const line of lines) {
      this.ensure(lh);
      this.page.drawText(line, { x: this.x + indent, y: this.y - size, size, font, color: opts.color ?? this.ctx.pal.ink });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 2;
  }

  /** "Label. text" with a bold lead-in. */
  entry(title: string, text: string, meta?: string) {
    const size = 8.5;
    const { bold, regular } = this.ctx.fonts;
    this.ensure(size * 2.6);
    const head = this.ctx.clean(title);
    this.page.drawText(head, { x: this.x, y: this.y - size, size, font: bold, color: this.ctx.pal.ink });
    if (meta) {
      const w = bold.widthOfTextAtSize(head, size);
      this.page.drawText(this.ctx.clean(`  ${meta}`), { x: this.x + w, y: this.y - size, size: 7, font: regular, color: this.ctx.pal.muted });
    }
    this.y -= size * 1.3;
    if (text) this.paragraph(text, { size: 8, gap: 4 });
    else this.y -= 3;
  }

  row(cells: { text: string; width: number; font?: PDFFont; color?: RGB; align?: "left" | "right" }[], size = 8.5) {
    this.ensure(size * 1.4);
    let x = this.x;
    for (const c of cells) {
      const font = c.font ?? this.ctx.fonts.regular;
      const t = this.ctx.clean(c.text);
      const tx = c.align === "right" ? x + c.width - font.widthOfTextAtSize(t, size) : x;
      this.page.drawText(t, { x: tx, y: this.y - size, size, font, color: c.color ?? this.ctx.pal.ink });
      x += c.width;
    }
    this.y -= size * 1.4;
  }

  space(h: number) {
    this.y -= h;
  }
}

class Ctx {
  clean: (s: string) => string;
  constructor(
    public doc: PDFDocument,
    public fonts: Fonts,
    public size: [number, number],
    public characterName: string,
    units: UnitSystem,
    public pal: Palette,
  ) {
    // Every string drawn passes through here: convert measurements, then make it encodable.
    const sanitize = makeSanitizer(fonts.regular);
    this.clean = (s: string) => sanitize(convertUnits(s, units));
  }

  newPage(): PDFPage {
    const page = this.doc.addPage(this.size);
    if (this.pal.page) page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: this.pal.page });
    const n = this.doc.getPageCount();
    this.text(page, `${this.characterName} · page ${n}`, MARGIN, 16, 7, this.fonts.regular, this.pal.muted);
    this.text(page, "dndbuilder", page.getWidth() - MARGIN - 34, 16, 7, this.fonts.italic, this.pal.muted);
    return page;
  }

  pageTitle(page: PDFPage, title: string) {
    const y = page.getHeight() - MARGIN - 14;
    this.text(page, title, MARGIN, y, 14, this.fonts.bold, this.pal.accent);
    page.drawLine({ start: { x: MARGIN, y: y - 6 }, end: { x: page.getWidth() - MARGIN, y: y - 6 }, thickness: 1, color: this.pal.accent });
  }

  text(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = this.pal.ink) {
    page.drawText(this.clean(s), { x, y, size, font, color });
  }

  box(page: PDFPage, x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, color: this.pal.panel, borderColor: this.pal.rule, borderWidth: 0.8 });
  }

  /** Centered value with a small label underneath, inside a box. */
  statBox(page: PDFPage, x: number, y: number, w: number, h: number, value: string, label: string) {
    this.box(page, x, y, w, h);
    const v = this.clean(value);
    const vs = v.length > 6 ? 11 : 15;
    page.drawText(v, { x: x + (w - this.fonts.bold.widthOfTextAtSize(v, vs)) / 2, y: y + h - vs - 5, size: vs, font: this.fonts.bold, color: this.pal.ink });
    const l = this.clean(label.toUpperCase());
    page.drawText(l, { x: x + (w - this.fonts.regular.widthOfTextAtSize(l, 6)) / 2, y: y + 5, size: 6, font: this.fonts.regular, color: this.pal.muted });
  }
}

function profDot(pal: Palette, page: PDFPage, x: number, y: number, kind: "none" | "prof" | "exp") {
  page.drawCircle({ x, y, size: 2.4, borderColor: pal.muted, borderWidth: 0.6, color: kind === "none" ? undefined : kind === "exp" ? pal.accent : pal.ink });
}

function cleanProf(items: string[]): string {
  return items.map((i) => i.replace(/^(Armor|Weapon|Tool) Proficiency \((.*)\)$/, "$2")).join(", ");
}

export interface PdfOptions {
  paper?: PaperSize;
  /** Show distances and weights in feet/pounds (default) or meters/kilograms. */
  units?: UnitSystem;
  /** Colour scheme (default "classic"). */
  style?: PdfStyle;
}

export async function characterSheetPdf(
  sheet: CharacterSheet,
  state: CharacterState,
  registry: ContentRegistry,
  options: PdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${sheet.name} - Character Sheet`);
  doc.setCreator("dndbuilder");
  doc.setProducer("dndbuilder (pdf-lib)");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const units = options.units ?? "imperial";
  const pal = PALETTES[options.style ?? "classic"];
  const ctx = new Ctx(doc, fonts, SIZES[options.paper ?? "letter"], sheet.name, units, pal);
  const page = ctx.newPage();
  const W = page.getWidth();
  const H = page.getHeight();
  const { bold, regular } = fonts;

  // Header.
  let y = H - MARGIN;
  let tx = MARGIN;
  const portrait = await embedPortrait(doc, state.portrait);
  if (portrait) {
    // Fit inside the header band, keeping the aspect ratio.
    const box = 48;
    const scale = Math.min(box / portrait.width, box / portrait.height);
    const pw = portrait.width * scale;
    const ph = portrait.height * scale;
    page.drawImage(portrait, { x: MARGIN + (box - pw) / 2, y: y - 50 + (box - ph) / 2, width: pw, height: ph });
    tx += box + 8;
  }
  ctx.text(page, sheet.name || "Unnamed", tx, y - 20, 20, bold, pal.accent);
  const subtitle = [[sheet.race, sheet.subrace].filter(Boolean).join(" "), sheet.classSummary].filter(Boolean).join(" · ");
  ctx.text(page, subtitle, tx, y - 34, 10, regular);
  const meta = [sheet.background, sheet.alignment, sheet.size, sheet.deity].filter(Boolean).join(" · ");
  ctx.text(page, meta, tx, y - 46, 8, regular, pal.muted);
  const right = [state.playerName && `Player: ${state.playerName}`, `Level ${sheet.level}`, state.experience ? `XP ${state.experience}` : ""].filter(Boolean).join("   ");
  ctx.text(page, right, W - MARGIN - regular.widthOfTextAtSize(ctx.clean(right), 8), y - 20, 8, regular, pal.muted);
  y -= 54;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: pal.accent });
  y -= 8;

  // Headline stats.
  const stats: [string, string][] = [
    [String(sheet.armorClass), "Armor Class"],
    [formatModifier(sheet.initiative), "Initiative"],
    [`${sheet.speed.walk} ft.`, "Speed"],
    [String(sheet.maxHp), "Hit Points"],
    [sheet.hitDice || "-", "Hit Dice"],
    [formatModifier(sheet.proficiencyBonus), "Proficiency"],
    [String(sheet.passivePerception), "Passive Perception"],
  ];
  const gap = 6;
  const bw = (W - 2 * MARGIN - gap * (stats.length - 1)) / stats.length;
  stats.forEach(([v, l], i) => ctx.statBox(page, MARGIN + i * (bw + gap), y - 40, bw, 40, v, l));
  y -= 52;

  // Column 1: abilities, saves, skills.
  const col1 = MARGIN;
  const col1w = 150;
  let cy = y;
  const abW = (col1w - 8) / 3;
  sheet.abilities.forEach((a, i) => {
    const bx = col1 + (i % 3) * (abW + 4);
    const by = cy - Math.floor(i / 3) * 50 - 46;
    ctx.box(page, bx, by, abW, 46);
    ctx.text(page, a.abbr, bx + (abW - bold.widthOfTextAtSize(a.abbr, 7)) / 2, by + 36, 7, bold, pal.muted);
    const mod = formatModifier(a.modifier);
    ctx.text(page, mod, bx + (abW - bold.widthOfTextAtSize(mod, 15)) / 2, by + 17, 15, bold);
    const sc = String(a.score);
    ctx.text(page, sc, bx + (abW - regular.widthOfTextAtSize(sc, 8)) / 2, by + 6, 8, regular, pal.muted);
  });
  cy -= 104;
  const left = new Flow(ctx, page, col1, col1w, cy, "Character sheet (continued)");
  left.heading("Saving Throws");
  for (const t of sheet.savingThrows) {
    profDot(pal, left.page, left.x + 3, left.y - 6, t.expertise ? "exp" : t.proficient ? "prof" : "none");
    left.row([{ text: "", width: 9 }, { text: formatModifier(t.total), width: 20, font: bold, align: "right" }, { text: `  ${t.name}`, width: 120 }]);
  }
  left.heading("Skills");
  for (const k of sheet.skills) {
    profDot(pal, left.page, left.x + 3, left.y - 6, k.expertise ? "exp" : k.proficient ? "prof" : "none");
    left.row([
      { text: "", width: 9 },
      { text: formatModifier(k.total), width: 20, font: bold, align: "right" },
      { text: `  ${k.name}`, width: 95 },
      { text: k.ability.slice(0, 3), width: 26, color: pal.muted, align: "right" },
    ]);
  }
  left.heading("Senses");
  left.paragraph(`Passive Perception ${sheet.passivePerception}, Insight ${sheet.passiveInsight}, Investigation ${sheet.passiveInvestigation}`);
  if (sheet.vision.length) left.paragraph(sheet.vision.map((v) => `${v.name}${v.range ? ` ${v.range} ft.` : ""}`).join(", "));

  // Column 2: proficiencies, defenses, equipment.
  const col2 = col1 + col1w + 12;
  const col2w = 165;
  const mid = new Flow(ctx, page, col2, col2w, y, "Character sheet (continued)");
  mid.heading("Attacks");
  for (const a of sheet.attacks) {
    mid.row([
      { text: a.name, width: col2w - 85, font: bold },
      { text: formatModifier(a.attack), width: 25, font: bold, align: "right" },
      { text: a.damage, width: 60, align: "right" },
    ]);
    const details = attackDetails(a, units);
    if (details) mid.paragraph(details, { size: 7, color: pal.muted, gap: 2 });
  }
  mid.heading("Proficiencies");
  const profLines: [string, string[]][] = [
    ["Armor", sheet.proficiencies.armor],
    ["Weapons", sheet.proficiencies.weapons],
    ["Tools", sheet.proficiencies.tools],
    ["Other", sheet.proficiencies.other],
    ["Languages", sheet.languages],
  ];
  for (const [label, items] of profLines) if (items.length) mid.entry(label, cleanProf(items));
  if (sheet.conditions.length) mid.entry("Defenses", sheet.conditions.join(", "));
  const otherSpeeds = (["climb", "swim", "fly", "burrow"] as const).filter((k) => sheet.speed[k] > 0);
  if (otherSpeeds.length) mid.entry("Other speeds", otherSpeeds.map((k) => `${k} ${sheet.speed[k]} ft.`).join(", "));
  mid.heading("Equipment");
  if (state.inventory.length === 0) mid.paragraph("—", { color: pal.muted });
  for (const item of state.inventory) {
    const name = item.name || registry.get(item.id)?.name || item.id;
    const flags = [item.equipped && "equipped", item.attuned && "attuned"].filter(Boolean).join(", ");
    mid.paragraph(`${item.quantity > 1 ? `${item.quantity}x ` : ""}${name}${flags ? ` (${flags})` : ""}`, { gap: 0 });
  }
  const coins = (["pp", "gp", "ep", "sp", "cp"] as const).filter((c) => state.currency[c]).map((c) => `${state.currency[c]} ${c}`);
  if (coins.length) {
    mid.space(3);
    mid.paragraph(`Coins: ${coins.join(", ")}`, { color: pal.muted });
  }
  if (sheet.warnings.length) {
    mid.heading("Open choices");
    for (const w of sheet.warnings.slice(0, 12)) mid.paragraph(w, { size: 7, color: pal.muted, gap: 0 });
  }

  // Column 3: features (flows onto continuation pages).
  const col3 = col2 + col2w + 12;
  const feat = new Flow(ctx, page, col3, W - MARGIN - col3, y, "Features & Traits (continued)");
  feat.heading("Features & Traits");
  for (const f of sheet.features) {
    const meta = [f.origin, f.usage, f.action].filter(Boolean).join(" · ");
    feat.entry(f.name, f.text, meta);
  }

  // Spellcasting.
  if (sheet.spellcasting.length) {
    const sp = ctx.newPage();
    ctx.pageTitle(sp, "Spellcasting");
    const flow = new Flow(ctx, sp, MARGIN, sp.getWidth() - 2 * MARGIN, sp.getHeight() - MARGIN - 28, "Spellcasting (continued)");
    if (sheet.multiclassSpellcasting) {
      flow.paragraph(`Multiclass spellcaster level ${sheet.multiclassSpellcasting.casterLevel}: spell slots are shared between your spellcasting classes.`, { color: pal.muted });
    }
    for (const sc of sheet.spellcasting) {
      flow.heading(sc.name);
      const parts = [
        `Ability ${sc.ability}`,
        `Spell attack ${formatModifier(sc.attack)}`,
        `Save DC ${sc.dc}`,
        sc.prepareCount !== undefined ? `Prepared ${sc.preparedCount}/${sc.prepareCount}` : "",
        sc.cantripsKnown !== undefined ? `Cantrips ${sc.cantripsKnown}` : "",
        sc.spellsKnown !== undefined ? `Spells known ${sc.spellsKnown}` : "",
      ].filter(Boolean);
      flow.paragraph(parts.join("    "), { font: bold });
      const slots = sc.slots.map((n, i) => (n > 0 ? `${i + 1}: ${"o ".repeat(Math.min(n, 9)).trim()}` : "")).filter(Boolean);
      if (slots.length) flow.paragraph(`Slots   ${slots.join("     ")}`);
      const levels = [...new Set(sc.spells.map((s) => s.level))].sort((a, b) => a - b);
      for (const lv of levels) {
        const list = sc.spells.filter((s) => s.level === lv);
        flow.paragraph(lv === 0 ? "Cantrips" : `Level ${lv}`, { font: bold, size: 8, gap: 0 });
        const names = list.map((s) => `${s.prepared || lv === 0 ? "[x]" : "[ ]"} ${s.name}${s.alwaysPrepared && lv > 0 ? " (always)" : ""}`);
        flow.paragraph(names.join("     "), { size: 8, indent: 8, gap: 4 });
      }
      if (sc.spells.length === 0) flow.paragraph("No spells chosen yet.", { color: pal.muted });
    }
    // Spell descriptions for prepared spells.
    const details = sheet.spellcasting.flatMap((sc) => sc.spells.filter((s) => s.prepared));
    if (details.length) {
      flow.heading("Spell details");
      const seen = new Set<string>();
      for (const s of details) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const el = registry.get(s.id);
        if (!el) continue;
        const get = (k: string) => el.setters.find((x) => x.name === k)?.value;
        const metaLine = [get("time"), get("range"), get("duration")].filter(Boolean).join(" · ");
        flow.entry(el.name, stripHtml(el.description), metaLine);
      }
    }
  }

  // Companion.
  if (sheet.companion) {
    const c = sheet.companion;
    const cp = ctx.newPage();
    ctx.pageTitle(cp, `Companion: ${c.name}`);
    const flow = new Flow(ctx, cp, MARGIN, cp.getWidth() - 2 * MARGIN, cp.getHeight() - MARGIN - 28, "Companion (continued)");
    flow.paragraph(c.summary, { color: pal.muted });
    const speeds = [`${c.speed.walk} ft.`, ...(["climb", "swim", "fly", "burrow"] as const).filter((k) => c.speed[k] > 0).map((k) => `${k} ${c.speed[k]} ft.`)];
    flow.paragraph(`Armor Class ${c.armorClass}    Hit Points ${c.maxHp}    Speed ${speeds.join(", ")}    Initiative ${formatModifier(c.initiative)}`, { font: bold });
    flow.paragraph(c.abilities.map((a) => `${a.ability.slice(0, 3).toUpperCase()} ${a.score} (${formatModifier(a.modifier)})`).join("    "));
    const saves = c.savingThrows.filter((s) => s.proficient);
    if (saves.length) flow.entry("Saving Throws", saves.map((s) => `${s.name.slice(0, 3)} ${formatModifier(s.total)}`).join(", "));
    if (c.skills.length) flow.entry("Skills", c.skills.map((s) => `${s.name} ${formatModifier(s.total)}`).join(", "));
    for (const d of c.defenses) flow.paragraph(d);
    if (c.senses) flow.entry("Senses", c.senses);
    flow.entry("Languages", `${c.languages}    Challenge ${c.challenge}    Proficiency ${formatModifier(c.proficiencyBonus)}`);
    for (const [title, list] of [["Traits", c.traits], ["Actions", c.actions], ["Reactions", c.reactions]] as const) {
      if (!list.length) continue;
      flow.heading(title);
      for (const f of list) flow.entry(f.name, f.text);
    }
  }

  // Background and notes.
  const d = state.details;
  const story: [string, string][] = [
    ["Personality Traits", d.traits],
    ["Ideals", d.ideals],
    ["Bonds", d.bonds],
    ["Flaws", d.flaws],
    ["Appearance", [d.age && `Age ${d.age}`, d.height && `Height ${d.height}`, d.weight && `Weight ${d.weight}`, d.eyes && `Eyes ${d.eyes}`, d.skin && `Skin ${d.skin}`, d.hair && `Hair ${d.hair}`].filter(Boolean).join(", ")],
    ["Backstory", d.backstory],
    ["Allies & Organizations", [d.organization, d.allies].filter(Boolean).join("\n")],
    ["Notes", d.notes],
  ];
  if (story.some(([, v]) => v)) {
    const bp = ctx.newPage();
    ctx.pageTitle(bp, "Background & Notes");
    const flow = new Flow(ctx, bp, MARGIN, bp.getWidth() - 2 * MARGIN, bp.getHeight() - MARGIN - 28, "Background & Notes (continued)");
    for (const [title, value] of story) {
      if (!value) continue;
      flow.heading(title);
      flow.paragraph(value);
    }
  }

  return doc.save();
}

/** Embed a PNG or JPEG data URL; other or broken images are left out of the PDF. */
async function embedPortrait(doc: PDFDocument, dataUrl: string | undefined): Promise<PDFImage | null> {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return m[1] === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{2,}/g, "\n")
    .trim();
}

import type {
  ElementDef,
  GrantRule,
  MulticlassInfo,
  Rule,
  SelectRule,
  Setter,
  SheetInfo,
  SpellcastingInfo,
  StatRule,
} from "./model.js";
import { childElements, firstChild, innerXml, parseXml, textContent, type XmlElement } from "./xml.js";

export interface ParseWarning {
  file?: string;
  element?: string;
  message: string;
}

export interface AppendDef {
  id: string;
  supports: string[];
  setters: Setter[];
  rules: Rule[];
  spellcasting?: SpellcastingInfo;
}

export interface ElementsFileInfo {
  name?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  version?: string;
  updateUrl?: string;
}

export interface ParsedElementsFile {
  info: ElementsFileInfo;
  elements: ElementDef[];
  appends: AppendDef[];
  warnings: ParseWarning[];
}

/**
 * Old content uses verbose stat names ("Strength Modifier"); map them to the
 * colon-separated, lower-case names used everywhere else.
 */
const LEGACY_STAT_NAMES: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const a of ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]) {
    const l = a.toLowerCase();
    m[`${a} Maximum`] = `${l}:max`;
    m[`${a} Modifier`] = `${l}:modifier`;
    m[`${a} Saving Throw Proficiency`] = `${l}:save:proficiency`;
    m[`${a} Saving Throw Misc`] = `${l}:save:misc`;
  }
  for (const s of [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation",
    "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival",
  ]) {
    const l = s.toLowerCase();
    m[`${s} Proficiency`] = `${l}:proficiency`;
    m[`${s} Misc`] = `${l}:misc`;
    m[`${s} Passive`] = `${l}:passive`;
  }
  m["Proficiency Half"] = "proficiency:half";
  m["Proficiency Half Rounded Down"] = "proficiency:half";
  m["Proficiency Half Rounded Up"] = "proficiency:half:up";
  m["ac:dexterity:mod:cap:armor:medium"] = "ac:armored:dexterity:cap";
  return m;
})();

export function normalizeStatName(name: string): string {
  const trimmed = name.trim();
  return (LEGACY_STAT_NAMES[trimmed] ?? trimmed).toLowerCase();
}

function normalizeStatValue(raw: string): string {
  const v = raw.trim();
  if (/^[+-]?\d+$/.test(v)) return String(parseInt(v, 10));
  if (v.startsWith("-")) return "-" + normalizeStatName(v.slice(1));
  return normalizeStatName(v.replace(/^\+/, ""));
}

function int(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return v.trim().toLowerCase() === "true";
}

function nonEmpty(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function parseSetters(parent: XmlElement): Setter[] {
  const node = firstChild(parent, "setters");
  if (!node) return [];
  const out: Setter[] = [];
  for (const s of childElements(node)) {
    const { name, ...rest } = s.attrs;
    if (name === undefined) continue;
    out.push({ name, value: textContent(s).trim(), attrs: rest });
  }
  return out;
}

function parseSupportsList(text: string | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const part of text.split(",")) {
    const t = part.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function parseRules(parent: XmlElement, ctx: { file?: string; element?: string; warnings: ParseWarning[] }): Rule[] {
  const node = firstChild(parent, "rules");
  if (!node) return [];
  const rules: Rule[] = [];
  for (const r of childElements(node)) {
    const a = r.attrs;
    switch (r.name) {
      case "grant": {
        const id = nonEmpty(a.id) ?? nonEmpty(a.name);
        if (!id) {
          ctx.warnings.push({ ...ctx, message: "grant without id" });
          break;
        }
        const setters: Record<string, string> = {};
        if (a.spellcasting !== undefined) setters.spellcasting = a.spellcasting;
        if (a.prepared !== undefined) setters.prepared = a.prepared;
        // Some content grants several ids at once: id="ID_A,ID_B".
        for (const one of id.split(",").map((s) => s.trim()).filter(Boolean)) {
          const g: GrantRule = {
            kind: "grant",
            type: (a.type ?? "").trim(),
            id: one,
            level: int(a.level, 1),
            requirements: nonEmpty(a.requirements),
            setters,
          };
          rules.push(g);
        }
        break;
      }
      case "select": {
        const s: SelectRule = {
          kind: "select",
          type: (a.type ?? "").trim(),
          name: nonEmpty(a.name) ?? `${(a.type ?? "").trim()} (${ctx.element ?? "?"})`,
          number: Math.max(1, int(a.number, 1)),
          level: int(a.level, 1),
          requirements: nonEmpty(a.requirements),
          supports: nonEmpty(a.supports),
          optional: bool(a.optional),
          default: nonEmpty(a.default),
          spellcasting: nonEmpty(a.spellcasting),
          prepared: a.prepared !== undefined ? bool(a.prepared) : undefined,
          items: [],
          stat: nonEmpty(a.stat),
        };
        if (s.type === "List") {
          for (const item of childElements(r, "item")) {
            s.items.push({ id: int(item.attrs.id, s.items.length + 1), text: textContent(item).trim() });
          }
        }
        rules.push(s);
        break;
      }
      case "stat": {
        if (a.name === undefined || a.value === undefined) {
          ctx.warnings.push({ ...ctx, message: "stat without name or value" });
          break;
        }
        const st: StatRule = {
          kind: "stat",
          name: normalizeStatName(a.name),
          value: normalizeStatValue(a.value),
          bonus: nonEmpty(a.bonus),
          level: int(a.level, 1),
          requirements: nonEmpty(a.requirements),
          equipped: nonEmpty(a.equipped),
          inline: bool(a.inline),
          maximum: nonEmpty(a.maximum ?? a.cap)?.toLowerCase(),
          minimum: nonEmpty(a.minimum)?.toLowerCase(),
          alt: nonEmpty(a.alt),
          merge: bool(a.merge),
        };
        rules.push(st);
        break;
      }
      default:
        ctx.warnings.push({ ...ctx, message: `unknown rule <${r.name}>` });
    }
  }
  return rules;
}

function parseDescription(el: XmlElement): string {
  const d = firstChild(el, "description");
  if (!d || d.children.length === 0) return "";
  const first = d.children[0];
  if (first.kind === "text" && first.cdata) return first.text.trim();
  const significant = d.children.filter((c) => !(c.kind === "text" && !c.text.trim()));
  if (significant.length === 1 && significant[0].kind === "element" && significant[0].name === "html") {
    return innerXml(significant[0]).trim();
  }
  return innerXml(d).trim();
}

function parseSheet(el: XmlElement): SheetInfo | undefined {
  const s = firstChild(el, "sheet");
  if (!s) return undefined;
  return {
    display: s.attrs.display === undefined ? true : bool(s.attrs.display, true),
    alt: nonEmpty(s.attrs.alt),
    usage: nonEmpty(s.attrs.usage),
    action: nonEmpty(s.attrs.action),
    descriptions: childElements(s).map((d) => ({
      text: textContent(d).trim(),
      level: int(d.attrs.level, 1),
      usage: nonEmpty(d.attrs.usage),
      action: nonEmpty(d.attrs.action),
    })),
  };
}

function parseSpellcasting(el: XmlElement): SpellcastingInfo | undefined {
  const s = firstChild(el, "spellcasting");
  if (!s) return undefined;
  const info: SpellcastingInfo = {
    name: nonEmpty(s.attrs.name) ?? "",
    ability: nonEmpty(s.attrs.ability) ?? "",
    prepare: bool(s.attrs.prepare),
    extend: bool(s.attrs.extend),
    allowReplace: bool(s.attrs.allowReplace),
    all: bool(s.attrs.all),
    listKnown: false,
    extendLists: [],
  };
  for (const c of childElements(s)) {
    const known = bool(c.attrs.known);
    if (c.name === "list") {
      info.list = textContent(c).trim();
      info.listKnown = known;
    } else if (c.name === "extend") {
      info.extendLists.push({ expression: textContent(c).trim(), known });
    }
  }
  return info;
}

function parseMulticlass(el: XmlElement, ctx: { file?: string; element?: string; warnings: ParseWarning[] }): MulticlassInfo | undefined {
  const m = firstChild(el, "multiclass");
  if (!m) return undefined;
  const id = nonEmpty(m.attrs.id);
  if (!id) {
    ctx.warnings.push({ ...ctx, message: "<multiclass> without id" });
    return undefined;
  }
  const req = firstChild(m, "requirements");
  const pre = firstChild(m, "prerequisite");
  const desc = firstChild(m, "description");
  return {
    id,
    requirements: req ? nonEmpty(textContent(req)) : undefined,
    prerequisite: pre ? nonEmpty(textContent(pre)) : undefined,
    description: desc ? innerXml(desc).trim() : undefined,
    setters: parseSetters(m),
    rules: parseRules(m, ctx),
  };
}

export function parseElementNode(node: XmlElement, file: string | undefined, warnings: ParseWarning[]): ElementDef | undefined {
  const id = nonEmpty(node.attrs.id);
  if (!id) {
    warnings.push({ file, element: node.attrs.name, message: "element without id" });
    return undefined;
  }
  const ctx = { file, element: id, warnings };
  const req = firstChild(node, "requirements");
  const pre = firstChild(node, "prerequisite") ?? firstChild(node, "prerequisites");
  const comp = firstChild(node, "compendium");
  const def: ElementDef = {
    id,
    name: (node.attrs.name ?? "").trim(),
    type: (node.attrs.type ?? "").trim(),
    source: (node.attrs.source ?? "").trim(),
    supports: parseSupportsList(firstChild(node, "supports") && textContent(firstChild(node, "supports")!)),
    requirements: req ? nonEmpty(textContent(req)) : undefined,
    prerequisite: pre ? nonEmpty(textContent(pre)) : undefined,
    description: parseDescription(node),
    sheet: parseSheet(node),
    setters: parseSetters(node),
    rules: parseRules(node, ctx),
    spellcasting: parseSpellcasting(node),
    multiclass: node.attrs.type?.trim() === "Class" ? parseMulticlass(node, ctx) : undefined,
    compendiumDisplay: comp ? bool(comp.attrs.display, true) : true,
    file,
  };
  if (!def.prerequisite) {
    const p = def.setters.find((s) => s.name.toLowerCase() === "prerequisite");
    if (p) def.prerequisite = p.value;
  }
  if (def.type === "Spell") addSpellSupports(def);
  if (def.type === "Companion") {
    // Companions can be filtered by creature type, size and challenge rating.
    for (const key of ["type", "size", "challenge"]) {
      const v = def.setters.find((s) => s.name === key)?.value?.trim();
      if (v && !def.supports.includes(v)) def.supports.push(v);
    }
  }
  return def;
}

/**
 * Spells implicitly support their level ("0" for cantrips), school, ritual tag,
 * casting time and components, so selects can filter with e.g.
 * supports="Wizard,0" or "$(spellcasting:list),Evocation".
 */
function addSpellSupports(def: ElementDef): void {
  const get = (name: string) => def.setters.find((s) => s.name === name)?.value?.trim();
  const add = (s: string | undefined) => {
    if (s && !def.supports.includes(s)) def.supports.push(s);
  };
  const level = parseInt(get("level") ?? "", 10);
  if (Number.isFinite(level)) add(String(level));
  const school = get("school");
  add(school);
  add(school?.toLowerCase());
  const isTrue = (name: string) => (get(name) ?? "").toLowerCase() === "true";
  if (isTrue("isRitual")) {
    add("Ritual");
    add("ID_INTERNAL_SUPPORT_RITUAL");
  }
  const time = (get("time") ?? "").toLowerCase();
  if (time.includes("bonus action")) add("ID_INTERNAL_SUPPORT_BONUS_ACTION");
  else if (time.includes("reaction")) add("ID_INTERNAL_SUPPORT_REACTION");
  else if (time.includes("action")) add("ID_INTERNAL_SUPPORT_ACTION");
  if (isTrue("hasVerbalComponent")) add("ID_INTERNAL_SUPPORT_VERBAL");
  if (isTrue("hasSomaticComponent")) add("ID_INTERNAL_SUPPORT_SOMATIC");
  if (isTrue("hasMaterialComponent")) add("ID_INTERNAL_SUPPORT_MATERIAL");
  if (isTrue("isConcentration")) add("ID_INTERNAL_SUPPORT_CONCENTRATION");
}

function parseInfo(root: XmlElement): ElementsFileInfo {
  const info = firstChild(root, "info");
  if (!info) return {};
  const name = firstChild(info, "name");
  const desc = firstChild(info, "description");
  const author = firstChild(info, "author");
  const update = firstChild(info, "update");
  const file = update && firstChild(update, "file");
  return {
    name: name ? textContent(name).trim() : undefined,
    description: desc ? textContent(desc).trim() : undefined,
    author: author ? textContent(author).trim() : undefined,
    authorUrl: author?.attrs.url,
    version: update?.attrs.version,
    updateUrl: file?.attrs.url,
  };
}

export function parseElementsFile(xml: string, file?: string): ParsedElementsFile {
  const root = parseXml(xml);
  const warnings: ParseWarning[] = [];
  const elements: ElementDef[] = [];
  const appends: AppendDef[] = [];
  if (root.name !== "elements") {
    warnings.push({ file, message: `expected <elements> root, found <${root.name}>` });
  }
  for (const node of childElements(root)) {
    if (node.name === "element") {
      const el = parseElementNode(node, file, warnings);
      if (el) elements.push(el);
    } else if (node.name === "append") {
      const id = nonEmpty(node.attrs.id);
      if (!id) continue;
      const ctx = { file, element: id, warnings };
      appends.push({
        id,
        supports: parseSupportsList(firstChild(node, "supports") && textContent(firstChild(node, "supports")!)),
        setters: parseSetters(node),
        rules: parseRules(node, ctx),
        spellcasting: parseSpellcasting(node),
      });
    }
  }
  return { info: parseInfo(root), elements, appends, warnings };
}

export interface IndexFileEntry {
  name: string;
  url: string;
}

export interface ParsedIndexFile {
  info: ElementsFileInfo;
  files: IndexFileEntry[];
}

/** Parse an Aurora *.index file: a manifest listing element files and nested indexes. */
export function parseIndexFile(xml: string): ParsedIndexFile {
  const root = parseXml(xml);
  const filesNode = firstChild(root, "files");
  const files: IndexFileEntry[] = [];
  if (filesNode) {
    for (const f of childElements(filesNode, "file")) {
      const name = nonEmpty(f.attrs.name);
      const url = nonEmpty(f.attrs.url);
      if (name && url) files.push({ name, url });
    }
  }
  return { info: parseInfo(root), files };
}

/**
 * Content validation: checks element files the way the app will load them and
 * reports problems a person (or a model converting a book) can fix.
 *
 * Base files (core, SRD, other packs) are loaded first and trusted; only the
 * target files are reported on. Checks:
 *
 *  - XML and element structure (ids, names, types, rules)
 *  - references: grants, select defaults and requirement ids must exist
 *  - selects must match at least one element
 *  - expressions must parse
 *  - per-type setters (spell level and school, class hit die, …)
 *  - reachability: something must grant or offer each element
 *  - test builds: classes, subclasses, races, subraces and backgrounds are put
 *    on a character with every choice made, which must resolve cleanly
 */
import { newCharacter, type CharacterState } from "./character.js";
import { ExpressionError, matchesSupports, parseExpression, type Expr } from "./expressions.js";
import { getSetter, type ElementDef, type Rule, type SelectRule } from "./model.js";
import { ContentRegistry } from "./registry.js";
import { resolveCharacter, selectionOptions, type ResolvedCharacter } from "./resolver.js";
import { buildSheet } from "./sheet.js";
import { parseXml, XmlParseError } from "./xml.js";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  file?: string;
  line?: number;
  element?: string;
  message: string;
}

export interface ContentFile {
  path: string;
  xml: string;
}

export interface ValidateOptions {
  /** Put classes, subclasses, races and backgrounds on test characters (default true). */
  build?: boolean;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  /** Elements defined by the target files. */
  elements: number;
  /** Target elements that replace an element from the base files. */
  overrides: number;
  /** Test characters built. */
  builds: number;
}

/**
 * Types that only make sense when something grants or offers them. Others are
 * either added by the user (items, options) or vocabulary other content may use
 * (proficiencies, languages, conditions…).
 */
const MUST_BE_REACHABLE = new Set([
  "Archetype", "Class Feature", "Archetype Feature", "Sub Race", "Racial Trait", "Background Feature", "Feat",
  "Feat Feature", "Spell", "Companion", "Companion Trait", "Companion Action", "Companion Reaction",
]);

/** Types every content set is expected to use, even if the base files don't. */
const COMMON_TYPES = [
  "Class", "Archetype", "Class Feature", "Archetype Feature", "Race", "Sub Race", "Racial Trait", "Race Variant",
  "Background", "Background Feature", "Background Variant", "Feat", "Feat Feature", "Spell", "Item", "Weapon", "Armor",
  "Magic Item", "Weapon Property", "Weapon Group", "Language", "Proficiency", "Companion", "Companion Trait",
  "Companion Action", "Companion Reaction", "Grants", "Condition", "Deity", "Alignment", "Option", "Support", "Rule",
  "Ability Score Improvement", "Multiclass", "Vision", "Size", "Damage Type", "Source", "Information", "Dragonmark",
];

const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const ABILITY_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

/** Types whose elements should explain themselves in the compendium. */
const DESCRIBED_TYPES = new Set([
  "Class", "Archetype", "Class Feature", "Archetype Feature", "Race", "Sub Race", "Racial Trait", "Background",
  "Background Feature", "Feat", "Spell", "Magic Item",
]);

const BUILD_TYPES = new Set(["Class", "Archetype", "Race", "Sub Race", "Background"]);

export function validateContent(base: ContentFile[], targets: ContentFile[], options: ValidateOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const registry = new ContentRegistry();
  const targetPaths = new Set(targets.map((t) => t.path));
  const sourceOf = new Map(targets.map((t) => [t.path, t.xml]));

  for (const f of base) registry.addXml(f.xml, f.path);
  const baseIds = new Set([...registry.all()].map((e) => e.id));
  const baseTypes = new Set([...registry.all()].map((e) => e.type));
  const baseWarnings = registry.warnings.length;

  for (const f of targets) {
    try {
      parseXml(f.xml);
    } catch (e) {
      const offset = e instanceof XmlParseError ? e.position : undefined;
      issues.push({
        severity: "error",
        file: f.path,
        line: offset === undefined ? undefined : lineAt(f.xml, offset),
        message: `not well-formed XML: ${(e as Error).message}`,
      });
      continue;
    }
    registry.addXml(f.xml, f.path);
  }
  registry.finalize();

  const lineOf = (el: { id: string; file?: string }) => {
    const xml = el.file ? sourceOf.get(el.file) : undefined;
    const at = xml?.indexOf(`id="${el.id}"`) ?? -1;
    return at >= 0 ? lineAt(xml!, at) : undefined;
  };
  const report = (severity: ValidationSeverity, el: ElementDef | undefined, message: string, file?: string) => {
    issues.push({ severity, file: el?.file ?? file, line: el ? lineOf(el) : undefined, element: el?.id, message });
  };

  // Loader warnings for target files (duplicates, unknown rules, unmatched appends…).
  const definedIn = new Map<string, string[]>();
  for (const w of registry.warnings.slice(baseWarnings)) {
    if (w.file && !targetPaths.has(w.file)) continue;
    const el = w.element ? registry.get(w.element) : undefined;
    if (w.message.startsWith("duplicate id")) {
      const previous = w.message.match(/from (.+)$/)?.[1] ?? "";
      if (targetPaths.has(previous)) {
        const files = definedIn.get(w.element!) ?? [previous];
        files.push(w.file!);
        definedIn.set(w.element!, files);
      }
      continue;
    }
    if (w.message === "append target not found") {
      issues.push({ severity: "error", element: w.element, message: `<append id="${w.element}"> targets an element that doesn't exist` });
      continue;
    }
    issues.push({ severity: "warning", file: w.file, line: el ? lineOf(el) : undefined, element: w.element, message: w.message });
  }
  for (const [id, files] of definedIn) {
    report("error", registry.get(id), `id is defined more than once (${[...new Set(files)].join(", ")}); the last one wins`);
  }

  const all = [...registry.all()];
  const targetEls = all.filter((e) => e.file && targetPaths.has(e.file));
  const overrides = targetEls.filter((e) => baseIds.has(e.id)).length;
  if (overrides) {
    issues.push({ severity: "info", message: `${overrides} element(s) replace elements with the same id from the base content` });
  }

  const graph = buildGraph(all);
  const knownTypes = new Set([...baseTypes, ...COMMON_TYPES]);

  for (const el of targetEls) {
    // Multiclass elements are synthesized from their class, which is checked instead.
    if (el.type === "Multiclass" && registry.classOfMulticlass(el.id)) continue;
    checkElement(el, registry, graph, knownTypes, report);
  }

  let builds = 0;
  if (options.build ?? true) {
    builds = runBuilds(registry, graph, targetEls, report);
  }

  return { issues: dedupe(issues), elements: targetEls.length, overrides, builds };
}

// ---------------------------------------------------------------------------
// Static checks

interface Graph {
  /** id -> elements that grant it (rules, multiclass rules, companion feature lists). */
  grantedBy: Map<string, ElementDef[]>;
  selects: { owner: ElementDef; rule: SelectRule }[];
  /** Spell list expressions of every caster and list extension. */
  casterLists: string[];
  /** Spells added to lists by id. */
  extraSpells: Set<string>;
}

function buildGraph(all: ElementDef[]): Graph {
  const grantedBy = new Map<string, ElementDef[]>();
  const selects: Graph["selects"] = [];
  const casterLists = new Set<string>();
  const extraSpells = new Set<string>();
  const addGrant = (id: string, by: ElementDef) => {
    const list = grantedBy.get(id) ?? [];
    list.push(by);
    grantedBy.set(id, list);
  };
  for (const el of all) {
    for (const r of rulesOf(el)) {
      if (r.kind === "grant") addGrant(r.id, el);
      else if (r.kind === "select") selects.push({ owner: el, rule: r });
    }
    for (const key of ["traits", "actions", "reactions"]) {
      for (const id of (getSetter(el, key) ?? "").split(",").map((s) => s.trim())) if (id.startsWith("ID_")) addGrant(id, el);
    }
    const sc = el.spellcasting;
    if (sc) {
      if (sc.list) casterLists.add(sc.list);
      if (sc.name && !sc.extend) casterLists.add(sc.name);
      for (const e of sc.extendLists) {
        if (/^ID_\w+(\s*,\s*ID_\w+)*$/.test(e.expression)) for (const id of e.expression.split(",")) extraSpells.add(id.trim());
        else casterLists.add(e.expression);
      }
    }
  }
  return { grantedBy, selects, casterLists: [...casterLists], extraSpells };
}

function rulesOf(el: ElementDef): Rule[] {
  return el.multiclass ? [...el.rules, ...el.multiclass.rules] : el.rules;
}

/** Whether a select could ever offer this element, without a character to evaluate variables against. */
function selectCanOffer(rule: SelectRule, el: ElementDef, graph: Graph): boolean {
  if (rule.type !== el.type || rule.type === "List") return false;
  const supports = rule.supports;
  if (!supports || !supports.includes("$(")) return matchesSupports(supports, el);
  if (el.type === "Spell" && graph.extraSpells.has(el.id)) return true;
  const lists = rule.spellcasting ? [rule.spellcasting, ...graph.casterLists] : graph.casterLists;
  return lists.some((list) =>
    matchesSupports(supports, el, (name) =>
      name === "spellcasting:list" ? `(${list})` : name === "spellcasting:slots" ? "(1||2||3||4||5||6||7||8||9)" : undefined,
    ),
  );
}

function checkExpression(
  src: string | undefined,
  what: string,
  el: ElementDef,
  registry: ContentRegistry,
  report: Reporter,
  checkIds: boolean,
): void {
  if (!src || !src.trim()) return;
  let expr: Expr;
  try {
    expr = parseExpression(src);
  } catch (e) {
    report("error", el, `${what} "${src}" doesn't parse: ${e instanceof ExpressionError ? e.message : String(e)}`);
    return;
  }
  if (!checkIds) return;
  for (const id of exprIds(expr)) {
    if (!registry.get(id)) report("warning", el, `${what} refers to ${id}, which isn't loaded`);
  }
}

function exprIds(e: Expr): string[] {
  switch (e.op) {
    case "and":
    case "or":
      return [...exprIds(e.left), ...exprIds(e.right)];
    case "not":
      return exprIds(e.expr);
    case "id":
      return [e.id];
    default:
      return [];
  }
}

type Reporter = (severity: ValidationSeverity, el: ElementDef | undefined, message: string) => void;

function checkElement(el: ElementDef, registry: ContentRegistry, graph: Graph, knownTypes: Set<string>, report: Reporter): void {
  if (!/^ID_[A-Z0-9_]+$/.test(el.id)) report("warning", el, "ids should be upper case: ID_ followed by A-Z, 0-9 and _");
  if (!el.name) report("error", el, "missing name attribute");
  if (!el.type) report("error", el, "missing type attribute");
  else if (!knownTypes.has(el.type)) report("warning", el, `type "${el.type}" isn't used by any other content; check the spelling`);
  if (!el.source) report("warning", el, "missing source attribute");
  if (DESCRIBED_TYPES.has(el.type) && el.compendiumDisplay && !el.description.trim()) report("warning", el, "empty description");

  checkExpression(el.requirements, "requirements", el, registry, report, true);

  for (const r of rulesOf(el)) {
    checkExpression(r.requirements, `${r.kind} requirements`, el, registry, report, true);
    if (r.kind === "grant") {
      const target = registry.get(r.id);
      if (!target) report("error", el, `grants ${r.id}, which doesn't exist`);
      else if (r.type && target.type !== r.type && !(r.type === "Class" && target.type === "Multiclass")) {
        report("warning", el, `grant of ${r.id} says type "${r.type}" but the element is a "${target.type}"`);
      }
      if (r.level < 1 || r.level > 20) report("warning", el, `grant of ${r.id} has level ${r.level}`);
    } else if (r.kind === "select") {
      checkSelect(el, r, registry, graph, report);
    } else {
      if (r.equipped) checkExpression(r.equipped, "stat equipped", el, registry, report, false);
      if (!r.inline && !/^-?\d+$/.test(r.value) && !/^-?[a-z][\w:\- ]*$/i.test(r.value)) {
        report("warning", el, `stat ${r.name} has value "${r.value}", which is neither a number nor a statistic name`);
      }
    }
  }

  checkSetters(el, registry, report);

  if (MUST_BE_REACHABLE.has(el.type) && !isReachable(el, graph)) {
    report("warning", el, "nothing grants or offers this element; it only shows up in the compendium");
  }
}

function checkSelect(el: ElementDef, r: SelectRule, registry: ContentRegistry, graph: Graph, report: Reporter): void {
  const label = `select "${r.name}"`;
  if (r.type === "List") {
    if (r.items.length === 0) report("error", el, `${label} has type="List" but no <item> children`);
    return;
  }
  if (!r.type) {
    report("error", el, `${label} has no type`);
    return;
  }
  const ofType = registry.ofType(r.type);
  if (ofType.length === 0) {
    report("error", el, `${label} chooses type "${r.type}", but no element has that type`);
    return;
  }
  if (r.supports && !r.supports.includes("$(")) checkExpression(r.supports, `${label} supports`, el, registry, report, false);
  const matches = ofType.filter((c) => selectCanOffer(r, c, graph));
  if (matches.length === 0) {
    report("error", el, `${label} (type "${r.type}", supports "${r.supports ?? ""}") matches no elements`);
  } else if (matches.length < r.number) {
    report("warning", el, `${label} asks for ${r.number} choices but only ${matches.length} element(s) match`);
  }
  if (r.default && !registry.get(r.default) && !/^\d+$/.test(r.default)) {
    report("warning", el, `${label} has default ${r.default}, which doesn't exist`);
  }
  if (r.level < 1 || r.level > 20) report("warning", el, `${label} has level ${r.level}`);
}

function checkSetters(el: ElementDef, registry: ContentRegistry, report: Reporter): void {
  const get = (name: string) => getSetter(el, name)?.trim();
  switch (el.type) {
    case "Spell": {
      const level = get("level");
      if (level === undefined || !/^\d$/.test(level)) report("error", el, `spell level setter must be 0-9 (found "${level ?? ""}")`);
      const school = get("school");
      if (!school) report("error", el, "spell has no school setter");
      else if (!SCHOOLS.includes(school)) report("warning", el, `school "${school}" isn't one of ${SCHOOLS.join(", ")}`);
      for (const name of ["time", "range", "duration"]) if (!get(name)) report("warning", el, `spell has no ${name} setter`);
      const flags = ["hasVerbalComponent", "hasSomaticComponent", "hasMaterialComponent"];
      if (!flags.some((f) => get(f)?.toLowerCase() === "true")) report("warning", el, "spell has no components (hasVerbalComponent etc.)");
      if (get("hasMaterialComponent")?.toLowerCase() === "true" && !get("materialComponent")) {
        report("info", el, "spell has a material component but no materialComponent text");
      }
      for (const f of [...flags, "isConcentration", "isRitual"]) {
        const v = get(f);
        if (v !== undefined && v !== "true" && v !== "false") report("warning", el, `${f} should be "true" or "false" (found "${v}")`);
      }
      if (el.supports.length === 0 || !el.supports.some((s) => !/^\d$/.test(s) && !s.startsWith("ID_INTERNAL") && !SCHOOLS.includes(s) && s !== "Ritual" && s !== s.toLowerCase())) {
        report("warning", el, "spell has no <supports> naming the spell lists it belongs to (e.g. Wizard, Cleric)");
      }
      break;
    }
    case "Class": {
      const hd = get("hd");
      if (!hd || !/^d(6|8|10|12)$/.test(hd)) report("error", el, `class hd setter must be d6, d8, d10 or d12 (found "${hd ?? ""}")`);
      if (!el.multiclass) report("info", el, "class has no <multiclass> node, so it can't be taken as a second class");
      break;
    }
    case "Weapon":
      if (!get("damage")) report("warning", el, "weapon has no damage setter");
      break;
    case "Armor":
      if (!get("armor")) report("warning", el, "armor has no armor setter (Light, Medium, Heavy or Shield)");
      if (!el.rules.some((r) => r.kind === "stat" && r.name.startsWith("ac"))) report("warning", el, "armor has no ac stat rule, so it won't change AC");
      break;
    case "Magic Item":
      if (!get("rarity")) report("warning", el, "magic item has no rarity setter");
      break;
    case "Companion":
      for (const a of ABILITY_NAMES) if (!get(a.toLowerCase())) report("warning", el, `companion has no ${a.toLowerCase()} setter`);
      if (!get("challenge")) report("warning", el, "companion has no challenge setter");
      for (const key of ["traits", "actions", "reactions"]) {
        for (const id of (get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
          if (!registry.get(id)) report("error", el, `${key} lists ${id}, which doesn't exist`);
        }
      }
      break;
  }
  if (el.spellcasting && !el.spellcasting.extend) {
    const ability = el.spellcasting.ability;
    if (!ABILITY_NAMES.includes(ability)) report("error", el, `spellcasting ability must be one of ${ABILITY_NAMES.join(", ")} (found "${ability}")`);
    if (!el.spellcasting.name) report("error", el, "<spellcasting> has no name");
  }
}

function isReachable(el: ElementDef, graph: Graph): boolean {
  if (graph.grantedBy.has(el.id)) return true;
  if (graph.selects.some((s) => selectCanOffer(s.rule, el, graph))) return true;
  if (el.type === "Spell") {
    if (graph.extraSpells.has(el.id)) return true;
    return graph.casterLists.some((list) => matchesSupports(list, el));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Test builds

interface BuildPlan {
  subject: ElementDef;
  classEl: ElementDef;
  levels: number;
  /** Elements to choose whenever a select offers them. */
  prefer: string[];
}

function offerersOf(el: ElementDef, graph: Graph): ElementDef[] {
  const out = [...(graph.grantedBy.get(el.id) ?? [])];
  for (const s of graph.selects) if (selectCanOffer(s.rule, el, graph)) out.push(s.owner);
  return out;
}

function planBuild(el: ElementDef, graph: Graph, defaultClass: ElementDef | undefined, isTarget: (e: ElementDef) => boolean): BuildPlan | null {
  // Breadth-first search up the grant/select graph for the class that leads to
  // this element, preferring paths through the content being checked.
  let chain: ElementDef[] = [el];
  // Without a class on the way, use the path to whatever a level offers (race, background…).
  let rootPath: ElementDef[] | undefined;
  if (el.type !== "Class") {
    const queue: ElementDef[][] = [[el]];
    const seen = new Set([el.id]);
    while (queue.length) {
      const path = queue.shift()!;
      if (path.length > 6) break;
      const offers = offerersOf(path[path.length - 1], graph).sort((a, b) => Number(isTarget(b)) - Number(isTarget(a)));
      const cls = offers.find((o) => o.type === "Class");
      if (cls) {
        chain = [...path, cls];
        rootPath = undefined;
        break;
      }
      if (!rootPath && offers.some((o) => o.type === "Level")) rootPath = path;
      for (const o of offers) {
        if (o.type === "Level" || seen.has(o.id)) continue;
        seen.add(o.id);
        queue.push([...path, o]);
      }
    }
  }
  if (rootPath) chain = rootPath;
  const classEl = chain.find((c) => c.type === "Class") ?? defaultClass;
  if (!classEl) return null;
  const progression = chain.some((c) => c.type === "Class");
  return { subject: el, classEl, levels: progression ? 20 : 5, prefer: chain.map((c) => c.id) };
}

function autoChoose(registry: ContentRegistry, state: CharacterState, prefer: Set<string>): ResolvedCharacter {
  let rc = resolveCharacter(registry, state);
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const point of rc.selections) {
      if (point.rule.type === "Class" || point.rule.optional) continue;
      if (!point.chosen.some((c) => c === null)) continue;
      if (point.rule.type === "List") {
        state.selections[point.key] = point.chosen.map((c) => c ?? String(point.rule.items[0]?.id ?? 1));
        changed = true;
        continue;
      }
      const options = selectionOptions(rc, point).filter((o) => o.available);
      options.sort((a, b) => Number(prefer.has(b.element.id)) - Number(prefer.has(a.element.id)));
      const picks = [...point.chosen];
      const used = new Set(picks.filter(Boolean));
      for (let i = 0; i < picks.length; i++) {
        if (picks[i]) continue;
        const next = options.find((o) => !used.has(o.element.id));
        if (!next) break;
        picks[i] = next.element.id;
        used.add(next.element.id);
      }
      if (picks.some((p, i) => p !== point.chosen[i])) {
        state.selections[point.key] = picks;
        changed = true;
      }
    }
    if (!changed) break;
    rc = resolveCharacter(registry, state);
  }
  return rc;
}

function runBuilds(registry: ContentRegistry, graph: Graph, targetEls: ElementDef[], report: Reporter): number {
  const targetIds = new Set(targetEls.map((e) => e.id));
  const isTarget = (e: ElementDef) => targetIds.has(e.id);
  const classes = registry.ofType("Class");
  const defaultClass = classes.find((c) => !isTarget(c) && c.name === "Fighter") ?? classes.find((c) => !isTarget(c)) ?? classes[0];
  let builds = 0;

  for (const el of targetEls) {
    if (!BUILD_TYPES.has(el.type)) continue;
    const plan = planBuild(el, graph, defaultClass, isTarget);
    if (!plan) {
      report("info", el, "no class is loaded, so no test character was built");
      continue;
    }
    const label = `test character (${plan.classEl.name} ${plan.levels})`;
    builds++;
    try {
      const state = newCharacter();
      state.rules = "2014"; // test every element, whatever edition it belongs to
      state.abilities = { strength: 15, dexterity: 14, constitution: 14, intelligence: 13, wisdom: 13, charisma: 13 };
      state.levels = Array(plan.levels).fill(plan.classEl.id);
      const rc = autoChoose(registry, state, new Set(plan.prefer));

      for (const id of plan.prefer) {
        if (!rc.ids.has(id)) {
          const missing = registry.get(id);
          report("warning", el, `${label}: couldn't add ${missing?.name ?? id} (${id}); check its requirements and the select or grant that adds it`);
          break;
        }
      }
      for (const issue of rc.issues) {
        if (issue.severity !== "info") report(issue.severity, el, `${label}: ${issue.message}`);
      }
      for (const point of rc.selections) {
        if (point.rule.optional || point.rule.type === "Class" || !point.chosen.some((c) => c === null)) continue;
        if (!isTarget(point.owner.element)) continue;
        const filled = point.chosen.filter(Boolean).length;
        report(
          "warning",
          point.owner.element,
          `${label}: select "${point.rule.name}" (level ${point.rule.level}) could only fill ${filled} of ${point.rule.number} choices`,
        );
      }
      const sheet = buildSheet(rc);
      for (const f of sheet.features) {
        if (targetIds.has(f.id) && `${f.text}${f.usage ?? ""}`.includes("{{")) {
          report("warning", registry.get(f.id), `${label}: sheet text has an unresolved {{placeholder}}: "${f.text.slice(0, 80)}"`);
        }
      }
    } catch (e) {
      report("error", el, `${label}: crashed: ${(e as Error).message}`);
    }
  }
  return builds;
}

// ---------------------------------------------------------------------------

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.severity}|${i.file}|${i.element}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

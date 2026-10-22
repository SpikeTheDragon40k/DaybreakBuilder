import {
  characterLevel,
  classLevels,
  PATH_SEP,
  selectionKey,
  type CharacterState,
  type EquipSlot,
  type InventoryItem,
} from "./character.js";
import { armorKind, isWeaponItem, itemElement } from "./items.js";
import { hasRevisedContent, hiddenByRules, supersededIn2024 } from "./editions.js";
import { evaluateString, isIdRange, matchesSupports, parseBracket } from "./expressions.js";
import {
  ABILITIES,
  ABILITY_ABBR,
  allowsDuplicate,
  getSetter,
  type Ability,
  type ElementDef,
  type GrantRule,
  type SelectRule,
  type StatRule,
} from "./model.js";
import type { ContentRegistry } from "./registry.js";
import { spellcastingVariables, spellLevel } from "./spellcasting.js";
import { companionBaseAbilities, companionProficiency } from "./companion.js";
import { StatValues, type StatContribution, type StatSeed } from "./stats.js";

export type Scope =
  | { kind: "character" }
  | { kind: "class"; classId: string; className: string; multiclass: boolean };

export type Acquisition =
  | { kind: "root" }
  | { kind: "grant"; rule: GrantRule }
  | { kind: "select"; point: SelectionPoint; slot: number }
  | { kind: "class"; multiclass: boolean };

export interface ResolvedNode {
  element: ElementDef;
  path: string;
  parent?: ResolvedNode;
  scope: Scope;
  /** Progression level used to gate this node's rules (class level or character level). */
  level: number;
  via: Acquisition;
  children: ResolvedNode[];
  selections: SelectionPoint[];
  /** Inventory entry when this node is an equipped item. */
  item?: InventoryItem;
}

export interface SelectionPoint {
  key: string;
  rule: SelectRule;
  owner: ResolvedNode;
  /** Valid choices per slot (invalid stored choices become null). */
  chosen: (string | null)[];
  /** Stored choices that were rejected (no longer available / unknown). */
  rejected: string[];
}

export interface ResolveOptions {
  /** Cap ability scores at their maximum (default true). */
  useAbilityMaximum?: boolean;
  maxIterations?: number;
}

export interface ResolveIssue {
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
}

/** A companion in the tree and the statistics its stat block is computed from. */
export interface ResolvedCompanion {
  node: ResolvedNode;
  stats: StatValues;
}

export interface ResolvedCharacter {
  state: CharacterState;
  registry: ContentRegistry;
  roots: ResolvedNode[];
  nodes: ResolvedNode[];
  /** Element ids present (with multiplicity). */
  ids: Map<string, number>;
  selections: SelectionPoint[];
  stats: StatValues;
  /** Companions in tree order; with one companion its stats are `stats`. */
  companions: ResolvedCompanion[];
  /** Values of inline stat rules (text substitutions). */
  inline: Map<string, string>;
  level: number;
  classLevels: Map<string, number>;
  mainClass?: ElementDef;
  issues: ResolveIssue[];
  iterations: number;
}

const MAX_DEPTH = 48;

interface PassContext {
  prevIds: Map<string, number>;
  prevStats: StatValues | null;
  /** Ids granted directly by each path in the previous pass (for self-exclusion). */
  prevGrantedBy: Map<string, string[]>;
}

/**
 * Expand the character's element tree from its levels, choices and equipment.
 *
 * Requirements can depend on the full set of elements and on stats (which
 * themselves depend on the tree), so the tree is rebuilt until the set of
 * element ids and ability scores stop changing.
 */
export function resolveCharacter(
  registry: ContentRegistry,
  state: CharacterState,
  options: ResolveOptions = {},
): ResolvedCharacter {
  const useMax = options.useAbilityMaximum ?? true;
  const maxIterations = options.maxIterations ?? 10;
  let ctx: PassContext = { prevIds: new Map(), prevStats: null, prevGrantedBy: new Map() };
  let result: ResolvedCharacter | null = null;
  let prevSignature = "";

  for (let i = 1; i <= maxIterations; i++) {
    result = buildPass(registry, state, ctx, useMax);
    result.iterations = i;
    const signature = idSignature(result.ids) + "#" + ABILITIES.map((a) => result!.stats.abilityScore(a)).join(",");
    if (signature === prevSignature) break;
    if (i === maxIterations) {
      result.issues.push({ severity: "warning", message: "Rules did not settle; some requirements may conflict." });
    }
    prevSignature = signature;
    ctx = { prevIds: result.ids, prevStats: result.stats, prevGrantedBy: grantedByMap(result.nodes) };
  }
  return result!;
}

function idSignature(ids: Map<string, number>): string {
  return [...ids.entries()]
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join(";");
}

function grantedByMap(nodes: ResolvedNode[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.via.kind === "grant" && n.parent) {
      let list = m.get(n.parent.path);
      if (!list) m.set(n.parent.path, (list = []));
      list.push(n.element.id);
    }
  }
  return m;
}

function buildPass(registry: ContentRegistry, state: CharacterState, ctx: PassContext, useMax: boolean): ResolvedCharacter {
  const level = characterLevel(state);
  const perClass = classLevels(state);
  const issues: ResolveIssue[] = [];
  const nodes: ResolvedNode[] = [];
  const selections: SelectionPoint[] = [];
  const roots: ResolvedNode[] = [];
  const mainClassId = state.levels[0] || "";
  const mainClass = mainClassId ? registry.get(mainClassId) : undefined;
  if (mainClassId && !mainClass) issues.push({ severity: "error", message: `Class ${mainClassId} is not loaded.` });

  const characterScope: Scope = { kind: "character" };

  // Under the 2024 rules an older background also gets the ability scores and Origin feat it lacks.
  const revisedRules = state.rules === "2024" && hasRevisedContent(registry);
  const rulesOf = (el: ElementDef) => (revisedRules && el.type === "Background" ? withLegacyBackgroundRules(registry, el) : el.rules);

  const has = (id: string, exclude?: string[]): boolean => {
    const count = ctx.prevIds.get(id) ?? 0;
    if (count === 0) return false;
    if (!exclude) return true;
    const excluded = exclude.filter((x) => x === id).length;
    return count - excluded > 0;
  };

  const classLevelByName = (name: string): number | undefined => {
    for (const [id, lv] of perClass) {
      const el = registry.get(id);
      if (el && el.name.toLowerCase() === name) return lv;
    }
    return undefined;
  };

  const abilityScore = (a: Ability): number => ctx.prevStats?.abilityScore(a) ?? state.abilities[a];

  const bracket = (node: ResolvedNode | null) => (key: string, value: string): boolean => {
    const n = parseInt(value, 10);
    switch (key) {
      case "str": case "strength": return abilityScore("strength") >= n;
      case "dex": case "dexterity": return abilityScore("dexterity") >= n;
      case "con": case "constitution": return abilityScore("constitution") >= n;
      case "int": case "intelligence": return abilityScore("intelligence") >= n;
      case "wis": case "wisdom": return abilityScore("wisdom") >= n;
      case "cha": case "charisma": return abilityScore("charisma") >= n;
      case "character": return level >= n;
      case "level": return (node ? node.level : level) >= n;
      case "type": return [...ctx.prevIds.keys()].some((id) => registry.get(id)?.type.toLowerCase() === value);
      default: {
        const lv = classLevelByName(key) ?? (key.startsWith("level:") ? classLevelByName(key.slice(6)) : undefined);
        if (lv !== undefined) return lv >= n;
        if (key.startsWith("level:")) return false;
        const stats = ctx.prevStats;
        if (stats && stats.has(key)) return stats.get(key) >= n;
        return false;
      }
    }
  };

  const ruleAllowed = (requirements: string | undefined, node: ResolvedNode, selfExclude: boolean): boolean => {
    if (!requirements) return true;
    const exclude = selfExclude ? ctx.prevGrantedBy.get(node.path) : undefined;
    return evaluateString(requirements, { id: (id) => has(id, exclude), bracket: bracket(node) }, false);
  };

  const elementAllowed = (el: ElementDef, node: ResolvedNode | null): boolean => {
    if (!el.requirements) return true;
    return evaluateString(el.requirements, { id: (id) => has(id), bracket: bracket(node) }, false);
  };

  const sourceExcluded = (el: ElementDef): boolean => state.excludedSources.includes(el.source);

  const makeNode = (
    element: ElementDef,
    parent: ResolvedNode | undefined,
    scope: Scope,
    nodeLevel: number,
    via: Acquisition,
    item?: InventoryItem,
  ): ResolvedNode => ({
    element,
    path: parent ? parent.path + PATH_SEP + element.id : element.id,
    parent,
    scope,
    level: nodeLevel,
    via,
    children: [],
    selections: [],
    item,
  });

  const inAncestors = (node: ResolvedNode, id: string): boolean => {
    for (let n: ResolvedNode | undefined = node; n; n = n.parent) if (n.element.id === id) return true;
    return false;
  };

  const depthOf = (node: ResolvedNode): number => {
    let d = 0;
    for (let n = node.parent; n; n = n.parent) d++;
    return d;
  };

  const expandClass = (cls: ElementDef, parent: ResolvedNode, multiclass: boolean): void => {
    const classId = multiclass ? registry.classOfMulticlass(cls.id)?.id ?? cls.id : cls.id;
    const scope: Scope = { kind: "class", classId, className: cls.name, multiclass };
    const lv = perClass.get(classId) ?? 1;
    const child = makeNode(cls, parent, scope, lv, { kind: "class", multiclass });
    parent.children.push(child);
    expand(child);
  };

  const expand = (node: ResolvedNode): void => {
    nodes.push(node);
    if (depthOf(node) > MAX_DEPTH) {
      issues.push({ severity: "warning", message: `Element nesting too deep at ${node.element.name}`, path: node.path });
      return;
    }
    for (const rule of rulesOf(node.element)) {
      if (rule.kind === "stat") continue;
      if (rule.level > node.level) continue;
      if (rule.kind === "grant") {
        if (!ruleAllowed(rule.requirements, node, true)) continue;
        const target = registry.get(rule.id);
        if (!target) {
          issues.push({ severity: "warning", message: `${node.element.name} grants unknown element ${rule.id}`, path: node.path });
          continue;
        }
        if (!elementAllowed(target, node)) continue;
        if (inAncestors(node, target.id)) continue;
        if (node.children.some((c) => c.element.id === target.id && c.via.kind === "grant")) continue;
        const child = makeNode(target, node, node.scope, node.level, { kind: "grant", rule });
        node.children.push(child);
        expand(child);
      } else {
        if (rule.type === "Multiclass") continue; // handled through state.levels
        if (!ruleAllowed(rule.requirements, node, false)) continue;
        const key = selectionKey(node.path, rule.name, rule.level);
        const point: SelectionPoint = { key, rule, owner: node, chosen: [], rejected: [] };
        node.selections.push(point);
        selections.push(point);
        if (rule.type === "Class") {
          point.chosen = [mainClass ? mainClass.id : null];
          if (mainClass) expandClass(mainClass, node, false);
          continue;
        }
        const stored = state.selections[key] ?? [];
        for (let slot = 0; slot < rule.number; slot++) {
          let id = stored[slot] ?? null;
          if (id === null && rule.default && slot === 0 && !(key in state.selections)) id = rule.default;
          if (id === null) {
            point.chosen.push(null);
            continue;
          }
          if (rule.type === "List") {
            point.chosen.push(rule.items.some((it) => String(it.id) === id) ? id : null);
            continue;
          }
          const target = registry.get(id);
          if (!target || target.type !== rule.type || inAncestors(node, id)) {
            point.rejected.push(id);
            point.chosen.push(null);
            continue;
          }
          point.chosen.push(id);
          const child = makeNode(target, node, node.scope, node.level, { kind: "select", point, slot });
          node.children.push(child);
          expand(child);
        }
      }
    }
    // A level at which a new class is taken carries that class's multiclass element.
    if (node.element.type === "Level" && node.parent === undefined) {
      const lv = levelOf(node.element);
      if (lv >= 2) {
        const classId = state.levels[lv - 1];
        if (classId && classId !== mainClassId && state.levels.indexOf(classId) === lv - 1) {
          const marker = registry.get(`ID_INTERNAL_MULTICLASS_LEVEL_${lv}`);
          if (marker) {
            const m = makeNode(marker, node, characterScope, level, { kind: "root" });
            node.children.push(m);
            nodes.push(m);
          }
          const mc = registry.multiclassOf(classId);
          if (mc) expandClass(mc, node, true);
          else issues.push({ severity: "error", message: `Class ${registry.get(classId)?.name ?? classId} cannot be multiclassed (no multiclass definition loaded).` });
        }
      }
    }
  };

  // Roots: one Level element per character level.
  const levelElements = levelElementsByNumber(registry);
  for (let lv = 1; lv <= level; lv++) {
    const el = levelElements.get(lv);
    if (!el) {
      issues.push({ severity: "error", message: `No Level element for level ${lv}; is the core content loaded?` });
      continue;
    }
    const root = makeNode(el, undefined, characterScope, level, { kind: "root" });
    roots.push(root);
    expand(root);
  }

  // Roots: enabled options.
  for (const opt of registry.ofType("Option")) {
    const def = (getSetter(opt, "default") ?? "false").toLowerCase() === "true";
    const enabled = state.options[opt.id] ?? def;
    if (!enabled) continue;
    const root = makeNode(opt, undefined, characterScope, level, { kind: "root" });
    roots.push(root);
    expand(root);
  }

  // Roots: equipped or attuned inventory items.
  for (const item of state.inventory) {
    if (!item.equipped && !item.attuned) continue;
    const el = itemElement(registry, item);
    if (!el) {
      issues.push({ severity: "warning", message: `Inventory item ${item.id} is not loaded.` });
      continue;
    }
    if (needsAttunement(el) && !item.attuned) continue;
    const root = makeNode(el, undefined, characterScope, level, { kind: "root" }, item);
    root.path = `${el.id}@${item.uid}`;
    roots.push(root);
    expand(root);
  }

  const ids = new Map<string, number>();
  for (const n of nodes) ids.set(n.element.id, (ids.get(n.element.id) ?? 0) + 1);

  // Stats are evaluated against this pass's elements.
  const finalHas = (id: string) => (ids.get(id) ?? 0) > 0;
  const equipped = equippedEvaluator(registry, state.inventory, ids);
  const contributions: StatContribution[] = [];
  const owners: ResolvedNode[] = [];
  const inline = new Map<string, string>();
  for (const node of nodes) {
    for (const rule of node.element.rules) {
      if (rule.kind !== "stat" || rule.level > node.level) continue;
      if (rule.equipped && !evaluateString(rule.equipped, { bracket: equipped }, false)) continue;
      if (rule.requirements && !evaluateString(rule.requirements, { id: finalHas, bracket: bracket(node) }, false)) continue;
      if (rule.inline) {
        inline.set(rule.name, rule.value);
        continue;
      }
      contributions.push(statContribution(rule, node));
      owners.push(node);
    }
  }

  const companionNodes = nodes.filter((n) => n.element.type === "Companion");
  const seeds = seedStats(registry, state, perClass, level);
  const statsFor = (companion: ResolvedNode | undefined, list: StatContribution[]) =>
    new StatValues({
      contributions: list,
      seeds: companion
        ? [...seeds, { stat: "companion:proficiency", value: companionProficiency(companion.element), source: companion.element.name }]
        : seeds,
      baseAbilities: state.abilities,
      companionAbilities: companion ? companionBaseAbilities(companion.element) : undefined,
      useAbilityMaximum: useMax,
    });
  const stats = statsFor(companionNodes[0], contributions);
  const companions: ResolvedCompanion[] =
    companionNodes.length === 1
      ? [{ node: companionNodes[0], stats }]
      : companionNodes.map((c) => ({
          node: c,
          stats: statsFor(
            c,
            contributions.filter((x, i) => !x.stat.startsWith("companion:") || appliesToCompanion(owners[i], c, companionNodes)),
          ),
        }));

  return {
    state,
    registry,
    roots,
    nodes,
    ids,
    selections,
    stats,
    companions,
    inline,
    level,
    classLevels: perClass,
    mainClass,
    issues,
    iterations: 0,
  };
}

/** Elements whose subtree a companion belongs to: its companion:* rules apply to that companion only. */
const COMPANION_ANCHORS = new Set(["Class", "Multiclass", "Archetype", "Spell", "Feat", "Race", "Sub Race", "Background", "Magic Item"]);

function isWithin(node: ResolvedNode, ancestor: ResolvedNode): boolean {
  for (let n: ResolvedNode | undefined = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

function companionAnchor(companion: ResolvedNode): ResolvedNode | undefined {
  for (let n = companion.parent; n; n = n.parent) if (COMPANION_ANCHORS.has(n.element.type)) return n;
  return undefined;
}

/**
 * Whether a companion:* rule from `owner` modifies `companion` when the
 * character has several: a companion's own rules apply only to it, and a
 * feature's rules only to the companion granted by the same class, subclass,
 * spell or feat (Beast Master features don't touch a Find Familiar familiar).
 * Rules from anywhere else apply to every companion.
 */
function appliesToCompanion(owner: ResolvedNode, companion: ResolvedNode, all: ResolvedNode[]): boolean {
  if (isWithin(owner, companion)) return true;
  if (all.some((c) => c !== companion && isWithin(owner, c))) return false;
  const anchor = companionAnchor(companion);
  if (anchor && isWithin(owner, anchor)) return true;
  return !all.some((c) => {
    if (c === companion) return false;
    const other = companionAnchor(c);
    return other !== undefined && isWithin(owner, other);
  });
}

function statContribution(rule: StatRule, node: ResolvedNode): StatContribution {
  return {
    stat: rule.name,
    value: rule.value,
    bonus: rule.bonus,
    maximum: rule.maximum,
    minimum: rule.minimum,
    source: rule.alt ?? node.element.name,
  };
}

const BACKGROUND_ASI_MARKER = "ID_INTERNAL_GRANTS_BACKGROUND_ASI";
const LEGACY_BACKGROUND_ABILITY_SCORES = "ID_INTERNAL_LEGACY_BACKGROUND_ABILITY_SCORES";
const LEGACY_BACKGROUND_ORIGIN_FEAT = "ID_INTERNAL_LEGACY_BACKGROUND_ORIGIN_FEAT";
/** Community 2024 content's optional background feature that swaps the feature for an Origin feat. */
const OPTIONAL_ORIGIN_FEAT = "ID_WOTC_PHB24_BACKGROUND_FEATURE_ORIGIN_FEAT";

/**
 * A background's rules under the 2024 rules: one written before them (no
 * background ability scores, no feat) also lets the player raise three ability
 * scores and choose an Origin feat, as the 2024 Player's Handbook says.
 */
function withLegacyBackgroundRules(registry: ContentRegistry, el: ElementDef): ElementDef["rules"] {
  const extra: GrantRule[] = [];
  const add = (id: string, requirements?: string) => {
    if (registry.get(id)) extra.push({ kind: "grant", type: "Grants", id, level: 1, requirements, setters: {} });
  };
  if (!el.rules.some((r) => r.kind === "grant" && r.id === BACKGROUND_ASI_MARKER)) add(LEGACY_BACKGROUND_ABILITY_SCORES);
  // Not twice: some content offers the Origin feat as an optional background feature instead.
  if (!el.rules.some((r) => (r.kind === "grant" || r.kind === "select") && r.type === "Feat")) add(LEGACY_BACKGROUND_ORIGIN_FEAT, `!${OPTIONAL_ORIGIN_FEAT}`);
  return extra.length ? [...el.rules, ...extra] : el.rules;
}

export function levelOf(el: ElementDef): number {
  const v = getSetter(el, "Level") ?? el.name;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export function levelElementsByNumber(registry: ContentRegistry): Map<number, ElementDef> {
  const m = new Map<number, ElementDef>();
  for (const el of registry.ofType("Level")) {
    const n = levelOf(el);
    if (n > 0 && !m.has(n)) m.set(n, el);
  }
  return m;
}

export function maxLevel(registry: ContentRegistry): number {
  let max = 0;
  for (const n of levelElementsByNumber(registry).keys()) max = Math.max(max, n);
  return max;
}

export function needsAttunement(el: ElementDef): boolean {
  const v = getSetter(el, "attunement");
  return v !== undefined && v.trim().toLowerCase() !== "false" && v.trim() !== "";
}

export function hitDieSize(cls: ElementDef | undefined): number {
  const hd = cls ? getSetter(cls, "hd") ?? "" : "";
  const n = parseInt(hd.replace(/^d/i, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

/** Hit points gained per character level from class hit dice (without Constitution). */
export function hitDiceHitPoints(registry: ContentRegistry, state: CharacterState): { level: number; classId: string; hp: number }[] {
  const out: { level: number; classId: string; hp: number }[] = [];
  state.levels.forEach((classId, i) => {
    if (!classId) return;
    const die = hitDieSize(registry.get(classId));
    const lv = i + 1;
    let hp: number;
    if (lv === 1) hp = die;
    else if (state.hitPoints.method === "rolled" && state.hitPoints.rolls[lv]) hp = Math.min(die, Math.max(1, state.hitPoints.rolls[lv]));
    else hp = Math.floor(die / 2) + 1;
    out.push({ level: lv, classId, hp });
  });
  return out;
}

function seedStats(registry: ContentRegistry, state: CharacterState, perClass: Map<string, number>, level: number): StatSeed[] {
  const seeds: StatSeed[] = [{ stat: "level", value: level, source: "Character" }];
  for (const [id, lv] of perClass) {
    const cls = registry.get(id);
    if (!cls) continue;
    seeds.push({ stat: `level:${cls.name.toLowerCase()}`, value: lv, source: cls.name });
  }
  for (const entry of hitDiceHitPoints(registry, state)) {
    const cls = registry.get(entry.classId)!;
    seeds.push({ stat: `hp:${cls.name.toLowerCase()}`, value: entry.hp, source: `${cls.name} (level ${entry.level})` });
    seeds.push({ stat: "hp", value: entry.hp, source: `${cls.name} hit die (level ${entry.level})` });
  }
  const attuned = state.inventory.filter((i) => i.attuned).length;
  seeds.push({ stat: "attunement:current", value: attuned, source: "Inventory" });
  return seeds;
}

/** Evaluates [armor:light], [shield:any], [main:weapon]... against the inventory. */
function equippedEvaluator(registry: ContentRegistry, inventory: InventoryItem[], ids: Map<string, number>) {
  const inSlot = (slot: EquipSlot) => {
    const it = inventory.find((i) => i.equipped === slot);
    return it ? itemElement(registry, it) : undefined;
  };
  const has = (id: string) => (ids.get(id) ?? 0) > 0;
  const matchesItem = (el: ElementDef, v: string) => el.name.toLowerCase() === v || el.id.toLowerCase() === v;

  return (key: string, value: string): boolean => {
    const v = value.toLowerCase();
    switch (key) {
      case "armor": {
        const armor = inSlot("armor");
        const light = has("ID_INTERNAL_GRANTS_COUNTS_AS_EQUIPPED_LIGHT_ARMOR");
        const medium = has("ID_INTERNAL_GRANTS_COUNTS_AS_EQUIPPED_MEDIUM_ARMOR");
        const heavy = has("ID_INTERNAL_GRANTS_COUNTS_AS_EQUIPPED_HEAVY_ARMOR");
        const counts = has("ID_INTERNAL_GRANTS_COUNTS_AS_EQUIPPED_ARMOR") || light || medium || heavy;
        if (v === "" || v === "any") return !!armor || counts;
        if (v === "none") return !armor && !counts;
        if (!armor) return (v === "light" && light) || (v === "medium" && medium) || (v === "heavy" && heavy);
        return armorKind(armor) === v || matchesItem(armor, v);
      }
      case "shield": {
        const off = inSlot("offhand");
        const isShield = off && armorKind(off) === "shield";
        if (!isShield) return v === "none";
        if (v === "" || v === "any") return true;
        if (v === "none") return false;
        return matchesItem(off!, v);
      }
      case "main":
      case "primary":
      case "offhand":
      case "secondary": {
        const el = inSlot(key === "main" || key === "primary" ? "main" : "offhand");
        if ((key === "offhand" || key === "secondary") && el && armorKind(el) === "shield") return false;
        if (v === "" || v === "any") return !!el;
        if (v === "none") return !el;
        if (!el) return false;
        if (v === "weapon") return isWeaponItem(el);
        return matchesItem(el, v);
      }
      case "attunement":
      case "attuned":
        return inventory.some((i) => i.attuned && i.id.toLowerCase() === v);
      case "item":
        return inventory.some((i) => i.equipped && i.id.toLowerCase() === v);
      default:
        return false;
    }
  };
}

// ---------------------------------------------------------------------------
// Choices

export interface SelectionOption {
  element: ElementDef;
  /** False when requirements are unmet or it's already taken elsewhere. */
  available: boolean;
  reason?: string;
}

/** Candidates for a select rule, with availability. */
export function selectionOptions(rc: ResolvedCharacter, point: SelectionPoint): SelectionOption[] {
  const { registry } = rc;
  const rule = point.rule;
  if (rule.type === "List") return [];
  const dynamic = rule.supports?.includes("$(") ? spellcastingVariables(rc, point) : null;
  const vars = dynamic?.vars;
  const has = (id: string) => (rc.ids.get(id) ?? 0) > 0;
  const gainedAt = levelWhenGained(rc, point);
  const out: SelectionOption[] = [];
  // A 2014 element already on the character (such as a 2014 Elf) keeps its own 2014 options,
  // and a select that lists its options by id offers exactly those.
  let legacyOwner = rule.supports !== undefined && isIdRange(rule.supports);
  for (let n: ResolvedNode | undefined = point.owner; n && !legacyOwner; n = n.parent) legacyOwner = supersededIn2024(registry, n.element);
  for (const el of registry.ofType(rule.type)) {
    if (rc.state.excludedSources.includes(el.source) && !point.chosen.includes(el.id)) continue;
    if (!legacyOwner && hiddenByRules(registry, rc.state, el) && !point.chosen.includes(el.id)) continue;
    const extra =
      dynamic !== null &&
      dynamic.extraIds.includes(el.id) &&
      (!rule.supports!.includes("$(spellcasting:slots)") || dynamic.slotLevels.includes(spellLevel(el)));
    if (!extra && !matchesSupports(rule.supports, el, vars)) continue;
    let available = true;
    let reason: string | undefined;
    if (el.requirements) {
      const ok = evaluateString(
        el.requirements,
        {
          id: has,
          // Prerequisites such as "Level 19+" apply when the choice is gained, not at the current level.
          bracket: (key, value) => (key === "character" ? gainedAt >= parseInt(value, 10) : requireValue(rc, point.owner, key, value)),
        },
        false,
      );
      if (!ok) {
        available = false;
        reason = el.prerequisite ? `Requires ${el.prerequisite}` : "Requirements not met";
      }
    }
    if (available && !allowsDuplicate(el) && has(el.id) && !point.chosen.includes(el.id)) {
      available = false;
      reason = "Already chosen";
    }
    out.push({ element: el, available, reason });
  }
  return out;
}

/**
 * The character level at which a choice became available: a feat chosen at
 * fighter level 4 on a level 19 character was taken at the character level when
 * the fighter reached 4.
 */
export function levelWhenGained(rc: ResolvedCharacter, point: SelectionPoint): number {
  let needed = point.rule.level;
  let node: ResolvedNode | undefined = point.owner;
  const scope = node.scope;
  for (; node && node.scope.kind === scope.kind; node = node.parent) {
    if (node.via.kind === "grant") needed = Math.max(needed, node.via.rule.level);
    else if (node.via.kind === "select") needed = Math.max(needed, node.via.point.rule.level);
    if (!node.parent && node.element.type === "Level") needed = Math.max(needed, levelOf(node.element));
  }
  if (scope.kind === "class") {
    let count = 0;
    for (let i = 0; i < rc.state.levels.length; i++) {
      if (rc.state.levels[i] === scope.classId && ++count >= needed) return i + 1;
    }
    return rc.level;
  }
  return Math.min(rc.level, needed);
}

/**
 * One option per name and source. Content lists a feat that can be taken more
 * than once as copies ("Skilled", then "Skilled" requiring the first, ...);
 * the player should see one "Skilled". Keeps the copy already in the slot being
 * edited, else the first one that can still be taken, else the first.
 */
export function distinctOptions(options: SelectionOption[], point: SelectionPoint, current?: string | null): SelectionOption[] {
  const groups = new Map<string, SelectionOption[]>();
  for (const o of options) {
    const key = `${o.element.name}|${o.element.source}`;
    const group = groups.get(key);
    if (group) group.push(o);
    else groups.set(key, [o]);
  }
  return [...groups.values()].map(
    (g) =>
      g.find((o) => o.element.id === current) ??
      g.find((o) => o.available && !point.chosen.includes(o.element.id)) ??
      g.find((o) => o.available) ??
      g[0],
  );
}

/** Evaluate a single [key:value] requirement against a resolved character. */
export function requireValue(rc: ResolvedCharacter, node: ResolvedNode | null, key: string, value: string): boolean {
  const n = parseInt(value, 10);
  const abil = (ABILITIES as readonly string[]).find((a) => a === key || ABILITY_ABBR[a as Ability] === key) as Ability | undefined;
  if (abil) return rc.stats.abilityScore(abil) >= n;
  if (key === "character") return rc.level >= n;
  if (key === "level") return (node ? node.level : rc.level) >= n;
  if (key === "type") return [...rc.ids.keys()].some((id) => rc.registry.get(id)?.type.toLowerCase() === value);
  for (const [id, lv] of rc.classLevels) {
    const name = rc.registry.get(id)?.name.toLowerCase();
    if (name && (key === name || key === `level:${name}`)) return lv >= n;
  }
  return rc.stats.has(key) ? rc.stats.get(key) >= n : false;
}

/** Check a requirements string against a resolved character (for UI checks such as multiclass prerequisites). */
export function meetsRequirements(rc: ResolvedCharacter, requirements: string | undefined): boolean {
  return evaluateString(
    requirements,
    {
      id: (id) => (rc.ids.get(id) ?? 0) > 0,
      bracket: (k, v) => requireValue(rc, null, k, v),
    },
    false,
  );
}

export { parseBracket };

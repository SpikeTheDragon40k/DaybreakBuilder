import type { CharacterState } from "./character.js";
import { getSetter, type ElementDef } from "./model.js";
import type { ContentRegistry } from "./registry.js";

/** Which ruleset a character is built with: the 2014 books or the 2024 revision (5.5e). */
export type RulesEdition = "2014" | "2024";

/** Release date of the 2024 Player's Handbook; sources published from then on use the 2024 rules. */
const REVISED_RELEASE = 20240917;

/** The 2014 books the 2024 core rulebooks replace outright. */
const LEGACY_CORE = new Set([
  "player's handbook",
  "dungeon master's guide",
  "monster manual",
  "basic rules",
  "d&d basic rules",
  "system reference document",
  "system reference document 5.1",
]);

const norm = (s: string) => s.trim().toLowerCase().replace(/[‘’`]/g, "'");

interface EditionIndex {
  revisedSources: Set<string>;
  /** Element types that have at least one element from a 2024 source. */
  revisedTypes: Set<string>;
  /** `type|name` of every element published in a 2024 source. */
  revisedNames: Set<string>;
}

const indexes = new WeakMap<ContentRegistry, EditionIndex>();

function isRevisedSource(name: string, source: ElementDef | undefined): boolean {
  if (/\(20(2[4-9]|[3-9]\d)\)/.test(name) || /reference document 5\.2/i.test(name)) return true;
  if (!source) return false;
  const release = parseInt(getSetter(source, "release") ?? "", 10);
  if (release >= REVISED_RELEASE) return true;
  return /5\.5e?\b/i.test(getSetter(source, "information") ?? "");
}

function editionIndex(registry: ContentRegistry): EditionIndex {
  let idx = indexes.get(registry);
  if (idx) return idx;
  const sources = new Map<string, ElementDef>();
  for (const s of registry.ofType("Source")) sources.set(s.name, s);
  const revisedSources = new Set<string>();
  const revisedTypes = new Set<string>();
  const revisedNames = new Set<string>();
  const checked = new Map<string, boolean>();
  for (const el of registry.all()) {
    let revised = checked.get(el.source);
    if (revised === undefined) checked.set(el.source, (revised = isRevisedSource(el.source, sources.get(el.source))));
    if (!revised || el.type === "Source") continue;
    revisedSources.add(el.source);
    revisedTypes.add(el.type);
    revisedNames.add(`${el.type}|${norm(el.name)}`);
  }
  idx = { revisedSources, revisedTypes, revisedNames };
  indexes.set(registry, idx);
  return idx;
}

/** Whether any 2024-rules content (2024 PHB, SRD 5.2, ...) is loaded. */
export function hasRevisedContent(registry: ContentRegistry): boolean {
  return editionIndex(registry).revisedSources.size > 0;
}

/**
 * Whether the 2024 rules leave this element out: it comes from a 2014 core book
 * (PHB, DMG, MM, SRD 5.1) or has been reprinted under the same name in a 2024
 * source. Only applies when 2024 content of the same type is loaded, so a 2024
 * character never ends up with nothing to choose from.
 */
export function supersededIn2024(registry: ContentRegistry, el: ElementDef): boolean {
  const idx = editionIndex(registry);
  if (!idx.revisedTypes.has(el.type) || idx.revisedSources.has(el.source)) return false;
  return LEGACY_CORE.has(norm(el.source)) || idx.revisedNames.has(`${el.type}|${norm(el.name)}`);
}

/** Whether the character's ruleset hides this element from its choices. */
export function hiddenByRules(registry: ContentRegistry, state: Pick<CharacterState, "rules">, el: ElementDef): boolean {
  return state.rules === "2024" && supersededIn2024(registry, el);
}

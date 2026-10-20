/**
 * Import of Aurora Builder character files (*.dnd5e).
 *
 * Aurora stores the build as a tree: each <element> with an `id` is an
 * element on the character, and each <element> with `requiredLevel` is a
 * select rule whose choice is in `registered`. Our selection keys are built
 * from the same tree (path of element ids + select name), so the import maps
 * the tree directly onto `CharacterState.selections`.
 */
import { newCharacter, PATH_SEP, selectionKey, type CharacterState, type EquipSlot } from "./character.js";
import { ABILITIES } from "./model.js";
import type { ContentRegistry } from "./registry.js";
import { childElements, firstChild, parseXml, textContent, type XmlElement } from "./xml.js";

export interface AuroraImportResult {
  state: CharacterState;
  warnings: string[];
}

function text(el: XmlElement | undefined, name: string): string {
  const c = el && firstChild(el, name);
  return c ? textContent(c).trim() : "";
}

export function importAuroraCharacter(xml: string, registry: ContentRegistry): AuroraImportResult {
  const root = parseXml(xml);
  if (root.name !== "character") throw new Error("Not an Aurora character file");
  const warnings: string[] = [];
  const state = newCharacter();
  const build = firstChild(root, "build");
  if (!build) throw new Error("Character file has no build data");

  const input = firstChild(build, "input");
  state.name = text(input, "name") || text(firstChild(root, "display-properties"), "name") || "Imported Character";
  state.playerName = text(input, "player-name");
  state.experience = parseInt(text(input, "experience"), 10) || 0;
  state.details.gender = text(input, "gender");
  state.details.backstory = text(input, "backstory");
  state.details.traits = text(input, "background-traits");
  state.details.ideals = text(input, "background-ideals");
  state.details.bonds = text(input, "background-bonds");
  state.details.flaws = text(input, "background-flaws");
  const org = input && firstChild(input, "organization");
  state.details.organization = text(org, "name");
  state.details.allies = text(org, "allies");
  const appearance = firstChild(build, "appearance");
  for (const k of ["age", "height", "weight", "eyes", "skin", "hair"] as const) state.details[k] = text(appearance, k);
  const currency = input && firstChild(input, "currency");
  state.currency = {
    cp: parseInt(text(currency, "copper"), 10) || 0,
    sp: parseInt(text(currency, "silver"), 10) || 0,
    ep: parseInt(text(currency, "electrum"), 10) || 0,
    gp: parseInt(text(currency, "gold"), 10) || 0,
    pp: parseInt(text(currency, "platinum"), 10) || 0,
  };

  const abilities = firstChild(build, "abilities");
  for (const a of ABILITIES) {
    const v = parseInt(text(abilities, a), 10);
    if (Number.isFinite(v)) state.abilities[a] = v;
  }
  state.abilityMethod = "manual";

  const elements = firstChild(build, "elements");
  if (!elements) throw new Error("Character file has no elements");

  // Options present in the file are enabled; all others are disabled.
  for (const opt of registry.ofType("Option")) state.options[opt.id] = false;

  const levelNodes: XmlElement[] = [];
  for (const node of childElements(elements, "element")) {
    const type = node.attrs.type;
    if (type === "Option" && node.attrs.id) state.options[node.attrs.id] = true;
    if (type === "Level") levelNodes.push(node);
  }

  // Levels: which class each character level went to.
  let mainClass = "";
  const levels: string[] = [];
  const hpArrays = new Map<string, number[]>();
  levelNodes.forEach((node, i) => {
    if (i === 0) {
      const classSelect = childElements(node, "element").find((c) => c.attrs.type === "Class" && c.attrs.registered);
      mainClass = classSelect?.attrs.registered ?? "";
    }
    let classId = mainClass;
    if (node.attrs.multiclass === "true" && node.attrs.class) {
      const cls = registry.classOfMulticlass(node.attrs.class);
      classId = cls?.id ?? node.attrs.class;
      if (!cls) warnings.push(`Unknown multiclass ${node.attrs.class}`);
    }
    levels.push(classId);
    if (node.attrs.rndhp) {
      hpArrays.set(classId, node.attrs.rndhp.split(",").map((s) => parseInt(s, 10) || 0));
    }
  });
  if (levels.length) state.levels = levels;
  if (mainClass && !registry.get(mainClass)) warnings.push(`Class ${mainClass} is not in the loaded content`);

  // Rolled hit points: Aurora keeps one array per class (index = class level - 1).
  const averageHp = Object.entries(state.options).some(([id, on]) => on && id === "ID_INTERNAL_OPTION_ALLOW_AVERAGE_HP");
  if (!averageHp && hpArrays.size) {
    state.hitPoints.method = "rolled";
    const counters = new Map<string, number>();
    state.levels.forEach((cls, i) => {
      const n = counters.get(cls) ?? 0;
      counters.set(cls, n + 1);
      const roll = hpArrays.get(cls)?.[n];
      if (i > 0 && roll) state.hitPoints.rolls[i + 1] = roll;
    });
  }

  // Selections.
  const walk = (node: XmlElement, path: string) => {
    for (const child of childElements(node, "element")) {
      if (child.attrs.requiredLevel !== undefined || child.attrs.registered !== undefined) {
        const name = child.attrs.name ?? "";
        const type = child.attrs.type ?? "";
        if (type === "Class" || type === "Multiclass") {
          if (child.attrs.registered) walk(child, path + PATH_SEP + child.attrs.registered);
          continue;
        }
        const key = selectionKey(path, name, parseInt(child.attrs.requiredLevel ?? "1", 10) || 1);
        const slot = Math.max(1, parseInt(child.attrs.number ?? "1", 10) || 1) - 1;
        const list = state.selections[key] ?? [];
        while (list.length <= slot) list.push(null);
        const reg = child.attrs.registered || null;
        list[slot] = reg;
        state.selections[key] = list;
        if (reg && child.attrs.isList !== "true") walk(child, path + PATH_SEP + reg);
      } else if (child.attrs.id) {
        walk(child, path + PATH_SEP + child.attrs.id);
      }
    }
  };
  for (const node of childElements(elements, "element")) {
    if (node.attrs.id) walk(node, node.attrs.id);
  }

  // Inventory.
  const equipment = firstChild(build, "equipment");
  let uid = 0;
  let mainUsed = false;
  for (const item of equipment ? childElements(equipment, "item") : []) {
    const id = item.attrs.id;
    if (!id) continue;
    const el = registry.get(id);
    const eq = firstChild(item, "equipped");
    const loc = eq?.attrs.location ?? "";
    let slot: EquipSlot | undefined;
    if (eq && textContent(eq).trim() === "true") {
      if (loc === "Armor") slot = "armor";
      else if (loc.startsWith("Primary") || loc.startsWith("Two-Handed")) slot = mainUsed ? "offhand" : "main";
      else if (loc.startsWith("Secondary")) slot = "offhand";
      else if (el && (el.type === "Armor" || /^armor$/i.test(el.setters.find((s) => s.name === "category")?.value ?? ""))) {
        const kind = (el.setters.find((s) => s.name === "armor")?.value ?? "").toLowerCase();
        slot = kind === "shield" ? "offhand" : "armor";
      } else slot = "worn";
      if (slot === "main") mainUsed = true;
    }
    const details = firstChild(item, "details");
    state.inventory.push({
      uid: `aurora-${++uid}`,
      id,
      quantity: parseInt(item.attrs.amount ?? "1", 10) || 1,
      equipped: slot,
      attuned: text(item, "attunement") === "true" || undefined,
      name: text(details, "name") || undefined,
      notes: text(details, "notes") || undefined,
    });
    if (!el) warnings.push(`Item ${item.attrs.name ?? id} is not in the loaded content`);
  }

  return { state, warnings };
}

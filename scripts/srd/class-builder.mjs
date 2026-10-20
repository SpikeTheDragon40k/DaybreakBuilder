/**
 * Builds a class (plus its multiclass node, features, subclass and
 * spellcasting rules) from a compact definition.
 */
import { attrs, cap, element, esc, grant, idPart, select, stat } from "../lib/content.mjs";
import { classId, multiclassId, SOURCE } from "./common.mjs";

export const FULL_CASTER_SLOTS = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const HALF_CASTER_SLOTS = [
  [],
  [],
  [2],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

/** Warlock pact magic: [slot count, slot level] per warlock level. */
export const PACT_SLOTS = [
  [0, 0], [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

/** Emit level-gated stat increments so the stat equals table[level] at each level. */
export function progression(statName, valueAt) {
  const rules = [];
  let prev = 0;
  for (let lv = 1; lv <= 20; lv++) {
    const v = valueAt(lv);
    if (v !== prev) rules.push(stat({ name: statName, value: v - prev, level: lv }));
    prev = v;
  }
  return rules;
}

export function slotRules(caster, table) {
  const rules = [];
  for (let s = 1; s <= 9; s++) {
    if (!table.some((row) => (row[s - 1] ?? 0) > 0)) continue;
    rules.push(...progression(`${caster}:spellcasting:slots:${s}`, (lv) => table[lv]?.[s - 1] ?? 0));
  }
  return rules;
}

export function pactSlotRules(caster) {
  const rules = [];
  for (let s = 1; s <= 5; s++) {
    rules.push(...progression(`${caster}:spellcasting:slots:${s}`, (lv) => (PACT_SLOTS[lv][1] === s ? PACT_SLOTS[lv][0] : 0)));
  }
  return rules;
}

/** Turn a per-level table of totals into select rules for the new picks at each level. */
export function pickSelects(name, totals, opts) {
  const rules = [];
  let prev = 0;
  for (let lv = 1; lv <= 20; lv++) {
    const n = totals(lv);
    if (n > prev) rules.push(select({ ...opts, name, level: lv, number: n - prev }));
    prev = Math.max(prev, n);
  }
  return rules;
}

const featureId = (cls, name) => `ID_SRD_CLASS_FEATURE_${idPart(cls)}_${idPart(name)}`;
const archetypeFeatureId = (arch, name) => `ID_SRD_ARCHETYPE_FEATURE_${idPart(arch)}_${idPart(name)}`;

function featureElement(id, type, f, supports) {
  return element({
    name: f.name,
    type,
    id,
    source: SOURCE,
    supports,
    text: f.text,
    sheet: f.sheet === undefined ? (f.usage || f.action ? [{ text: f.short ?? f.text, usage: f.usage, action: f.action }] : f.short ?? undefined) : f.sheet,
    sheetAlt: f.sheetAlt,
    setters: f.setters,
    rules: f.rules,
    requirements: f.requirements,
  });
}

/** Shared "Improvement Option" choices: an ability score improvement or (with the feats option) a feat. */
export function improvementOptions() {
  return [
    element({
      name: "Ability Score Improvement",
      type: "Class Feature",
      id: "ID_SRD_IMPROVEMENT_OPTION_ABILITY_SCORES",
      source: SOURCE,
      supports: ["Improvement Option"],
      text: "Increase one ability score of your choice by 2, or two ability scores by 1. You can’t increase an ability score above 20 this way.",
      sheet: false,
      setters: [["allow duplicate", "true"]],
      rules: [select({ type: "Ability Score Improvement", name: "Ability Score Improvement", number: 2, supports: "Ability Score Improvement,Class" })],
    }),
    element({
      name: "Feat",
      type: "Class Feature",
      id: "ID_SRD_IMPROVEMENT_OPTION_FEAT",
      source: SOURCE,
      supports: ["Improvement Option"],
      requirements: "ID_INTERNAL_OPTION_ALLOW_FEATS",
      text: "Instead of improving your ability scores, you take a feat of your choice.",
      sheet: false,
      setters: [["allow duplicate", "true"]],
      rules: [select({ type: "Feat", name: "Feat" })],
    }),
  ];
}

/**
 * def: {
 *   name, hd, short, text, primary, wealth (starting gold dice, e.g. "5d4x10"), saves, armor, weapons, tools, skillCount, toolSelect,
 *   equipment, multiclass: { prerequisite, requirements, proficiencies, skillCount, text },
 *   asiLevels, features: [{ level, name, text, short, usage, action, rules, sheet }],
 *   spellcasting: { ability, prepare, listKnown, slots: "full"|"half"|"pact", cantrips(lv), known(lv),
 *                   spellbook, prepareStat, multiclassSlots, startLevel },
 *   subclass: { level, featureName, supports, text, archetypes: [{ id, name, text, features }] },
 * }
 */
export function buildClass(def) {
  const C = def.name;
  const lower = C.toLowerCase();
  const id = classId(C);
  const mcId = multiclassId(C);
  const notMc = `!${mcId}`;
  const out = [];

  const rules = [];
  for (const p of [...(def.armor ?? []), ...(def.weapons ?? []), ...(def.tools ?? [])]) {
    rules.push(grant({ type: "Proficiency", id: p, requirements: notMc }));
  }
  for (const s of def.saves) rules.push(grant({ type: "Proficiency", id: `ID_PROFICIENCY_SAVINGTHROW_${s.toUpperCase()}`, requirements: notMc }));
  rules.push(select({ type: "Proficiency", name: `Skill Proficiency (${C})`, supports: def.skillSupports ?? `Skill,${C}`, number: def.skillCount, requirements: notMc }));
  if (def.toolSelect) rules.push(select({ ...def.toolSelect, type: "Proficiency", requirements: notMc }));

  // Features, in level order.
  const allFeatures = [...def.features];
  for (const lv of def.asiLevels ?? [4, 8, 12, 16, 19]) {
    allFeatures.push({
      level: lv,
      key: `ASI_${lv}`,
      name: "Ability Score Improvement",
      text: "Increase one ability score by 2 or two ability scores by 1 (maximum 20), or take a feat if your game uses feats.",
      sheet: false,
      rules: [select({ type: "Class Feature", name: `Improvement Option (${C} ${lv})`, supports: "Improvement Option" })],
    });
  }
  allFeatures.sort((a, b) => a.level - b.level);
  for (const f of allFeatures) {
    const fid = f.key ? `ID_SRD_CLASS_FEATURE_${idPart(C)}_${f.key}` : featureId(C, f.name);
    rules.push(grant({ type: "Class Feature", id: fid, level: f.level }));
    out.push(featureElement(fid, "Class Feature", f, f.supports));
  }

  // Subclass choice.
  if (def.subclass) {
    const sc = def.subclass;
    const fid = featureId(C, sc.featureName);
    rules.push(grant({ type: "Class Feature", id: fid, level: sc.level }));
    out.push(
      element({
        name: sc.featureName,
        type: "Class Feature",
        id: fid,
        source: SOURCE,
        text: sc.text,
        sheet: false,
        rules: [select({ type: "Archetype", name: sc.featureName, supports: sc.supports })],
      }),
    );
    for (const a of sc.archetypes) {
      const aRules = [];
      for (const f of a.features) {
        const afid = f.key ? `ID_SRD_ARCHETYPE_FEATURE_${idPart(a.name)}_${f.key}` : archetypeFeatureId(a.name, f.name);
        aRules.push(grant({ type: "Archetype Feature", id: afid, level: f.level }));
        out.push(featureElement(afid, "Archetype Feature", f));
      }
      out.push(
        element({
          name: a.name,
          type: "Archetype",
          id: a.id,
          source: SOURCE,
          supports: [sc.supports, C],
          text: a.text,
          sheet: false,
          body: a.body,
          rules: [...(a.rules ?? []), ...aRules],
        }),
      );
      if (a.extras) out.push(...a.extras);
    }
  }
  if (def.extras) out.push(...def.extras);

  // Spellcasting.
  let spellBody;
  if (def.spellcasting) {
    const sc = def.spellcasting;
    spellBody = `\t\t<spellcasting${attrs({ name: C, ability: cap(sc.ability), prepare: sc.prepare ? "true" : "false" })}>\n\t\t\t<list${attrs({ known: sc.listKnown ? "true" : undefined })}>${esc(C)}</list>\n\t\t</spellcasting>`;
    if (sc.slots === "full") rules.push(...slotRules(lower, FULL_CASTER_SLOTS));
    if (sc.slots === "half") rules.push(...slotRules(lower, HALF_CASTER_SLOTS));
    if (sc.slots === "pact") rules.push(...pactSlotRules(lower));
    if (sc.multiclassSlots) {
      rules.push(grant({ type: "Grants", id: `ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_${sc.multiclassSlots}`, requirements: "ID_INTERNAL_GRANT_MULTICLASS" }));
    }
    if (sc.cantrips) {
      rules.push(...progression(`${lower}:spellcasting:cantrips known`, sc.cantrips));
      rules.push(...pickSelects(`Cantrip (${C})`, sc.cantrips, { type: "Spell", supports: "$(spellcasting:list),0", spellcasting: C }));
    }
    if (sc.known) {
      rules.push(...progression(`${lower}:spellcasting:spells known`, sc.known));
      rules.push(...pickSelects(`Spellcasting (${C})`, sc.known, { type: "Spell", supports: "$(spellcasting:list),$(spellcasting:slots)", spellcasting: C }));
    }
    if (sc.spellbook) {
      rules.push(select({ type: "Spell", name: `Spellbook (${C})`, supports: "$(spellcasting:list),1", number: 6, spellcasting: C }));
      for (let lv = 2; lv <= 20; lv++) {
        rules.push(select({ type: "Spell", name: `Spellbook (${C})`, supports: "$(spellcasting:list),$(spellcasting:slots)", number: 2, level: lv, spellcasting: C }));
      }
    }
    if (sc.prepareStat) {
      rules.push(stat({ name: `${lower}:spellcasting:prepare`, value: `${sc.ability}:modifier` }));
      rules.push(stat({ name: `${lower}:spellcasting:prepare`, value: sc.prepareStat }));
    }
  }

  // Multiclass node.
  const mc = def.multiclass;
  const mcRules = [grant({ type: "Grants", id: "ID_INTERNAL_GRANT_MULTICLASS" })];
  for (const p of mc.proficiencies ?? []) mcRules.push(grant({ type: "Proficiency", id: p }));
  if (mc.skillCount) mcRules.push(select({ type: "Proficiency", name: `Skill Proficiency (${C} Multiclass)`, supports: def.skillSupports ?? `Skill,${C}`, number: mc.skillCount }));
  if (mc.toolSelect) mcRules.push(select({ ...mc.toolSelect, type: "Proficiency" }));
  const mcBody = [
    `\t\t<multiclass id="${mcId}">`,
    `\t\t\t<prerequisite>${esc(mc.prerequisite)}</prerequisite>`,
    `\t\t\t<requirements>${esc(mc.requirements)}</requirements>`,
    `\t\t\t<setters><set name="multiclass proficiencies">${esc(mc.text ?? "—")}</set></setters>`,
    `\t\t\t<rules>`,
    ...mcRules.map((r) => `\t\t\t\t${r}`),
    `\t\t\t</rules>`,
    `\t\t</multiclass>`,
  ].join("\n");

  out.unshift(
    element({
      name: C,
      type: "Class",
      id,
      source: SOURCE,
      text: def.text,
      sheet: false,
      setters: [
        ["hd", def.hd],
        ["short", def.short],
        ...(def.primary ? [["primary", def.primary]] : []),
        ...(def.wealth ? [["starting wealth", def.wealth]] : []),
      ],
      body: [spellBody, mcBody].filter(Boolean).join("\n"),
      rules,
    }),
  );
  return out;
}

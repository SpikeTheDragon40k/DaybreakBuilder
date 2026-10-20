import type { ContentRegistry, ElementDef } from "@dndbuilder/engine";
import { getSetter } from "@dndbuilder/engine";
import { Html } from "./Html";
import { useUnits } from "../units";

const SPELL_FIELDS: [string, string][] = [
  ["level", "Level"],
  ["school", "School"],
  ["time", "Casting Time"],
  ["range", "Range"],
  ["duration", "Duration"],
];

const ITEM_FIELDS: [string, string][] = [
  ["category", "Category"],
  ["cost", "Cost"],
  ["weight", "Weight"],
  ["armorClass", "Armor Class"],
  ["damage", "Damage"],
  ["versatile", "Versatile"],
  ["rarity", "Rarity"],
  ["attunement", "Attunement"],
];

export function ElementDetail({ element, registry }: { element: ElementDef; registry: ContentRegistry }) {
  const fields = element.type === "Spell" ? SPELL_FIELDS : ["Item", "Weapon", "Armor", "Magic Item"].includes(element.type) ? ITEM_FIELDS : [];
  const units = useUnits();
  const rows = fields.map(([k, label]) => [label, getSetter(element, k)] as const).filter(([, v]) => v);
  return (
    <article className="element-detail">
      <header>
        <h3>{element.name}</h3>
        <div className="muted small">
          {element.type}
          {element.source ? ` · ${element.source}` : ""}
        </div>
      </header>
      {element.prerequisite && (
        <p className="prereq">
          <strong>Prerequisite:</strong> {element.prerequisite}
        </p>
      )}
      {rows.length > 0 && (
        <dl className="fields">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{units.text(value!)}</dd>
            </div>
          ))}
        </dl>
      )}
      {element.description ? <Html html={element.description} registry={registry} /> : <p className="muted">No description.</p>}
    </article>
  );
}

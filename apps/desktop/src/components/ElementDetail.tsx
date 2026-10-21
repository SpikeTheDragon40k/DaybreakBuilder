import type { ContentRegistry, ElementDef } from "@daybreakbuilder/engine";
import { featCategory, getSetter } from "@daybreakbuilder/engine";
import { Html } from "./Html";
import { isItem, ItemDetail } from "./ItemDetail";
import { useUnits } from "../units";

const SPELL_FIELDS: [string, string][] = [
  ["level", "Level"],
  ["school", "School"],
  ["time", "Casting Time"],
  ["range", "Range"],
  ["duration", "Duration"],
];

export function ElementDetail({ element, registry }: { element: ElementDef; registry: ContentRegistry }) {
  const units = useUnits();
  if (isItem(element)) return <ItemDetail element={element} registry={registry} />;
  const fields = element.type === "Spell" ? SPELL_FIELDS : [];
  const rows = fields.map(([k, label]) => [label, getSetter(element, k)] as const).filter(([, v]) => v);
  return (
    <article className="element-detail">
      <header>
        <h3>{element.name}</h3>
        <div className="muted small">
          {element.type}
          {featCategory(element) ? ` (${featCategory(element)})` : ""}
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

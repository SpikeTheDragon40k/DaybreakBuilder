import { featCategory, type ElementDef } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { ElementDetail } from "../components/ElementDetail";
import { useApp } from "../state/app";

const HIDDEN_TYPES = new Set(["Grants", "Level", "Support", "Ignore", "Multiclass", "Information", "Option"]);

export function CompendiumPage() {
  const { content } = useApp();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<ElementDef | null>(null);
  const registry = content?.registry;

  const types = useMemo(() => (registry ? registry.types().filter((t) => !HIDDEN_TYPES.has(t)) : []), [registry]);

  const results = useMemo(() => {
    if (!registry) return [];
    const q = query.trim().toLowerCase();
    if (!q && !type) return [];
    const out: ElementDef[] = [];
    for (const t of type ? [type] : types) {
      for (const el of registry.ofType(t)) {
        if (!el.compendiumDisplay || el.source === "Internal") continue;
        if (q && !el.name.toLowerCase().includes(q)) continue;
        out.push(el);
      }
    }
    out.sort((a, b) => {
      const ai = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bi = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ai - bi || a.name.localeCompare(b.name);
    });
    return out.slice(0, 300);
  }, [registry, types, query, type]);

  if (!registry) return <p className="muted">Loading content…</p>;

  return (
    <div className="two-pane compendium">
      <section className="panel">
        <div className="row">
          <input type="search" placeholder="Search the compendium…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t} ({registry.ofType(t).length})
              </option>
            ))}
          </select>
        </div>
        <ul className="result-list">
          {results.map((el) => (
            <li key={el.id} className={selected?.id === el.id ? "selected" : ""} onClick={() => setSelected(el)}>
              <span className="grow">{el.name}</span>
              <span className="muted small">
                {el.type}
                {featCategory(el) ? ` (${featCategory(el)})` : ""} · {el.source}
              </span>
            </li>
          ))}
          {results.length === 0 && <li className="muted">{query || type ? "No results." : `${registry.size.toLocaleString()} elements loaded. Search by name or pick a type.`}</li>}
        </ul>
      </section>
      <section className="panel">{selected ? <ElementDetail element={selected} registry={registry} /> : <p className="muted">Select an entry.</p>}</section>
    </div>
  );
}

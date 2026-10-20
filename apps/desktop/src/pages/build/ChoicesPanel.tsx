import { selectionOptions, type ResolvedNode, type SelectionPoint } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { Picker } from "../../components/Picker";
import { useCharacter } from "../../state/app";

const SECTION_TYPES = new Set(["Race", "Class", "Multiclass", "Background"]);
const TOP_LEVEL_LABEL: Record<string, string> = { Race: "Race", Background: "Background", Alignment: "Alignment", Deity: "Deity" };

interface Section {
  key: string;
  title: string;
  order: number;
  points: SelectionPoint[];
}

function sectionOf(point: SelectionPoint): { key: string; title: string; order: number } {
  let top: ResolvedNode | undefined;
  for (let n: ResolvedNode | undefined = point.owner; n; n = n.parent) {
    if (SECTION_TYPES.has(n.element.type)) top = n;
  }
  if (top) {
    const t = top.element.type;
    const order = t === "Race" ? 1 : t === "Class" ? 2 : t === "Multiclass" ? 3 : 4;
    const title = t === "Race" ? `Race: ${top.element.name}` : t === "Background" ? `Background: ${top.element.name}` : top.element.name;
    return { key: top.path, title, order };
  }
  if (point.owner.element.type === "Level" && !point.owner.parent) {
    return point.owner.element.id === "ID_LEVEL_1"
      ? { key: "origin", title: "Origin", order: 0 }
      : { key: point.owner.path, title: `Level ${point.owner.element.name}`, order: 5 };
  }
  let root = point.owner;
  while (root.parent) root = root.parent;
  return { key: root.path, title: root.element.name, order: 6 };
}

export function ChoicesPanel() {
  const { resolved } = useCharacter();

  const sections = useMemo(() => {
    const map = new Map<string, Section>();
    for (const p of resolved.selections) {
      if (p.rule.type === "Class") continue;
      const s = sectionOf(p);
      let sec = map.get(s.key);
      if (!sec) map.set(s.key, (sec = { ...s, points: [] }));
      sec.points.push(p);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [resolved]);

  return (
    <section className="panel choices">
      <header className="panel-header">
        <h2>Choices</h2>
      </header>
      {sections.length === 0 && <p className="muted">Choose a race, class and background to get started.</p>}
      {sections.map((s) => (
        <div key={s.key} className="choice-section">
          <h3>{s.title}</h3>
          {s.points.map((p) => (
            <SelectionRow key={p.key} point={p} />
          ))}
        </div>
      ))}
    </section>
  );
}

function SelectionRow({ point }: { point: SelectionPoint }) {
  const { resolved, content, update } = useCharacter();
  const [slot, setSlot] = useState<number | null>(null);
  const rule = point.rule;
  const options = useMemo(() => (slot !== null ? selectionOptions(resolved, point) : []), [slot, resolved, point]);
  const missing = point.chosen.filter((c) => c === null).length;

  const setChoice = (index: number, id: string | null) => {
    update((d) => {
      const list = [...(d.selections[point.key] ?? [])];
      while (list.length < rule.number) list.push(null);
      const old = list[index];
      list[index] = id;
      d.selections[point.key] = list;
      if (old && old !== id && !list.includes(old)) {
        const prefix = `${point.owner.path}/${old}`;
        for (const k of Object.keys(d.selections)) if (k.startsWith(prefix + "/") || k.startsWith(prefix + "|")) delete d.selections[k];
      }
    });
    setSlot(null);
  };

  const label = (
    <div className="choice-label">
      <span>{rule.name}</span>
      {rule.level > 1 && <span className="muted small"> (level {rule.level})</span>}
      {rule.optional && <span className="muted small"> optional</span>}
      {missing > 0 && !rule.optional && <span className="dot" title="Choice needed" />}
    </div>
  );

  if (rule.type === "List") {
    return (
      <div className="choice-row">
        {label}
        <div className="choice-slots">
          {point.chosen.map((c, i) => (
            <select key={i} value={c ?? ""} onChange={(e) => setChoice(i, e.target.value || null)} aria-label={rule.name}>
              <option value="">Choose…</option>
              {rule.items.map((it) => (
                <option key={it.id} value={String(it.id)}>
                  {it.text}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="choice-row">
      {label}
      <div className="choice-slots">
        {point.chosen.map((c, i) => {
          const el = c ? content.registry.get(c) : undefined;
          return (
            <button key={i} className={el ? "chosen" : "unchosen"} onClick={() => setSlot(i)}>
              {el ? el.name : `Choose ${rule.type.toLowerCase()}…`}
            </button>
          );
        })}
        {point.rejected.length > 0 && (
          <span className="error-text small" title={point.rejected.join(", ")}>
            {point.rejected.length} saved choice(s) no longer valid
          </span>
        )}
      </div>
      {slot !== null && (
        <Picker
          title={rule.number > 1 ? `${rule.name} (${slot + 1} of ${rule.number})` : rule.name}
          options={options}
          current={point.chosen[slot]}
          registry={content.registry}
          onPick={(id) => setChoice(slot, id)}
          onClose={() => setSlot(null)}
        />
      )}
    </div>
  );
}

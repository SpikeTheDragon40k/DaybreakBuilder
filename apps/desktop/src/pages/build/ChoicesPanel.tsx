import { featCategory, hasRevisedContent, selectionOptions, type ResolvedNode, type RulesEdition, type SelectionPoint } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { Picker } from "../../components/Picker";
import { useCharacter } from "../../state/app";
import { useUnits } from "../../units";

const SECTION_TYPES = new Set(["Race", "Class", "Multiclass", "Background"]);
const TOP_LEVEL_LABEL: Record<string, string> = { Race: "Race", Background: "Background", Alignment: "Alignment", Deity: "Deity" };

interface Section {
  key: string;
  title: string;
  order: number;
  points: SelectionPoint[];
  /** Feats granted outright (such as a 2024 background's Origin feat), shown read-only. */
  granted: ResolvedNode[];
}

function sectionOf(owner: ResolvedNode): { key: string; title: string; order: number } {
  let top: ResolvedNode | undefined;
  for (let n: ResolvedNode | undefined = owner; n; n = n.parent) {
    if (SECTION_TYPES.has(n.element.type)) top = n;
  }
  if (top) {
    const t = top.element.type;
    const order = t === "Race" ? 1 : t === "Class" ? 2 : t === "Multiclass" ? 3 : 4;
    const title = t === "Race" ? `Race: ${top.element.name}` : t === "Background" ? `Background: ${top.element.name}` : top.element.name;
    return { key: top.path, title, order };
  }
  if (owner.element.type === "Level" && !owner.parent) {
    return owner.element.id === "ID_LEVEL_1"
      ? { key: "origin", title: "Origin", order: 0 }
      : { key: owner.path, title: `Level ${owner.element.name}`, order: 5 };
  }
  let root = owner;
  while (root.parent) root = root.parent;
  return { key: root.path, title: root.element.name, order: 6 };
}

export function ChoicesPanel() {
  const { resolved } = useCharacter();

  const sections = useMemo(() => {
    const map = new Map<string, Section>();
    const sectionFor = (owner: ResolvedNode) => {
      const s = sectionOf(owner);
      let sec = map.get(s.key);
      if (!sec) map.set(s.key, (sec = { ...s, points: [], granted: [] }));
      return sec;
    };
    for (const n of resolved.nodes) {
      if (n.element.type === "Feat" && n.via.kind === "grant" && n.parent) sectionFor(n.parent).granted.push(n);
    }
    for (const p of resolved.selections) {
      if (p.rule.type === "Class") continue;
      sectionFor(p.owner).points.push(p);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [resolved]);

  return (
    <section className="panel choices">
      <header className="panel-header">
        <h2>Choices</h2>
        <RulesSwitch />
      </header>
      {sections.length === 0 && <p className="muted">Choose a race, class and background to get started.</p>}
      {sections.map((s) => (
        <div key={s.key} className="choice-section">
          <h3>{s.title}</h3>
          {s.granted.map((n) => (
            <GrantedFeatRow key={n.path} node={n} />
          ))}
          {s.points.map((p) => (
            <SelectionRow key={p.key} point={p} />
          ))}
        </div>
      ))}
    </section>
  );
}

const RULES: { rules: RulesEdition; title: string }[] = [
  { rules: "2014", title: "2014 rules: every loaded race, subrace, class and option" },
  { rules: "2024", title: "2024 rules: hide 2014 core options (PHB, SRD 5.1) and anything reprinted in a 2024 book" },
];

/** Which ruleset the character's choices follow. */
function RulesSwitch() {
  const { character, content, update } = useCharacter();
  const revised = useMemo(() => hasRevisedContent(content.registry), [content.registry]);
  return (
    <span className="rules-switch">
      {!revised && character.state.rules === "2024" && (
        <span className="muted small" title="Load 2024 content (such as the 2024 Player's Handbook) on the Content tab">
          no 2024 content loaded
        </span>
      )}
      <span className="theme-switch" role="group" aria-label="Rules">
        {RULES.map((r) => (
          <button
            key={r.rules}
            aria-pressed={character.state.rules === r.rules}
            title={r.title}
            onClick={() => update((d) => void (d.rules = r.rules))}
          >
            {r.rules} rules
          </button>
        ))}
      </span>
    </span>
  );
}

function GrantedFeatRow({ node }: { node: ResolvedNode }) {
  const category = featCategory(node.element);
  return (
    <div className="choice-row">
      <div className="choice-label">
        <span>{category === "Origin" ? "Origin Feat" : "Feat"}</span>
        <span className="muted small"> granted</span>
      </div>
      <div className="choice-slots">
        <span className="granted" title={`Granted by ${node.parent?.element.name ?? ""}`}>
          {node.element.name}
        </span>
      </div>
    </div>
  );
}

function SelectionRow({ point }: { point: SelectionPoint }) {
  const { resolved, content, update } = useCharacter();
  const [slot, setSlot] = useState<number | null>(null);
  const units = useUnits();
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
                  {units.text(it.text)}
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

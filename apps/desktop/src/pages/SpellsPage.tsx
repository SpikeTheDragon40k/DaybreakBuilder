import {
  casterSpells,
  findCasters,
  formatModifier,
  preparableSpells,
  spellLevel,
  type Caster,
  type ElementDef,
} from "@daybreakbuilder/engine";
import { useMemo, useState } from "react";
import { ElementDetail } from "../components/ElementDetail";
import { useCharacter } from "../state/app";

const LEVEL_LABEL = (n: number) => (n === 0 ? "Cantrips" : `Level ${n}`);
const MODE_LABEL = { known: "Spells known", spellbook: "Spellbook", list: "Prepared from class list" } as const;

export function SpellsPage() {
  const { resolved, sheet, content, setPage } = useCharacter();
  const casters = useMemo(() => findCasters(resolved), [resolved]);
  const [focused, setFocused] = useState<ElementDef | null>(null);

  if (casters.length === 0) {
    return (
      <div className="panel">
        <p className="muted">This character has no spellcasting yet.</p>
      </div>
    );
  }

  return (
    <div className="two-pane spells-page">
      <div>
        {sheet.multiclassSpellcasting && (
          <div className="callout small">
            Multiclass spellcaster level {sheet.multiclassSpellcasting.casterLevel}: spell slots are shared between your
            spellcasting classes.
          </div>
        )}
        {casters.map((c) => (
          <CasterPanel key={c.name} caster={c} onFocus={setFocused} />
        ))}
        <p className="small muted">
          Learn new spells in the <button className="link" onClick={() => setPage("build")}>Build</button> tab (choices named after your class).
        </p>
      </div>
      <section className="panel sticky">
        {focused ? <ElementDetail element={focused} registry={content.registry} /> : <p className="muted">Hover a spell to read it.</p>}
      </section>
    </div>
  );
}

function CasterPanel({ caster, onFocus }: { caster: Caster; onFocus: (el: ElementDef) => void }) {
  const { resolved, sheet, character, update } = useCharacter();
  const row = sheet.spellcasting.find((r) => r.name === caster.name);
  const known = useMemo(() => casterSpells(resolved, caster), [resolved, caster]);
  const preparable = useMemo(() => (caster.mode === "list" ? preparableSpells(resolved, caster) : []), [resolved, caster]);
  const prepared = new Set(character.state.preparedSpells[caster.name] ?? []);
  const limit = row?.prepareCount;
  const atLimit = limit !== undefined && (row?.preparedCount ?? 0) >= limit;

  const toggle = (id: string, on: boolean) =>
    update((d) => {
      const list = new Set(d.preparedSpells[caster.name] ?? []);
      if (on) list.add(id);
      else list.delete(id);
      d.preparedSpells[caster.name] = [...list];
    });

  // Spells to show, grouped by level.
  const entries: { el: ElementDef; level: number; always: boolean; canPrepare: boolean }[] = known.map((k) => ({
    el: k.element,
    level: k.level,
    always: k.alwaysPrepared,
    canPrepare: caster.mode !== "known" && !k.alwaysPrepared && k.level > 0,
  }));
  for (const el of preparable) {
    if (!entries.some((e) => e.el.id === el.id)) entries.push({ el, level: spellLevel(el), always: false, canPrepare: true });
  }
  const levels = [...new Set(entries.map((e) => e.level))].sort((a, b) => a - b);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{caster.name}</h2>
        <span className="muted small">{MODE_LABEL[caster.mode]}</span>
      </header>
      {row && (
        <div className="row wrap small">
          <span className="badge">{caster.ability}</span>
          <span>Spell attack {formatModifier(row.attack)}</span>
          <span>Save DC {row.dc}</span>
          {row.cantripsKnown !== undefined && <span>Cantrips {row.cantripsKnown}</span>}
          {row.spellsKnown !== undefined && <span>Spells known {row.spellsKnown}</span>}
          {limit !== undefined && (
            <span className={(row.preparedCount ?? 0) > limit ? "error-text" : ""}>
              Prepared {row.preparedCount}/{limit}
            </span>
          )}
        </div>
      )}
      {row && row.slots.some((n) => n > 0) && (
        <div className="slots">
          {row.slots.map((n, i) =>
            n > 0 ? (
              <span key={i} className="slot" title={`${n} level ${i + 1} slot(s)`}>
                <strong>{i + 1}</strong> {"●".repeat(Math.min(n, 9))}
              </span>
            ) : null,
          )}
        </div>
      )}
      {entries.length === 0 && <p className="muted">No spells yet.</p>}
      {levels.map((lv) => (
        <div key={lv} className="spell-level">
          <h3>{LEVEL_LABEL(lv)}</h3>
          <ul className="spell-list">
            {entries
              .filter((e) => e.level === lv)
              .sort((a, b) => a.el.name.localeCompare(b.el.name))
              .map((e) => {
                const isPrepared = e.always || caster.mode === "known" || prepared.has(e.el.id);
                return (
                  <li key={e.el.id} onMouseEnter={() => onFocus(e.el)} onClick={() => onFocus(e.el)}>
                    {e.canPrepare ? (
                      <input
                        type="checkbox"
                        aria-label={`Prepare ${e.el.name}`}
                        checked={prepared.has(e.el.id)}
                        disabled={!prepared.has(e.el.id) && atLimit}
                        onChange={(ev) => toggle(e.el.id, ev.target.checked)}
                      />
                    ) : (
                      <span className={`prof ${isPrepared ? "on" : ""}`} />
                    )}
                    <span className={isPrepared ? "" : "muted"}>{e.el.name}</span>
                    {e.always && e.level > 0 && <span className="muted small">always prepared</span>}
                    <span className="spacer" />
                    <span className="muted small">{e.el.source}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}

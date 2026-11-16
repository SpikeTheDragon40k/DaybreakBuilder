import {
  CHALLENGE_RATINGS,
  challengeXp,
  encounterDifficulties,
  getSetter,
  monsterTemplates,
  monsterXp,
  normalizeChallenge,
  rateEncounter,
  type ContentRegistry,
  type EncounterDifficulty,
  type MonsterTemplate,
  type RulesEdition,
} from "@daybreakbuilder/engine";
import { useMemo, useState } from "react";
import { newId } from "../state/app";
import { lineFromTemplate, newEncounter, type EncounterLine, type PartyEncounter, type SavedEncounter } from "../state/party";

const RULES: { rules: RulesEdition; title: string }[] = [
  { rules: "2024", title: "Dungeon Master's Guide 2024: XP budget for Low, Moderate and High difficulty, no multipliers" },
  { rules: "2014", title: "Dungeon Master's Guide 2014: Easy/Medium/Hard/Deadly thresholds, XP multiplied by the number of monsters" },
];

const LABELS: Record<EncounterDifficulty | "trivial", string> = {
  trivial: "Trivial",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const crLabel = (cr: string) => `CR ${cr} (${challengeXp(cr).toLocaleString()} XP)`;

/** Creatures with a challenge rating in the loaded content (companions, imported monsters). */
function monsterSuggestions(registry: ContentRegistry | undefined): { name: string; cr: string }[] {
  if (!registry) return [];
  const seen = new Map<string, string>();
  for (const type of ["Monster", "Companion"]) {
    for (const el of registry.ofType(type)) {
      const cr = normalizeChallenge(getSetter(el, "challenge") ?? "");
      if (cr && !seen.has(el.name)) seen.set(el.name, cr);
    }
  }
  return [...seen].map(([name, cr]) => ({ name, cr })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Encounter difficulty for the party, in the spirit of the classic 5e
 * encounter calculators: add monsters by CR and count, see where the total
 * lands against the party's XP budget.
 */
export function EncounterCalculator({
  levels,
  encounter: saved,
  registry,
  onChange,
  savedEncounters = [],
  onSavedChange,
  onRun,
}: {
  /** Levels of the party members in the roster. */
  levels: number[];
  encounter: PartyEncounter | undefined;
  registry: ContentRegistry | undefined;
  onChange: (e: PartyEncounter) => void;
  /** Encounters saved in the campaign; the list shows only when `onSavedChange` is given. */
  savedEncounters?: SavedEncounter[];
  onSavedChange?: (list: SavedEncounter[]) => void;
  /** Start an encounter in the initiative tracker. */
  onRun?: (name: string, lines: EncounterLine[]) => void;
}) {
  const encounter = saved ?? newEncounter();
  const { rules, monsters, extraLevels } = encounter;
  const allLevels = [...levels, ...extraLevels];
  const rating = useMemo(() => rateEncounter(allLevels, monsters, rules), [allLevels.join(), monsters, rules]);
  const suggestions = useMemo(() => monsterSuggestions(registry), [registry]);
  const templates = useMemo(() => (registry ? monsterTemplates(registry) : []), [registry]);
  const difficulties = encounterDifficulties(rules);
  const top = rating.budget[difficulties[difficulties.length - 1]] ?? 0;
  // The bar goes a bit past the top threshold so an over-budget encounter still shows.
  const scale = Math.max(top * 1.25, rating.adjustedXp, 1);
  const averageLevel = allLevels.length ? allLevels.reduce((a, b) => a + b, 0) / allLevels.length : 0;

  const set = (patch: Partial<PartyEncounter>) => onChange({ ...encounter, ...patch });
  const setLine = (id: string, patch: Partial<EncounterLine>) => set({ monsters: monsters.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const addLine = () => set({ monsters: [...monsters, { id: newId(), name: "", cr: "1", xp: 0, count: 1 }] });

  const rename = (line: EncounterLine, name: string) => {
    const match = suggestions.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    // A typed name no longer points at the picked monster.
    setLine(line.id, match ? { name, cr: match.cr, elementId: undefined } : { name, elementId: undefined });
  };

  const pick = (t: MonsterTemplate) => {
    const same = monsters.find((m) => (m.elementId ? m.elementId === t.elementId : m.name.trim().toLowerCase() === t.name.toLowerCase()));
    if (same) setLine(same.id, { count: same.count + 1 });
    else set({ monsters: [...monsters, lineFromTemplate(newId(), t)] });
  };

  return (
    <section className="panel encounter">
      <div className="panel-header">
        <h2>Encounter calculator</h2>
        <span className="theme-switch" role="group" aria-label="Encounter rules">
          {RULES.map((r) => (
            <button key={r.rules} aria-pressed={rules === r.rules} title={r.title} onClick={() => set({ rules: r.rules })}>
              {r.rules} DMG
            </button>
          ))}
        </span>
      </div>

      <div className="encounter-party small">
        <span className="muted">Party:</span>
        {levels.length > 0 && (
          <span>
            {levels.length} character{levels.length > 1 ? "s" : ""} (level {levels.join(", ")})
          </span>
        )}
        {extraLevels.map((lvl, i) => (
          <span key={i} className="encounter-extra" title="Extra party member, not in the roster">
            +{" "}
            <input
              type="number"
              min={1}
              max={20}
              value={lvl}
              aria-label={`Extra member ${i + 1} level`}
              onChange={(e) => set({ extraLevels: extraLevels.map((x, j) => (j === i ? clampLevel(e.target.valueAsNumber) : x)) })}
            />
            <button className="link small" aria-label={`Remove extra member ${i + 1}`} onClick={() => set({ extraLevels: extraLevels.filter((_, j) => j !== i) })}>
              ×
            </button>
          </span>
        ))}
        <button
          className="link small"
          title="Count a sidekick, NPC ally or guest player who isn't a saved character"
          onClick={() => set({ extraLevels: [...extraLevels, Math.round(averageLevel) || 1] })}
        >
          + extra member
        </button>
      </div>

      <div className={`budget budget-${difficulties.length}`}>
        {difficulties.map((d) => (
          <div key={d} className={`budget-cell budget-${d} ${rating.difficulty === d ? "reached" : ""}`}>
            <div className="label">{LABELS[d]}</div>
            <div className="value">{(rating.budget[d] ?? 0).toLocaleString()} XP</div>
          </div>
        ))}
      </div>

      <div className="encounter-meter" aria-hidden>
        <div className={`encounter-fill difficulty-${rating.difficulty}`} style={{ width: `${Math.min(100, (rating.adjustedXp / scale) * 100)}%` }} />
        {difficulties.map((d) => (
          <div key={d} className="encounter-mark" style={{ left: `${((rating.budget[d] ?? 0) / scale) * 100}%` }} title={LABELS[d]} />
        ))}
      </div>

      <table className="encounter-table">
        <thead>
          <tr>
            <th scope="col">Monster</th>
            <th scope="col">Challenge</th>
            <th scope="col" title="XP per monster; leave at 0 to use the challenge rating's XP">XP each</th>
            <th scope="col">Count</th>
            <th scope="col" className="right">XP</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {monsters.map((m) => (
            <tr key={m.id}>
              <td>
                <input
                  value={m.name}
                  className={m.elementId ? "encounter-linked" : undefined}
                  title={m.elementId ? "Picked from the loaded content: the tracker uses its stat block" : undefined}
                  placeholder="Monster name"
                  list="encounter-monsters"
                  aria-label="Monster name"
                  onChange={(e) => rename(m, e.target.value)}
                />
              </td>
              <td>
                <select value={normalizeChallenge(m.cr) || "0"} aria-label="Challenge rating" onChange={(e) => setLine(m.id, { cr: e.target.value })}>
                  {CHALLENGE_RATINGS.map((cr) => (
                    <option key={cr} value={cr}>
                      {crLabel(cr)}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={5}
                  className="encounter-xp"
                  value={m.xp || ""}
                  placeholder={String(challengeXp(m.cr))}
                  aria-label="XP each"
                  onChange={(e) => setLine(m.id, { xp: Math.max(0, e.target.valueAsNumber || 0) })}
                />
              </td>
              <td>
                <span className="row nowrap encounter-count">
                  <button className="small" aria-label="One less" disabled={m.count <= 0} onClick={() => setLine(m.id, { count: m.count - 1 })}>
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={m.count}
                    aria-label="Count"
                    onChange={(e) => setLine(m.id, { count: Math.max(0, Math.floor(e.target.valueAsNumber || 0)) })}
                  />
                  <button className="small" aria-label="One more" onClick={() => setLine(m.id, { count: m.count + 1 })}>
                    +
                  </button>
                </span>
              </td>
              <td className="right">{(monsterXp(m) * m.count).toLocaleString()}</td>
              <td>
                <button className="small ghost danger" aria-label="Remove monster" onClick={() => set({ monsters: monsters.filter((x) => x.id !== m.id) })}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="encounter-monsters">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} label={`CR ${s.cr}`} />
        ))}
      </datalist>
      <MonsterPicker templates={templates} onPick={pick} />
      <div className="row">
        <button className="small" onClick={addLine} title="A monster that isn't in the loaded content, by name and challenge rating">
          Add by hand
        </button>
        {monsters.length > 0 && (
          <button className="small ghost" onClick={() => set({ monsters: [] })}>
            Clear
          </button>
        )}
      </div>

      <div className={`encounter-result difficulty-${rating.difficulty}`}>
        <div>
          <div className="encounter-verdict">{verdict(rating.difficulty, rules, rating.overBudget)}</div>
          <div className="muted small">{nextStep(rating, difficulties)}</div>
        </div>
        <dl className="encounter-numbers">
          <div>
            <dt>Total XP</dt>
            <dd>{rating.totalXp.toLocaleString()}</dd>
          </div>
          {rules === "2014" && (
            <div title="Encounter multiplier for the number of monsters, adjusted for party size">
              <dt>Adjusted (×{rating.multiplier})</dt>
              <dd>{rating.adjustedXp.toLocaleString()}</dd>
            </div>
          )}
          <div>
            <dt>XP per character</dt>
            <dd>{allLevels.length ? Math.floor(rating.totalXp / allLevels.length).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      </div>
      {rules === "2024" && rating.highestCr > averageLevel && averageLevel > 0 && (
        <p className="muted small">
          A creature with a challenge rating above the party's level (CR {rating.highestCr} vs level {Math.round(averageLevel * 10) / 10}) can deal
          enough damage to drop a character in one turn.
        </p>
      )}
      {onSavedChange && (
        <SavedEncounters
          saved={savedEncounters}
          current={monsters}
          onChange={onSavedChange}
          onLoad={(e) => set({ monsters: e.monsters.map((m) => ({ ...m, id: newId() })) })}
          onRun={onRun}
          rate={(lines) => rateEncounter(allLevels, lines, rules)}
        />
      )}
    </section>
  );
}

const PICKER_LIMIT = 40;

/** Search the loaded content's monsters and add them to the encounter. */
function MonsterPicker({ templates, onPick }: { templates: MonsterTemplate[]; onPick: (t: MonsterTemplate) => void }) {
  const [query, setQuery] = useState("");
  const [cr, setCr] = useState("");
  if (!templates.length) {
    return <p className="muted small">Load content with monsters (Content tab) to pick them from a list; you can still add monsters by hand.</p>;
  }
  const q = query.trim().toLowerCase();
  const matches = templates.filter((t) => (!q || t.name.toLowerCase().includes(q)) && (!cr || normalizeChallenge(t.challenge) === cr));
  const shown = q || cr ? matches.slice(0, PICKER_LIMIT) : [];
  return (
    <div className="monster-picker">
      <div className="row wrap">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${templates.length} monsters…`} aria-label="Search monsters" className="grow" />
        <select value={cr} onChange={(e) => setCr(e.target.value)} aria-label="Challenge rating filter">
          <option value="">Any CR</option>
          {CHALLENGE_RATINGS.map((c) => (
            <option key={c} value={c}>
              CR {c}
            </option>
          ))}
        </select>
      </div>
      {(q || cr) && (
        <ul className="plain monster-results" aria-label="Monsters">
          {shown.length === 0 && <li className="muted small">No monsters match.</li>}
          {shown.map((t) => (
            <li key={`${t.elementId}`}>
              <button className="monster-result" onClick={() => onPick(t)} title={`Add ${t.name} to the encounter`}>
                <span className="grow">{t.name}</span>
                <span className="muted small">
                  CR {normalizeChallenge(t.challenge) || "?"} · AC {t.ac} · HP {t.hp}
                  {t.source && ` · ${t.source}`}
                </span>
              </button>
            </li>
          ))}
          {matches.length > shown.length && <li className="muted small">{matches.length - shown.length} more: narrow the search.</li>}
        </ul>
      )}
    </div>
  );
}

const describeLines = (lines: EncounterLine[]) =>
  lines
    .filter((l) => l.name.trim() && l.count > 0)
    .map((l) => (l.count > 1 ? `${l.count} × ${l.name}` : l.name))
    .join(", ") || "No monsters";

/** Encounters kept in the campaign: save the planner's, load one back, or run it. */
function SavedEncounters({
  saved,
  current,
  onChange,
  onLoad,
  onRun,
  rate,
}: {
  saved: SavedEncounter[];
  current: EncounterLine[];
  onChange: (list: SavedEncounter[]) => void;
  onLoad: (e: SavedEncounter) => void;
  onRun?: (name: string, lines: EncounterLine[]) => void;
  rate: (lines: EncounterLine[]) => ReturnType<typeof rateEncounter>;
}) {
  const [name, setName] = useState("");
  const hasMonsters = current.some((l) => l.name.trim() && l.count > 0);
  const save = () => {
    const n = name.trim() || `Encounter ${saved.length + 1}`;
    const lines = current.filter((l) => l.name.trim() && l.count > 0).map((l) => ({ ...l }));
    const existing = saved.find((e) => e.name.toLowerCase() === n.toLowerCase());
    if (existing && !confirm(`Replace the saved encounter “${existing.name}”?`)) return;
    onChange(existing ? saved.map((e) => (e.id === existing.id ? { ...e, monsters: lines } : e)) : [...saved, { id: newId(), name: n, monsters: lines, notes: "" }]);
    setName("");
  };
  const update = (id: string, patch: Partial<SavedEncounter>) => onChange(saved.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="saved-encounters">
      <h3>Saved encounters</h3>
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Goblin ambush" aria-label="Encounter name" className="grow" />
        <button className="small primary" type="submit" disabled={!hasMonsters} title={hasMonsters ? "Keep the monsters above as a named encounter" : "Add monsters first"}>
          Save encounter
        </button>
      </form>
      {saved.length === 0 ? (
        <p className="muted small">Prepare encounters ahead of the session: plan one above, name it and save it. Run it from here when the fight starts.</p>
      ) : (
        <ul className="plain saved-encounter-list">
          {saved.map((e) => {
            const r = rate(e.monsters);
            return (
              <li key={e.id} className="saved-encounter">
                <div className="row wrap">
                  <input className="saved-encounter-name grow" value={e.name} aria-label="Saved encounter name" onChange={(ev) => update(e.id, { name: ev.target.value })} />
                  <span className={`chip difficulty-${r.difficulty}`} title={`${r.adjustedXp.toLocaleString()} XP for the current party`}>
                    {verdict(r.difficulty, r.rules, r.overBudget)}
                  </span>
                  <button className="small" onClick={() => onLoad(e)} title="Put these monsters in the planner above">
                    Load
                  </button>
                  {onRun && (
                    <button className="small primary" onClick={() => onRun(e.name, e.monsters)} title="Start it in the initiative tracker with the party">
                      Run
                    </button>
                  )}
                  <button className="small ghost danger" aria-label={`Delete ${e.name}`} onClick={() => confirm(`Delete the saved encounter “${e.name}”?`) && onChange(saved.filter((x) => x.id !== e.id))}>
                    Delete
                  </button>
                </div>
                <div className="muted small">{describeLines(e.monsters)}</div>
                <textarea
                  className="saved-encounter-notes small"
                  rows={1}
                  value={e.notes}
                  placeholder="Notes: where, tactics, treasure…"
                  aria-label={`Notes for ${e.name}`}
                  onChange={(ev) => update(e.id, { notes: ev.target.value })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function clampLevel(n: number): number {
  return Math.min(20, Math.max(1, Math.floor(n) || 1));
}

function verdict(d: EncounterDifficulty | "trivial", rules: RulesEdition, overBudget: boolean): string {
  if (d === "trivial") return rules === "2024" ? "Below Low" : "Trivial";
  if (overBudget) return "Beyond High";
  return LABELS[d];
}

function nextStep(r: ReturnType<typeof rateEncounter>, difficulties: EncounterDifficulty[]): string {
  if (r.partySize === 0) return "Add characters to the party to get a budget.";
  if (r.monsterCount === 0) return "Add monsters to rate the encounter.";
  if (r.overBudget) return `${(r.adjustedXp - (r.budget.high ?? 0)).toLocaleString()} XP over the High budget.`;
  const i = r.difficulty === "trivial" ? 0 : difficulties.indexOf(r.difficulty) + 1;
  const next = difficulties[i];
  if (!next) return "At or above the Deadly threshold.";
  return `${r.toNext.toLocaleString()} XP more for ${LABELS[next]}.`;
}

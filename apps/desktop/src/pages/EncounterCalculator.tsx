import {
  CHALLENGE_RATINGS,
  challengeXp,
  encounterDifficulties,
  getSetter,
  monsterXp,
  normalizeChallenge,
  rateEncounter,
  type ContentRegistry,
  type EncounterDifficulty,
  type RulesEdition,
} from "@daybreakbuilder/engine";
import { useMemo } from "react";
import { newId } from "../state/app";
import { newEncounter, type EncounterLine, type PartyEncounter } from "../state/party";

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
}: {
  /** Levels of the party members in the roster. */
  levels: number[];
  encounter: PartyEncounter | undefined;
  registry: ContentRegistry | undefined;
  onChange: (e: PartyEncounter) => void;
}) {
  const encounter = saved ?? newEncounter();
  const { rules, monsters, extraLevels } = encounter;
  const allLevels = [...levels, ...extraLevels];
  const rating = useMemo(() => rateEncounter(allLevels, monsters, rules), [allLevels.join(), monsters, rules]);
  const suggestions = useMemo(() => monsterSuggestions(registry), [registry]);
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
    setLine(line.id, match ? { name, cr: match.cr } : { name });
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
      <div className="row">
        <button className="small primary" onClick={addLine}>
          Add monster
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
    </section>
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

import {
  ABILITIES,
  formatModifier,
  pointBuySpent,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  STANDARD_ARRAY,
  type Ability,
  type AbilityMethod,
} from "@dndbuilder/engine";
import { useCharacter } from "../../state/app";

const LABEL: Record<AbilityMethod, string> = {
  "point-buy": "Point buy",
  "standard-array": "Standard array",
  manual: "Manual / rolled",
};

export function AbilityEditor() {
  const { character, sheet, update } = useCharacter();
  const { abilities, abilityMethod } = character.state;
  const spent = pointBuySpent(abilities);

  const setScore = (a: Ability, v: number) =>
    update((d) => {
      d.abilities[a] = v;
    });

  const setMethod = (m: AbilityMethod) =>
    update((d) => {
      d.abilityMethod = m;
      if (m === "point-buy" && pointBuySpent(d.abilities) === null) {
        for (const a of ABILITIES) d.abilities[a] = 8;
      }
      if (m === "standard-array") {
        ABILITIES.forEach((a, i) => (d.abilities[a] = STANDARD_ARRAY[i]));
      }
    });

  const usedArray = (a: Ability) => {
    const others = ABILITIES.filter((x) => x !== a).map((x) => abilities[x]);
    return STANDARD_ARRAY.filter((v) => {
      const count = STANDARD_ARRAY.filter((x) => x === v).length;
      return others.filter((x) => x === v).length >= count;
    });
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Ability Scores</h2>
        <select value={abilityMethod} onChange={(e) => setMethod(e.target.value as AbilityMethod)} aria-label="Ability score method">
          {(Object.keys(LABEL) as AbilityMethod[]).map((m) => (
            <option key={m} value={m}>
              {LABEL[m]}
            </option>
          ))}
        </select>
      </header>
      {abilityMethod === "point-buy" && (
        <p className={`small ${spent !== null && spent > POINT_BUY_BUDGET ? "error-text" : "muted"}`}>
          Points spent: {spent ?? "—"} / {POINT_BUY_BUDGET}
        </p>
      )}
      <table className="abilities-table">
        <thead>
          <tr>
            <th>Ability</th>
            <th>Base</th>
            <th>Bonus</th>
            <th>Score</th>
            <th>Mod</th>
          </tr>
        </thead>
        <tbody>
          {sheet.abilities.map((row) => {
            const a = row.ability;
            const bonus = row.score - row.base;
            return (
              <tr key={a}>
                <th scope="row">{a.charAt(0).toUpperCase() + a.slice(1)}</th>
                <td>
                  {abilityMethod === "point-buy" && (
                    <div className="stepper">
                      <button
                        aria-label={`Decrease ${a}`}
                        disabled={abilities[a] <= 8}
                        onClick={() => setScore(a, abilities[a] - 1)}
                      >
                        −
                      </button>
                      <span>{abilities[a]}</span>
                      <button
                        aria-label={`Increase ${a}`}
                        disabled={
                          abilities[a] >= 15 ||
                          spent === null ||
                          spent - (POINT_BUY_COST[abilities[a]] ?? 0) + (POINT_BUY_COST[abilities[a] + 1] ?? 99) > POINT_BUY_BUDGET
                        }
                        onClick={() => setScore(a, abilities[a] + 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {abilityMethod === "standard-array" && (
                    <select value={abilities[a]} onChange={(e) => setScore(a, Number(e.target.value))} aria-label={`${a} score`}>
                      {[...new Set(STANDARD_ARRAY)].map((v) => (
                        <option key={v} value={v} disabled={usedArray(a).includes(v) && abilities[a] !== v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                  {abilityMethod === "manual" && (
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={abilities[a]}
                      aria-label={`${a} score`}
                      onChange={(e) => setScore(a, Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                    />
                  )}
                </td>
                <td className="muted" title={row.breakdown.map((p) => `${p.source}: ${formatModifier(p.value)}`).join("\n")}>
                  {bonus ? formatModifier(bonus) : ""}
                </td>
                <td className="score">{row.score}</td>
                <td className="mod">{formatModifier(row.modifier)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

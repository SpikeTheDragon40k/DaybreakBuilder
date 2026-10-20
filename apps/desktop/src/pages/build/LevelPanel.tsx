import { hitDieSize, maxLevel, meetsRequirements, selectionOptions } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { Picker } from "../../components/Picker";
import { useCharacter } from "../../state/app";

export function LevelPanel() {
  const { character, resolved, content, update } = useCharacter();
  const { registry } = content;
  const levels = character.state.levels;
  const mainClass = resolved.mainClass;
  const max = maxLevel(registry) || 20;
  const [pickingClass, setPickingClass] = useState(false);
  const [pickingMulticlass, setPickingMulticlass] = useState(false);

  const classPoint = resolved.selections.find((p) => p.rule.type === "Class");
  const classOptions = useMemo(() => (classPoint ? selectionOptions(resolved, classPoint) : []), [resolved, classPoint]);

  const takenClasses = [...new Set(levels.filter(Boolean))];
  const multiclassOptions = useMemo(() => {
    return registry
      .ofType("Class")
      .filter((c) => !takenClasses.includes(c.id))
      .map((c) => {
        const mc = registry.multiclassOf(c.id);
        // Both the new class's and the current classes' prerequisites must be met.
        const ok =
          !!mc &&
          meetsRequirements(resolved, mc.requirements) &&
          takenClasses.every((t) => meetsRequirements(resolved, registry.multiclassOf(t)?.requirements));
        return {
          element: c,
          available: ok,
          reason: !mc ? "Cannot be multiclassed" : ok ? undefined : `Requires ${mc.prerequisite ?? "prerequisites"}`,
        };
      });
  }, [registry, resolved, takenClasses.join(",")]);

  const setMainClass = (id: string | null) => {
    update((d) => {
      const old = d.levels[0];
      d.levels = d.levels.map((c, i) => (i === 0 || c === old || c === "" ? id ?? "" : c));
      // Drop choices made under the previous class.
      if (old) for (const k of Object.keys(d.selections)) if (k.startsWith(`ID_LEVEL_1/${old}`)) delete d.selections[k];
    });
    setPickingClass(false);
  };

  const addLevel = (classId: string) =>
    update((d) => {
      if (d.levels.length < max) d.levels.push(classId);
    });

  const removeLevel = () =>
    update((d) => {
      if (d.levels.length > 1) {
        const lv = d.levels.length;
        d.levels.pop();
        delete d.hitPoints.rolls[lv];
      }
    });

  const levelCounts = new Map<string, number>();
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Class &amp; Level</h2>
        <span className="badge">Level {levels.length}</span>
      </header>

      <div className="row">
        <button className={mainClass ? "" : "primary"} onClick={() => setPickingClass(true)}>
          {mainClass ? `Class: ${mainClass.name}` : "Choose a class…"}
        </button>
      </div>

      {mainClass && (
        <>
          <ol className="level-list">
            {levels.map((id, i) => {
              const cls = registry.get(id);
              const n = (levelCounts.get(id) ?? 0) + 1;
              levelCounts.set(id, n);
              return (
                <li key={i}>
                  <span className="lv">{i + 1}</span>
                  <span>
                    {cls?.name ?? "?"} {n}
                  </span>
                  {i === levels.length - 1 && i > 0 && (
                    <button className="ghost small" onClick={removeLevel} aria-label="Remove last level">
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="row wrap">
            {takenClasses.map((id) => (
              <button key={id} disabled={levels.length >= max} onClick={() => addLevel(id)}>
                + {registry.get(id)?.name ?? id} level
              </button>
            ))}
            <button className="ghost" disabled={levels.length >= max} onClick={() => setPickingMulticlass(true)}>
              + Multiclass…
            </button>
          </div>
          <HitPoints />
        </>
      )}

      {pickingClass && classPoint && (
        <Picker
          title="Choose a class"
          options={classOptions}
          current={mainClass?.id ?? null}
          registry={registry}
          onPick={setMainClass}
          onClose={() => setPickingClass(false)}
        />
      )}
      {pickingMulticlass && (
        <Picker
          title="Multiclass into…"
          options={multiclassOptions}
          current={null}
          registry={registry}
          allowClear={false}
          onPick={(id) => {
            if (id) addLevel(id);
            setPickingMulticlass(false);
          }}
          onClose={() => setPickingMulticlass(false)}
        />
      )}
    </section>
  );
}

function HitPoints() {
  const { character, content, sheet, update } = useCharacter();
  const { hitPoints, levels } = character.state;
  return (
    <div className="hp-editor">
      <div className="row">
        <strong>Hit points: {sheet.maxHp}</strong>
        <select
          value={hitPoints.method}
          aria-label="Hit point method"
          onChange={(e) =>
            update((d) => {
              d.hitPoints.method = e.target.value as "average" | "rolled";
            })
          }
        >
          <option value="average">Fixed (average)</option>
          <option value="rolled">Rolled</option>
        </select>
      </div>
      {hitPoints.method === "rolled" && levels.length > 1 && (
        <div className="hp-rolls">
          {levels.slice(1).map((cls, i) => {
            const lv = i + 2;
            const die = hitDieSize(content.registry.get(cls));
            return (
              <label key={lv}>
                L{lv} (d{die})
                <input
                  type="number"
                  min={1}
                  max={die}
                  value={hitPoints.rolls[lv] ?? ""}
                  placeholder={String(Math.floor(die / 2) + 1)}
                  onChange={(e) =>
                    update((d) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) d.hitPoints.rolls[lv] = Math.max(1, Math.min(die, v));
                      else delete d.hitPoints.rolls[lv];
                    })
                  }
                />
              </label>
            );
          })}
          <button
            className="ghost small"
            onClick={() =>
              update((d) => {
                d.levels.slice(1).forEach((cls, i) => {
                  const die = hitDieSize(content.registry.get(cls));
                  d.hitPoints.rolls[i + 2] = 1 + Math.floor(Math.random() * die);
                });
              })
            }
          >
            Roll all
          </button>
        </div>
      )}
    </div>
  );
}

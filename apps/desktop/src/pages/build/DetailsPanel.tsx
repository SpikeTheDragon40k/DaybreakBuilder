import type { CharacterDetails } from "@daybreakbuilder/engine";
import { useCharacter } from "../../state/app";

const SHORT: [keyof CharacterDetails, string][] = [
  ["gender", "Gender"],
  ["age", "Age"],
  ["height", "Height"],
  ["weight", "Weight"],
  ["eyes", "Eyes"],
  ["skin", "Skin"],
  ["hair", "Hair"],
];

const LONG: [keyof CharacterDetails, string][] = [
  ["traits", "Personality Traits"],
  ["ideals", "Ideals"],
  ["bonds", "Bonds"],
  ["flaws", "Flaws"],
  ["backstory", "Backstory"],
  ["allies", "Allies & Organizations"],
  ["notes", "Notes"],
];

export function DetailsPanel() {
  const { character, update } = useCharacter();
  const s = character.state;
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Details</h2>
      </header>
      <div className="form-grid">
        <label>
          Player
          <input value={s.playerName} onChange={(e) => update((d) => void (d.playerName = e.target.value))} />
        </label>
        <label>
          Experience
          <input type="number" min={0} value={s.experience} onChange={(e) => update((d) => void (d.experience = Number(e.target.value) || 0))} />
        </label>
        {SHORT.map(([k, label]) => (
          <label key={k}>
            {label}
            <input value={s.details[k]} onChange={(e) => update((d) => void (d.details[k] = e.target.value))} />
          </label>
        ))}
      </div>
      {LONG.map(([k, label]) => (
        <label key={k} className="block">
          {label}
          <textarea rows={k === "backstory" || k === "notes" ? 5 : 2} value={s.details[k]} onChange={(e) => update((d) => void (d.details[k] = e.target.value))} />
        </label>
      ))}
    </section>
  );
}

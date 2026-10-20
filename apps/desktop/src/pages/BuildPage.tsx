import { useCharacter } from "../state/app";
import { AbilityEditor } from "./build/AbilityEditor";
import { ChoicesPanel } from "./build/ChoicesPanel";
import { DetailsPanel } from "./build/DetailsPanel";
import { LevelPanel } from "./build/LevelPanel";

export function BuildPage() {
  const { character, sheet, update } = useCharacter();
  return (
    <div className="build-page">
      <div className="build-header">
        <input
          className="name-input"
          value={character.state.name}
          aria-label="Character name"
          onChange={(e) => update((d) => void (d.name = e.target.value))}
        />
        <span className="muted">{[sheet.race, sheet.subrace, sheet.classSummary, sheet.background].filter(Boolean).join(" · ")}</span>
      </div>
      {sheet.warnings.length > 0 && (
        <ul className="warnings">
          {sheet.warnings.slice(0, 8).map((w) => (
            <li key={w}>{w}</li>
          ))}
          {sheet.warnings.length > 8 && <li className="muted">…and {sheet.warnings.length - 8} more</li>}
        </ul>
      )}
      <div className="build-columns">
        <div className="col">
          <LevelPanel />
          <AbilityEditor />
          <DetailsPanel />
        </div>
        <div className="col wide">
          <ChoicesPanel />
        </div>
      </div>
    </div>
  );
}

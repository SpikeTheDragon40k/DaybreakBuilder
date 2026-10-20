import { clearStartingWealth, formatWealth, startingWealth, takeStartingWealth, type StartingWealthOption } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { useCharacter } from "../state/app";

function takenText(option: StartingWealthOption | undefined, gp: number, rolls?: number[]): string {
  if (option?.roll && rolls?.length) return `Rolled ${formatWealth(option.roll)}: ${rolls.join(" + ")} → ${gp} gp`;
  return option?.label ?? `${gp} gp`;
}

/** Pick how the character starts: with its class and background equipment, or with gold to spend. */
export function StartingWealthCard() {
  const { character, resolved, update } = useCharacter();
  const wealth = useMemo(() => startingWealth(resolved), [resolved]);
  const taken = character.state.startingWealth;
  const [changing, setChanging] = useState(false);

  if (!wealth.className) {
    return (
      <div className="starting-wealth muted small">Choose a class on the Build tab to get your starting gold.</div>
    );
  }

  const takenOption = taken && wealth.options.find((o) => o.key === taken.option);
  const take = (o: StartingWealthOption) => {
    update((d) => void takeStartingWealth(d, o));
    setChanging(false);
  };

  if (taken && !changing) {
    const equipment = [takenOption?.classEquipment && "class", takenOption?.backgroundEquipment && "background"].filter(Boolean);
    return (
      <div className="starting-wealth taken">
        <div className="grow">
          <strong>Starting wealth</strong> <span className="small">{takenText(takenOption, taken.gp, taken.rolls)}</span>
          {equipment.length > 0 && (
            <div className="muted small">Add your {equipment.join(" and ")} starting equipment below with “Add” (it’s free).</div>
          )}
        </div>
        <button className="small ghost" onClick={() => setChanging(true)}>
          Change
        </button>
      </div>
    );
  }

  const source = [wealth.className, wealth.backgroundName].filter(Boolean).join(" · ");
  return (
    <div className="starting-wealth">
      <div className="row">
        <strong className="grow">Starting wealth</strong>
        <span className="muted small">{source}</span>
      </div>
      <p className="muted small">
        {wealth.rules === "2014"
          ? "Take your class and background equipment, or ignore it and buy your own gear with gold."
          : "Your class and background each offer their equipment or gold instead."}
      </p>
      <div className="wealth-options">
        {wealth.options.map((o) => (
          <button key={o.key} className={o.key === taken?.option ? "small primary" : "small"} onClick={() => take(o)}>
            {o.label}
          </button>
        ))}
        {taken && (
          <>
            <button
              className="small ghost danger"
              title="Remove the starting gold from your purse"
              onClick={() => {
                update((d) => clearStartingWealth(d));
                setChanging(false);
              }}
            >
              Remove
            </button>
            <button className="small ghost" onClick={() => setChanging(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

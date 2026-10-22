import { formatModifier, type CompanionSheet } from "@daybreakbuilder/engine";
import { useApp } from "../state/app";
import { useUnits } from "../units";

/** Monster-manual style stat block for one of the character's companions. */
export function CompanionBlock({ c }: { c: CompanionSheet }) {
  const units = useUnits();
  const speeds = [
    units.distance(c.speed.walk),
    ...(["climb", "swim", "fly", "burrow"] as const).filter((k) => c.speed[k] > 0).map((k) => `${k} ${units.distance(c.speed[k])}`),
  ];
  const saves = c.savingThrows.filter((s) => s.proficient);
  return (
    <section className="box companion">
      <h3>{c.grantedBy || "Companion"}</h3>
      <h4 className="statblock-name">{c.name}</h4>
      <div className="muted small">{c.summary}</div>
      <div className="statblock-line">
        <span>
          <strong>Armor Class</strong> {c.armorClass}
        </span>
        <span>
          <strong>Hit Points</strong> {c.maxHp}
          {c.hitDice && <span className="muted"> ({c.hitDice})</span>}
        </span>
        <span>
          <strong>Speed</strong> {speeds.join(", ")}
        </span>
        <span>
          <strong>Initiative</strong> {formatModifier(c.initiative)}
        </span>
      </div>
      <div className="ability-boxes small-boxes">
        {c.abilities.map((a) => (
          <div key={a.ability} className="ability-box">
            <div className="abbr">{a.ability.slice(0, 3).toUpperCase()}</div>
            <div>
              {a.score} ({formatModifier(a.modifier)})
            </div>
          </div>
        ))}
      </div>
      {saves.length > 0 && (
        <p className="prof-line">
          <strong>Saving Throws</strong> {saves.map((s) => `${s.name.slice(0, 3)} ${formatModifier(s.total)}`).join(", ")}
        </p>
      )}
      {c.skills.length > 0 && (
        <p className="prof-line">
          <strong>Skills</strong> {c.skills.map((s) => `${s.name} ${formatModifier(s.total)}`).join(", ")}
        </p>
      )}
      {c.defenses.map((d) => (
        <p key={d} className="prof-line">
          {d}
        </p>
      ))}
      <p className="prof-line">
        <strong>Senses</strong> {units.text(c.senses)}
      </p>
      <p className="prof-line">
        <strong>Languages</strong> {c.languages}
      </p>
      <p className="prof-line">
        {c.challenge && c.challenge !== "—" && (
          <>
            <strong>Challenge</strong> {c.challenge} ·{" "}
          </>
        )}
        <strong>Proficiency Bonus</strong> {formatModifier(c.proficiencyBonus)}
      </p>
      {(c.attackBonus !== 0 || c.damageBonus !== 0) && (
        <p className="prof-line small">
          Bonuses from your features: attack {formatModifier(c.attackBonus)}, damage {formatModifier(c.damageBonus)}
        </p>
      )}
      {(
        [
          ["Traits", c.traits],
          ["Actions", c.actions],
          ["Reactions", c.reactions],
        ] as const
      ).map(([title, list]) =>
        list.length ? (
          <div key={title}>
            <h5>{title}</h5>
            {list.map((f) =>
              f.text.split("\n").map((para, i) => (
                <p key={`${f.id}-${i}`} className="feature-text">
                  {i === 0 && <strong>{f.name}. </strong>}
                  {units.text(para)}
                </p>
              )),
            )}
          </div>
        ) : null,
      )}
    </section>
  );
}

/** Placeholder for a companion the character can have but hasn't chosen yet (flagged, never blocking). */
export function PendingCompanion({ name }: { name: string }) {
  const { setPage } = useApp();
  return (
    <section className="box companion pending-companion">
      <h3>
        {name} <span className="dot" title="Choice needed" />
      </h3>
      <p className="muted">
        No companion chosen yet. Pick one on the{" "}
        <button className="link" onClick={() => setPage("build")}>
          Build
        </button>{" "}
        page to see its stat block here.
      </p>
    </section>
  );
}

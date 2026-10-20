import { formatModifier, type CompanionSheet } from "@dndbuilder/engine";

/** Monster-manual style stat block for the character's companion. */
export function CompanionBlock({ c }: { c: CompanionSheet }) {
  const speeds = [
    `${c.speed.walk} ft.`,
    ...(["climb", "swim", "fly", "burrow"] as const).filter((k) => c.speed[k] > 0).map((k) => `${k} ${c.speed[k]} ft.`),
  ];
  const saves = c.savingThrows.filter((s) => s.proficient);
  return (
    <section className="box companion">
      <h3>Companion</h3>
      <h4 className="statblock-name">{c.name}</h4>
      <div className="muted small">{c.summary}</div>
      <div className="statblock-line">
        <span>
          <strong>Armor Class</strong> {c.armorClass}
        </span>
        <span>
          <strong>Hit Points</strong> {c.maxHp}
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
      {c.senses && (
        <p className="prof-line">
          <strong>Senses</strong> {c.senses}
        </p>
      )}
      <p className="prof-line">
        <strong>Languages</strong> {c.languages}
        {c.challenge && (
          <>
            {" "}
            · <strong>Challenge</strong> {c.challenge} · <strong>Proficiency</strong> {formatModifier(c.proficiencyBonus)}
          </>
        )}
      </p>
      {(c.attackBonus !== 0 || c.damageBonus !== 0) && (
        <p className="prof-line small">
          Bonuses from your features: attack {formatModifier(c.attackBonus)}, damage {formatModifier(c.damageBonus)}
        </p>
      )}
      {[
        ["Traits", c.traits],
        ["Actions", c.actions],
        ["Reactions", c.reactions],
      ].map(([title, list]) =>
        (list as CompanionSheet["traits"]).length ? (
          <div key={title as string}>
            <h5>{title as string}</h5>
            {(list as CompanionSheet["traits"]).map((f) => (
              <p key={f.id} className="feature-text">
                <strong>{f.name}.</strong> {f.text}
              </p>
            ))}
          </div>
        ) : null,
      )}
    </section>
  );
}

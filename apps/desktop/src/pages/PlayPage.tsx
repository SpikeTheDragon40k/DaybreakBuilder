import {
  CONDITIONS,
  currentHp,
  damageRoll,
  damageTotal,
  exhaustionPenalty,
  formatModifier,
  gainTempHp,
  heal,
  hitDiceLeft,
  logPlay,
  longRest,
  MAX_EXHAUSTION,
  newPlayState,
  playResources,
  resolveAttack,
  shortRest,
  slotKey,
  slotsLeft,
  spendHitDie,
  takeDamage,
  usesLeft,
  type AttackRow,
  type PlayState,
  type RulesEdition,
} from "@daybreakbuilder/engine";
import { useMemo, useState, type ReactNode } from "react";
import { Portrait } from "../components/Portrait";
import { DEFAULT_TOKEN_COLOR } from "../portraits";
import { useCharacter } from "../state/app";
import { useUnits } from "../units";

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const numberOrUndefined = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? undefined : Number(s));

/** Play mode: the character at the table. Dice are rolled for real; the page asks for the results. */
export function PlayPage() {
  const { sheet, character, update, setPage } = useCharacter();
  const play = character.state.play ?? newPlayState();
  const rules = character.state.rules;
  const res = useMemo(() => playResources(sheet), [sheet]);
  const maxHp = sheet.maxHp;
  const hp = currentHp(play, maxHp);
  const units = useUnits();

  const setPlay = (fn: (p: PlayState) => PlayState) => update((d) => void (d.play = fn(d.play ?? newPlayState())));
  const toggle = (text: string, fn: (p: PlayState) => PlayState) => setPlay((p) => logPlay(fn(p), text));

  const speedPenalty = rules === "2024" ? 5 * play.exhaustion : 0;
  return (
    <div className="play-page">
      <header className="play-header">
        <Portrait src={character.state.portrait} name={sheet.name} size={64} ring={character.state.tokenColor ?? DEFAULT_TOKEN_COLOR} />
        <div>
          <h1>{sheet.name}</h1>
          <div className="muted">{[[sheet.race, sheet.subrace].filter(Boolean).join(" "), sheet.classSummary].filter(Boolean).join(" · ")}</div>
        </div>
        <span className="spacer" />
        <label className="check" title="Heroic Inspiration: reroll any die once">
          <input
            type="checkbox"
            checked={play.heroicInspiration}
            onChange={(e) => {
              const on = e.target.checked;
              toggle(on ? "Gained Heroic Inspiration." : "Used Heroic Inspiration.", (p) => ({ ...p, heroicInspiration: on }));
            }}
          />
          Heroic Inspiration
        </label>
        <RestButtons res={res} play={play} maxHp={maxHp} rules={rules} setPlay={setPlay} />
        <button onClick={() => setPage("sheet")}>End session</button>
      </header>

      <div className="play-grid">
        <div className="play-col">
          <HitPoints play={play} hp={hp} maxHp={maxHp} setPlay={setPlay} />
          <section className="box">
            <h3>Combat</h3>
            <div className="headline-stats">
              <Stat label="Armor Class" value={sheet.armorClass} />
              <Stat label="Initiative" value={formatModifier(sheet.initiative - exhaustionPenalty(play, rules))} />
              <Stat label="Speed" value={units.distance(Math.max(0, sheet.speed.walk - speedPenalty))} />
              <Stat label="Proficiency" value={formatModifier(sheet.proficiencyBonus)} />
              <Stat label="Passive Perception" value={sheet.passivePerception} />
            </div>
            {sheet.spellcasting.map((c) => (
              <div key={c.name} className="small play-casting">
                {c.name}: spell save DC <strong>{c.dc}</strong>, spell attack <strong>{formatModifier(c.attack)}</strong>
              </div>
            ))}
          </section>
          <Conditions play={play} rules={rules} toggle={toggle} />
        </div>

        <div className="play-col">
          <Attack attacks={sheet.attacks} penalty={exhaustionPenalty(play, rules)} onLog={(text) => setPlay((p) => logPlay(p, text))} />
          {res.slots.length > 0 && (
            <section className="box">
              <h3>Spell slots</h3>
              {res.slots.map((pool) => (
                <div key={pool.key} className="play-pool">
                  {res.slots.length > 1 && (
                    <div className="small muted">
                      {pool.label} · {pool.recharge === "short" ? "Short Rest" : "Long Rest"}
                    </div>
                  )}
                  {pool.slots.map((max, i) =>
                    max > 0 ? (
                      <Pips
                        key={i}
                        label={`${ordinal(i + 1)} level`}
                        max={max}
                        left={slotsLeft(play, pool, i + 1)}
                        onSpend={() =>
                          toggle(`Spent a ${ordinal(i + 1)}-level spell slot.`, (p) => ({
                            ...p,
                            spentSlots: { ...p.spentSlots, [slotKey(pool.key, i + 1)]: (p.spentSlots[slotKey(pool.key, i + 1)] ?? 0) + 1 },
                          }))
                        }
                        onRegain={() =>
                          toggle(`Regained a ${ordinal(i + 1)}-level spell slot.`, (p) => ({
                            ...p,
                            spentSlots: { ...p.spentSlots, [slotKey(pool.key, i + 1)]: Math.max(0, (p.spentSlots[slotKey(pool.key, i + 1)] ?? 0) - 1) },
                          }))
                        }
                      />
                    ) : null,
                  )}
                </div>
              ))}
            </section>
          )}
          {res.features.length > 0 && (
            <section className="box">
              <h3>Limited uses</h3>
              {res.features.map((f) => (
                <Pips
                  key={f.id}
                  label={f.name}
                  detail={f.usage}
                  max={f.max}
                  left={usesLeft(play, f)}
                  onSpend={() => toggle(`Used ${f.name}.`, (p) => ({ ...p, usedFeatures: { ...p.usedFeatures, [f.id]: (p.usedFeatures[f.id] ?? 0) + 1 } }))}
                  onRegain={() =>
                    toggle(`Regained a use of ${f.name}.`, (p) => ({
                      ...p,
                      usedFeatures: { ...p.usedFeatures, [f.id]: Math.max(0, (p.usedFeatures[f.id] ?? 0) - 1) },
                    }))
                  }
                />
              ))}
            </section>
          )}
        </div>

        <div className="play-col">
          <section className="box">
            <h3>Session log</h3>
            {play.log.length === 0 ? (
              <p className="muted small">Nothing yet.</p>
            ) : (
              <ol className="play-log">
                {[...play.log].reverse().slice(0, 40).map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <span className="muted small">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> {e.text}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

/** Filled pips are uses left; click one to spend, the empty ones to get one back. */
function Pips({ label, detail, max, left, onSpend, onRegain }: { label: string; detail?: string; max: number; left: number; onSpend: () => void; onRegain: () => void }) {
  return (
    <div className="pips-row">
      <span className="pips-label">
        {label}
        {detail && <span className="muted small"> · {detail}</span>}
      </span>
      <span className="pips" role="group" aria-label={`${label}: ${left} of ${max} left`}>
        {Array.from({ length: max }, (_, i) => {
          const full = i < left;
          return (
            <button
              key={i}
              className={`pip ${full ? "full" : ""}`}
              title={full ? "Spend one" : "Get one back"}
              aria-label={full ? `Spend ${label}` : `Regain ${label}`}
              onClick={full ? onSpend : onRegain}
            />
          );
        })}
      </span>
      <span className="small muted">
        {left}/{max}
      </span>
    </div>
  );
}

function HitPoints({ play, hp, maxHp, setPlay }: { play: PlayState; hp: number; maxHp: number; setPlay: (fn: (p: PlayState) => PlayState) => void }) {
  const [amount, setAmount] = useState("");
  const n = numberOrUndefined(amount);
  const apply = (fn: (p: PlayState, n: number) => PlayState) => {
    if (n === undefined || n <= 0) return;
    setPlay((p) => fn(p, n));
    setAmount("");
  };
  const dying = hp === 0;
  const { successes, failures } = play.deathSaves;
  const setSaves = (kind: "successes" | "failures", count: number) =>
    setPlay((p) =>
      logPlay({ ...p, deathSaves: { ...p.deathSaves, [kind]: count } }, `Death saves: ${kind === "successes" ? count : p.deathSaves.successes} successes, ${kind === "failures" ? count : p.deathSaves.failures} failures.`),
    );
  return (
    <section className={`box play-hp ${dying ? "dying" : ""}`}>
      <h3>Hit points</h3>
      <div className="play-hp-value">
        <span className="big">{hp}</span>
        <span className="muted"> / {Math.max(0, maxHp)}</span>
        {play.tempHp > 0 && <span className="temp"> +{play.tempHp} temp</span>}
      </div>
      <div className="play-hp-bar" aria-hidden>
        <div style={{ width: `${maxHp ? (100 * hp) / maxHp : 0}%` }} />
      </div>
      <div className="row">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply((p, v) => takeDamage(p, maxHp, v))}
          aria-label="Amount of damage or healing"
          className="play-number"
        />
        <button className="danger" disabled={!n} onClick={() => apply((p, v) => takeDamage(p, maxHp, v))}>
          Damage
        </button>
        <button className="ok" disabled={!n} onClick={() => apply((p, v) => heal(p, maxHp, v))}>
          Heal
        </button>
        <button disabled={!n} onClick={() => apply((p, v) => gainTempHp(p, v))}>
          Temp HP
        </button>
      </div>
      {dying && (
        <div className="death-saves">
          <strong>Death saves</strong>
          <SaveBoxes label="Successes" count={successes} onChange={(c) => setSaves("successes", c)} />
          <SaveBoxes label="Failures" count={failures} onChange={(c) => setSaves("failures", c)} />
          {failures >= 3 ? (
            <div className="error-text">Dead.</div>
          ) : successes >= 3 ? (
            <div className="ok-text">Stable at 0 HP.</div>
          ) : (
            <div className="muted small">Roll a d20 at the start of each turn: 10+ succeeds, a natural 20 brings you back with 1 HP.</div>
          )}
        </div>
      )}
    </section>
  );
}

function SaveBoxes({ label, count, onChange }: { label: string; count: number; onChange: (c: number) => void }) {
  return (
    <div className="save-boxes" role="group" aria-label={label}>
      <span className="small">{label}</span>
      {[1, 2, 3].map((i) => (
        <input key={i} type="checkbox" checked={count >= i} aria-label={`${label} ${i}`} onChange={() => onChange(count >= i ? i - 1 : i)} />
      ))}
    </div>
  );
}

function RestButtons({
  res,
  play,
  maxHp,
  rules,
  setPlay,
}: {
  res: ReturnType<typeof playResources>;
  play: PlayState;
  maxHp: number;
  rules: RulesEdition;
  setPlay: (fn: (p: PlayState) => PlayState) => void;
}) {
  const [resting, setResting] = useState(false);
  const [rolls, setRolls] = useState<Record<string, string>>({});
  return (
    <>
      <button onClick={() => setResting((v) => !v)} aria-expanded={resting}>
        Short Rest
      </button>
      <button
        onClick={() => {
          if (confirm("Take a Long Rest? Hit points, spell slots and feature uses come back, and Exhaustion drops by 1.")) setPlay((p) => longRest(p, res, rules));
        }}
      >
        Long Rest
      </button>
      {resting && (
        <div className="play-rest">
          <p className="small">
            Spend hit dice to heal: roll the die, add your Constitution modifier, and enter the total. Then finish the rest to get back Short Rest uses.
          </p>
          {res.hitDice.map((pool) => {
            const left = hitDiceLeft(play, pool);
            const value = rolls[pool.die] ?? "";
            const healing = numberOrUndefined(value);
            return (
              <div key={pool.die} className="row">
                <span>
                  {pool.die}: {left}/{pool.total} left
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="play-number"
                  placeholder="Total"
                  value={value}
                  aria-label={`Healing rolled with a ${pool.die}`}
                  onChange={(e) => setRolls((r) => ({ ...r, [pool.die]: e.target.value }))}
                />
                <button
                  disabled={left === 0 || healing === undefined}
                  onClick={() => {
                    setPlay((p) => spendHitDie(p, maxHp, pool, healing ?? 0));
                    setRolls((r) => ({ ...r, [pool.die]: "" }));
                  }}
                >
                  Spend {pool.die}
                </button>
              </div>
            );
          })}
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                setPlay((p) => shortRest(p, res));
                setResting(false);
              }}
            >
              Finish Short Rest
            </button>
            <button className="ghost" onClick={() => setResting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Conditions({ play, rules, toggle }: { play: PlayState; rules: RulesEdition; toggle: (text: string, fn: (p: PlayState) => PlayState) => void }) {
  const setExhaustion = (level: number) =>
    toggle(level === 0 ? "No longer exhausted." : `Exhaustion level ${level}.`, (p) => ({ ...p, exhaustion: level }));
  return (
    <section className="box">
      <h3>Conditions</h3>
      <div className="chips">
        {CONDITIONS.map((c) => {
          const on = play.conditions.includes(c);
          return (
            <button
              key={c}
              className={`chip ${on ? "on" : ""}`}
              aria-pressed={on}
              onClick={() =>
                toggle(on ? `No longer ${c.toLowerCase()}.` : `${c}.`, (p) => ({
                  ...p,
                  conditions: on ? p.conditions.filter((x) => x !== c) : [...p.conditions, c],
                }))
              }
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="row play-exhaustion">
        <span>Exhaustion</span>
        <button className="small" disabled={play.exhaustion === 0} onClick={() => setExhaustion(play.exhaustion - 1)} aria-label="Less exhaustion">
          −
        </button>
        <strong>{play.exhaustion}</strong>
        <button className="small" disabled={play.exhaustion >= MAX_EXHAUSTION} onClick={() => setExhaustion(play.exhaustion + 1)} aria-label="More exhaustion">
          +
        </button>
        <span className="muted small">
          {play.exhaustion === 0
            ? ""
            : play.exhaustion >= MAX_EXHAUSTION
              ? "Death."
              : rules === "2024"
                ? `−${2 * play.exhaustion} to d20 Tests, speed −${5 * play.exhaustion} ft. (already applied above)`
                : "See the 2014 Exhaustion table."}
        </span>
      </div>
    </section>
  );
}

/** Pick a weapon, enter the d20 you rolled (and the damage dice), get the totals. */
function Attack({ attacks, penalty, onLog }: { attacks: AttackRow[]; penalty: number; onLog: (text: string) => void }) {
  const [key, setKey] = useState(attacks[0]?.key ?? "");
  const [d20, setD20] = useState("");
  const [targetAc, setTargetAc] = useState("");
  const [rolled, setRolled] = useState("");
  const [versatile, setVersatile] = useState(false);
  const attack = attacks.find((a) => a.key === key) ?? attacks[0];
  if (!attack) return null;

  const natural = numberOrUndefined(d20);
  const validD20 = natural !== undefined && natural >= 1 && natural <= 20 && Number.isInteger(natural);
  const result = validD20 ? resolveAttack(attack, natural, { penalty, targetAc: numberOrUndefined(targetAc) }) : undefined;
  const critical = !!result?.critical;
  const useVersatile = versatile && !!attack.versatile;
  const roll = damageRoll(attack, { versatile: useVersatile, critical });
  const damageDice = numberOrUndefined(rolled);
  const damage = damageDice !== undefined || !roll.dice ? damageTotal(attack, damageDice ?? 0, { versatile: useVersatile, critical }) : undefined;
  const reset = () => {
    setD20("");
    setRolled("");
  };

  return (
    <section className="box play-attack">
      <h3>Attack</h3>
      <div className="row wrap">
        <select
          value={attack.key}
          onChange={(e) => {
            setKey(e.target.value);
            setVersatile(false);
            reset();
          }}
          aria-label="Weapon"
        >
          {attacks.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name} ({formatModifier(a.attack)}, {a.damage})
            </option>
          ))}
        </select>
        {attack.versatile && (
          <label className="check">
            <input type="checkbox" checked={versatile} onChange={(e) => setVersatile(e.target.checked)} />
            Two hands ({attack.versatile})
          </label>
        )}
      </div>
      <div className="row wrap">
        <label>
          d20 rolled
          <input type="number" min={1} max={20} inputMode="numeric" className="play-number" value={d20} onChange={(e) => setD20(e.target.value)} />
        </label>
        <label>
          Target AC <span className="muted small">(optional)</span>
          <input type="number" min={0} inputMode="numeric" className="play-number" value={targetAc} onChange={(e) => setTargetAc(e.target.value)} />
        </label>
      </div>
      {result && (
        <div className={`play-result ${result.critical ? "crit" : result.fumble || result.hit === false ? "miss" : result.hit ? "hit" : ""}`}>
          <strong>{result.total}</strong> to hit
          <span className="muted small">
            {" "}
            ({natural} {formatModifier(attack.attack)}
            {penalty ? ` −${penalty} exhaustion` : ""})
          </span>
          {result.critical ? " · Critical hit!" : result.fumble ? " · Natural 1: miss" : result.hit === true ? " · Hit" : result.hit === false ? " · Miss" : ""}
        </div>
      )}
      {result && !result.fumble && result.hit !== false && (
        <div className="row wrap">
          {roll.dice ? (
            <label>
              Roll {roll.dice} for damage
              <input type="number" min={0} inputMode="numeric" className="play-number" value={rolled} onChange={(e) => setRolled(e.target.value)} />
            </label>
          ) : null}
          {damage !== undefined && (
            <div className="play-result hit">
              <strong>{damage}</strong> {attack.damageType} damage
              {roll.bonus !== 0 && (
                <span className="muted small">
                  {" "}
                  ({roll.dice ? `${damageDice} ` : ""}
                  {formatModifier(roll.bonus)})
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {result && (
        <div className="row">
          <button
            className="primary"
            onClick={() => {
              const outcome = result.critical ? "critical hit" : result.fumble ? "natural 1, miss" : result.hit === true ? "hit" : result.hit === false ? "miss" : "";
              let text = `${attack.name}: ${result.total} to hit (d20 ${natural})${outcome ? `, ${outcome}` : ""}`;
              if (damage !== undefined && !result.fumble && result.hit !== false) text += `; ${damage} ${attack.damageType} damage`;
              onLog(`${text}.`);
              reset();
            }}
          >
            Log attack
          </button>
          <button className="ghost" onClick={reset}>
            Clear
          </button>
        </div>
      )}
    </section>
  );
}

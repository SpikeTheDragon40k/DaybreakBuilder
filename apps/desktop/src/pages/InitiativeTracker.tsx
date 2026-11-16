import {
  addMonsters,
  concentrationDc,
  CONDITIONS,
  currentHp,
  damageMonster,
  fixedInitiative,
  formatModifier,
  gainTempHp,
  heal,
  healMonster,
  logCombat,
  monsterTemplates,
  newCombat,
  newCombatant,
  nextTurn,
  previousTurn,
  takeDamage,
  turnOrder,
  updateCombatant,
  type Combat,
  type Combatant,
  type ContentRegistry,
  type PlayState,
} from "@daybreakbuilder/engine";
import { useMemo, useState } from "react";
import { ElementDetail } from "../components/ElementDetail";
import { Portrait } from "../components/Portrait";
import { DEFAULT_TOKEN_COLOR } from "../portraits";
import { newId } from "../state/app";
import { addEncounterLines, type Party, type PartyMember } from "../state/party";

interface Props {
  party: Party;
  members: PartyMember[];
  registry: ContentRegistry | undefined;
  playOf: (id: string) => PlayState | undefined;
  updatePlay: (id: string, fn: (p: PlayState) => PlayState) => void;
  onChange: (p: Party) => void;
}

const numberOrUndefined = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? undefined : Number(s));

/** Run an encounter: turn order, rounds, hit points, conditions with durations, concentration. */
export function InitiativeTracker({ party, members, registry, playOf, updatePlay, onChange }: Props) {
  const combat = party.combat ?? newCombat();
  const setCombat = (next: Combat) => onChange({ ...party, combat: next });
  const templates = useMemo(() => (registry ? monsterTemplates(registry) : []), [registry]);
  const member = (c: Combatant) => (c.characterId ? members.find((m) => m.id === c.characterId) : undefined);
  const order = turnOrder(combat.combatants);
  const current = combat.combatants.find((x) => x.id === combat.turnId);
  const [statBlock, setStatBlock] = useState<string | null>(null);

  const addParty = () => {
    const missing = members.filter((m) => !combat.combatants.some((x) => x.characterId === m.id));
    if (!missing.length) return;
    const added = missing.map((m) =>
      newCombatant(newId(), { kind: "character", name: m.name, characterId: m.id, ac: m.armorClass, initiativeBonus: m.initiative }),
    );
    setCombat(logCombat({ ...combat, combatants: [...combat.combatants, ...added] }, `Added ${added.map((x) => x.name).join(", ")}.`));
  };

  /** The planned encounter's monsters, with stats from the loaded content when the name matches. */
  const addPlanned = () => {
    const next = addEncounterLines(combat, party.encounter?.monsters ?? [], templates, newId);
    if (next !== combat) setCombat(next);
  };

  /** Turn advance; conditions that ran out on characters also leave their Play state. */
  const advance = (fn: (c: Combat) => Combat) => {
    const next = fn(combat);
    for (const before of combat.combatants) {
      if (!before.characterId) continue;
      const after = next.combatants.find((x) => x.id === before.id);
      const ended = before.conditions.filter((cond) => !after?.conditions.some((x) => x.name === cond.name)).map((c) => c.name);
      if (ended.length) updatePlay(before.characterId, (p) => ({ ...p, conditions: p.conditions.filter((c) => !ended.includes(c)) }));
    }
    setCombat(next);
  };

  const missingInitiative = combat.combatants.filter((x) => x.initiative === null && !x.defeated);
  const statElement = statBlock && registry ? registry.get(statBlock) : undefined;

  return (
    <div className="initiative">
      <section className="panel initiative-bar">
        <div className="initiative-status">
          <strong>{combat.round === 0 ? "Not started" : `Round ${combat.round}`}</strong>
          {current && <span> · {current.name}'s turn</span>}
        </div>
        <span className="spacer" />
        <button disabled={combat.round === 0} onClick={() => advance(previousTurn)}>
          ◀ Previous
        </button>
        <button className="primary" disabled={!order.some((x) => x.initiative !== null && !x.defeated)} onClick={() => advance(nextTurn)}>
          {combat.round === 0 ? "Start encounter" : "Next turn ▶"}
        </button>
        <button
          className="ghost danger"
          disabled={!combat.combatants.length}
          onClick={() => confirm("End the encounter and clear the tracker? Characters keep their hit points.") && setCombat(newCombat())}
        >
          End encounter
        </button>
      </section>

      <AddCombatants
        templates={templates}
        hasPartyToAdd={members.some((m) => !combat.combatants.some((x) => x.characterId === m.id))}
        hasPlanned={!!party.encounter?.monsters.some((l) => l.name.trim() && l.count > 0)}
        onAddParty={addParty}
        onAddPlanned={addPlanned}
        onAdd={(t, count) => setCombat(addMonsters(combat, t, count, newId))}
      />

      {missingInitiative.length > 0 && (
        <div className="callout small">
          Waiting for initiative: {missingInitiative.map((x) => x.name).join(", ")}.{" "}
          {missingInitiative.some((x) => x.kind === "monster") && (
            <button
              className="link small"
              onClick={() =>
                setCombat({
                  ...combat,
                  combatants: combat.combatants.map((x) => (x.kind === "monster" && x.initiative === null ? { ...x, initiative: fixedInitiative(x) } : x)),
                })
              }
            >
              Give monsters 10 + their bonus
            </button>
          )}
        </div>
      )}

      {order.length === 0 ? (
        <p className="muted">Add the party and some monsters, enter everyone's initiative, then start the encounter.</p>
      ) : (
        <ol className="initiative-list">
          {order.map((c) => (
            <CombatantRow
              key={c.id}
              c={c}
              active={c.id === combat.turnId}
              member={member(c)}
              play={c.characterId ? playOf(c.characterId) : undefined}
              hasStatBlock={!!(c.elementId && registry?.get(c.elementId))}
              onStatBlock={() => setStatBlock(c.elementId ?? null)}
              combat={combat}
              setCombat={setCombat}
              updatePlay={updatePlay}
            />
          ))}
        </ol>
      )}

      {combat.log.length > 0 && (
        <section className="box">
          <h3>Encounter log</h3>
          <ol className="play-log">
            {[...combat.log].reverse().slice(0, 30).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>
      )}

      {statElement && registry && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setStatBlock(null)}>
          <div className="modal" role="dialog" aria-label={statElement.name}>
            <header className="modal-header">
              <h2>{statElement.name}</h2>
              <button className="ghost" onClick={() => setStatBlock(null)} aria-label="Close">
                ✕
              </button>
            </header>
            <ElementDetail element={statElement} registry={registry} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddCombatants({
  templates,
  hasPartyToAdd,
  hasPlanned,
  onAddParty,
  onAddPlanned,
  onAdd,
}: {
  templates: ReturnType<typeof monsterTemplates>;
  hasPartyToAdd: boolean;
  hasPlanned: boolean;
  onAddParty: () => void;
  onAddPlanned: () => void;
  onAdd: (t: { name: string; ac: number; hp: number; initiativeBonus: number; elementId?: string }, count: number) => void;
}) {
  const [name, setName] = useState("");
  const [count, setCount] = useState("1");
  const [ac, setAc] = useState("");
  const [hp, setHp] = useState("");
  const [bonus, setBonus] = useState("");
  const known = templates.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
  const pickName = (v: string) => {
    setName(v);
    const t = templates.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    if (t) {
      setAc(String(t.ac));
      setHp(String(t.hp));
      setBonus(String(t.initiativeBonus));
    }
  };
  const n = Math.max(1, Math.min(26, numberOrUndefined(count) ?? 1));
  return (
    <section className="panel initiative-add">
      <div className="row wrap">
        <button disabled={!hasPartyToAdd} onClick={onAddParty}>
          Add the party
        </button>
        <button disabled={!hasPlanned} onClick={onAddPlanned} title="The monsters of the encounter planned in the Overview">
          Add planned monsters
        </button>
      </div>
      <div className="row wrap initiative-monster">
        <label>
          Monster
          <input list="initiative-monsters" value={name} placeholder="Name" onChange={(e) => pickName(e.target.value)} />
          <datalist id="initiative-monsters">
            {templates.map((t) => (
              <option key={t.elementId} value={t.name}>
                {t.challenge ? `CR ${t.challenge}` : ""} {t.source}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          How many
          <input type="number" min={1} max={26} className="play-number" value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label>
          AC
          <input type="number" min={0} className="play-number" value={ac} onChange={(e) => setAc(e.target.value)} />
        </label>
        <label>
          HP
          <input type="number" min={1} className="play-number" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
        <label>
          Init bonus
          <input type="number" className="play-number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </label>
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={() => {
            onAdd(
              {
                name: name.trim(),
                ac: numberOrUndefined(ac) ?? known?.ac ?? 10,
                hp: Math.max(1, numberOrUndefined(hp) ?? known?.hp ?? 1),
                initiativeBonus: numberOrUndefined(bonus) ?? known?.initiativeBonus ?? 0,
                elementId: known?.elementId,
              },
              n,
            );
            setName("");
            setCount("1");
            setAc("");
            setHp("");
            setBonus("");
          }}
        >
          Add {n > 1 ? `${n} monsters` : "monster"}
        </button>
      </div>
      <p className="muted small">
        Pick a creature from the loaded content to fill in its stats, or type any name and its numbers. Several of a kind are labelled
        A, B, C…
      </p>
    </section>
  );
}

function CombatantRow({
  c,
  active,
  member,
  play,
  hasStatBlock,
  onStatBlock,
  combat,
  setCombat,
  updatePlay,
}: {
  c: Combatant;
  active: boolean;
  member?: PartyMember;
  play?: PlayState;
  hasStatBlock: boolean;
  onStatBlock: () => void;
  combat: Combat;
  setCombat: (c: Combat) => void;
  updatePlay: (id: string, fn: (p: PlayState) => PlayState) => void;
}) {
  const [amount, setAmount] = useState("");
  const [condition, setCondition] = useState("");
  const [rounds, setRounds] = useState("");
  const isPc = c.kind === "character" && !!c.characterId;
  const maxHp = isPc ? (member?.maxHp ?? 0) : c.maxHp;
  const hp = isPc ? currentHp(play ?? ({ hp: null } as PlayState), maxHp) : c.hp;
  const tempHp = isPc ? (play?.tempHp ?? 0) : c.tempHp;
  const conditionNames = isPc ? (play?.conditions ?? []) : c.conditions.map((x) => x.name);
  const roundsOf = (name: string) => c.conditions.find((x) => x.name === name)?.rounds;
  const set = (fn: (x: Combatant) => Combatant) => setCombat(updateCombatant(combat, c.id, fn));
  const n = numberOrUndefined(amount);

  const damage = () => {
    if (!n || n <= 0) return;
    if (isPc) {
      updatePlay(c.characterId!, (p) => takeDamage(p, maxHp, n));
      const left = Math.max(0, hp + tempHp - n);
      let text = `${c.name} takes ${n} damage`;
      if (c.concentrating && left > 0) text += `; Constitution save DC ${concentrationDc(n)} to keep concentrating`;
      setCombat(logCombat(combat, `${text}.`));
    } else setCombat(damageMonster(combat, c.id, n));
    setAmount("");
  };
  const healIt = () => {
    if (!n || n <= 0) return;
    if (isPc) {
      updatePlay(c.characterId!, (p) => heal(p, maxHp, n));
      setCombat(logCombat(combat, `${c.name} heals ${n}.`));
    } else setCombat(healMonster(combat, c.id, n));
    setAmount("");
  };
  const tempIt = () => {
    if (!n || n <= 0) return;
    if (isPc) updatePlay(c.characterId!, (p) => gainTempHp(p, n));
    else set((x) => ({ ...x, tempHp: Math.max(x.tempHp, n) }));
    setAmount("");
  };
  const addCondition = () => {
    if (!condition) return;
    const r = numberOrUndefined(rounds);
    if (isPc) updatePlay(c.characterId!, (p) => (p.conditions.includes(condition) ? p : { ...p, conditions: [...p.conditions, condition] }));
    setCombat(
      logCombat(
        updateCombatant(combat, c.id, (x) => ({
          ...x,
          conditions: [...x.conditions.filter((k) => k.name !== condition), r && r > 0 ? { name: condition, rounds: r } : { name: condition }],
        })),
        `${c.name}: ${condition}${r && r > 0 ? ` for ${r} round${r > 1 ? "s" : ""}` : ""}.`,
      ),
    );
    setCondition("");
    setRounds("");
  };
  const removeCondition = (name: string) => {
    if (isPc) updatePlay(c.characterId!, (p) => ({ ...p, conditions: p.conditions.filter((x) => x !== name) }));
    setCombat(logCombat(updateCombatant(combat, c.id, (x) => ({ ...x, conditions: x.conditions.filter((k) => k.name !== name) })), `${c.name}: no longer ${name.toLowerCase()}.`));
  };

  const down = hp === 0 && maxHp > 0;
  return (
    <li className={`combatant ${active ? "active" : ""} ${c.defeated ? "defeated" : ""} ${c.kind}`}>
      <div className="combatant-main">
        <input
          type="number"
          className="init-input"
          aria-label={`${c.name} initiative`}
          title={`Initiative (bonus ${formatModifier(c.initiativeBonus)})`}
          value={c.initiative ?? ""}
          placeholder={formatModifier(c.initiativeBonus)}
          onChange={(e) => set((x) => ({ ...x, initiative: numberOrUndefined(e.target.value) ?? null }))}
        />
        {member ? (
          <Portrait src={member.portrait} name={member.name} size={36} ring={member.tokenColor ?? DEFAULT_TOKEN_COLOR} />
        ) : (
          <span className="monster-badge" aria-hidden>
            {/ ([A-Z]{1,2})$/.exec(c.name)?.[1] ??
              c.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0].toUpperCase())
                .join("")}
          </span>
        )}
        <div className="combatant-name">
          <input value={c.name} aria-label="Name" onChange={(e) => set((x) => ({ ...x, name: e.target.value }))} />
          <span className="muted small">
            AC {c.ac}
            {hasStatBlock && (
              <>
                {" · "}
                <button className="link small" onClick={onStatBlock}>
                  stat block
                </button>
              </>
            )}
          </span>
        </div>
        <div className={`combatant-hp ${down ? "down" : ""}`} title={isPc ? "Shared with the character's Play mode" : undefined}>
          {isPc && !member ? (
            <span className="muted">…</span>
          ) : (
            <>
              <strong>{hp}</strong>
              <span className="muted">/{maxHp}</span>
            </>
          )}
          {tempHp > 0 && <span className="temp"> +{tempHp}</span>}
          {isPc && down && play && (
            <span className="small"> · saves {play.deathSaves.successes}✓ {play.deathSaves.failures}✗</span>
          )}
        </div>
        <div className="row nowrap combatant-hp-input">
          <input
            type="number"
            min={0}
            className="play-number"
            placeholder="HP"
            aria-label={`Damage or healing for ${c.name}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && damage()}
          />
          <button className="small danger" disabled={!n} onClick={damage}>
            Dmg
          </button>
          <button className="small ok" disabled={!n} onClick={healIt}>
            Heal
          </button>
          <button className="small" disabled={!n} onClick={tempIt} title="Temporary hit points">
            Temp
          </button>
        </div>
        <label className="check small" title="Concentrating on a spell">
          <input type="checkbox" checked={c.concentrating} onChange={(e) => set((x) => ({ ...x, concentrating: e.target.checked }))} />
          Conc.
        </label>
        {c.kind === "monster" && (
          <label className="check small" title="Out of the fight (skipped in the turn order)">
            <input type="checkbox" checked={c.defeated} onChange={(e) => set((x) => ({ ...x, defeated: e.target.checked }))} />
            Down
          </label>
        )}
        <button
          className="ghost small"
          aria-label={`Remove ${c.name}`}
          onClick={() => setCombat(logCombat({ ...combat, combatants: combat.combatants.filter((x) => x.id !== c.id) }, `Removed ${c.name}.`))}
        >
          ✕
        </button>
      </div>
      <div className="combatant-extra">
        <div className="chips">
          {conditionNames.map((name) => {
            const r = roundsOf(name);
            return (
              <button key={name} className="chip on" title="Remove" onClick={() => removeCondition(name)}>
                {name}
                {r ? ` · ${r} rd` : ""} ✕
              </button>
            );
          })}
        </div>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label={`Add a condition to ${c.name}`}>
          <option value="">Condition…</option>
          {CONDITIONS.filter((k) => !conditionNames.includes(k)).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {condition && (
          <>
            <input
              type="number"
              min={1}
              className="play-number"
              placeholder="Rounds"
              aria-label="Rounds (empty: until removed)"
              title="Counts down at the start of this creature's turns; empty lasts until removed"
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
            />
            <button className="small" onClick={addCondition}>
              Add
            </button>
          </>
        )}
        {c.kind === "monster" && (
          <span className="legendary small">
            Legendary
            <input
              type="number"
              min={0}
              max={5}
              className="tiny-number"
              aria-label={`${c.name} legendary actions per round`}
              value={c.legendary?.max ?? 0}
              onChange={(e) => {
                const max = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                set((x) => ({ ...x, legendary: max ? { max, used: Math.min(x.legendary?.used ?? 0, max) } : undefined }));
              }}
            />
            {c.legendary &&
              Array.from({ length: c.legendary.max }, (_, i) => {
                const left = i < c.legendary!.max - c.legendary!.used;
                return (
                  <button
                    key={i}
                    className={`pip ${left ? "full" : ""}`}
                    aria-label={left ? "Use a legendary action" : "Give back a legendary action"}
                    onClick={() =>
                      set((x) => ({ ...x, legendary: x.legendary && { ...x.legendary, used: Math.max(0, Math.min(x.legendary.max, x.legendary.used + (left ? 1 : -1))) } }))
                    }
                  />
                );
              })}
          </span>
        )}
      </div>
    </li>
  );
}

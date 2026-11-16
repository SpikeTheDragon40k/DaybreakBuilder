import { buildSheet, formatModifier, loadCharacterJson, monsterTemplates, newPlayState, resolveCharacter, type CharacterState, type ContentRegistry, type PlayState } from "@daybreakbuilder/engine";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Portrait } from "../components/Portrait";
import { DEFAULT_TOKEN_COLOR } from "../portraits";
import { EncounterCalculator } from "./EncounterCalculator";
import { InitiativeTracker } from "./InitiativeTracker";
import { characters, type CharacterMeta } from "../platform";
import { newId, useApp } from "../state/app";
import { combatForEncounter, formatGp, memberFromSheet, summarizeParty, type Best, type EncounterLine, type Party, type PartyMember } from "../state/party";
import { useUnits } from "../units";

/**
 * The saved characters and the party's members as the party overview shows them. Player characters'
 * hit points and conditions live in their Play state: the open character goes through the app (so its
 * autosave and undo see the change); the others are saved directly.
 */
export function usePartyMembers(party: Party | null) {
  const { content, character, update } = useApp();
  const [roster, setRoster] = useState<CharacterMeta[]>([]);
  const [states, setStates] = useState<Record<string, CharacterState>>({});

  // Saved characters, reloaded when the open one changes so edits show up.
  useEffect(() => {
    void characters.list().then(async (metas) => {
      setRoster(metas);
      const loaded = await Promise.all(metas.map(async (m) => [m.id, await characters.load(m.id)] as const));
      setStates(Object.fromEntries(loaded.filter(([, s]) => s).map(([id, s]) => [id, loadCharacterJson(s)])));
    });
  }, [character]);

  const members = useMemo(() => {
    if (!party || !content) return [];
    const out: PartyMember[] = [];
    for (const id of party.memberIds) {
      // The open character's latest edits may not be saved yet.
      const state = character?.id === id ? character.state : states[id];
      if (!state) continue;
      try {
        out.push(memberFromSheet(id, state, buildSheet(resolveCharacter(content.registry, state))));
      } catch (e) {
        console.error(e);
      }
    }
    return out;
  }, [party, states, content, character]);

  const playOf = (id: string): PlayState | undefined => (character?.id === id ? character.state.play : states[id]?.play);
  const updatePlay = (id: string, fn: (p: PlayState) => PlayState) => {
    if (character?.id === id) {
      update((d) => void (d.play = fn(d.play ?? newPlayState())));
      return;
    }
    const state = states[id];
    const meta = roster.find((m) => m.id === id);
    if (!state || !meta) return;
    const next = { ...state, play: fn(state.play ?? newPlayState()) };
    setStates((s) => ({ ...s, [id]: next }));
    void characters.save({ ...meta, updatedAt: new Date().toISOString() }, next);
  };

  return { roster, states, members, playOf, updatePlay };
}

/** A campaign's party: overview, encounter planner and initiative tracker. */
export function CampaignParty({ party, onChange }: { party: Party; onChange: (p: Party) => void }) {
  const { content, openCharacter } = useApp();
  const { roster, states, members, playOf, updatePlay } = usePartyMembers(party);
  return (
    <PartyDetail
      party={party}
      members={members}
      roster={roster}
      missing={party.memberIds.filter((id) => !states[id]).length}
      onChange={onChange}
      onOpen={(id) => states[id] && openCharacter(id, states[id])}
      registry={content?.registry}
      playOf={playOf}
      updatePlay={updatePlay}
    />
  );
}

function PartyDetail({
  party,
  members,
  roster,
  missing,
  onChange,
  onOpen,
  registry,
  playOf,
  updatePlay,
}: {
  party: Party;
  members: PartyMember[];
  roster: CharacterMeta[];
  missing: number;
  onChange: (p: Party) => void;
  onOpen: (id: string) => void;
  registry: ContentRegistry | undefined;
  playOf: (id: string) => PlayState | undefined;
  updatePlay: (id: string, fn: (p: PlayState) => PlayState) => void;
}) {
  const units = useUnits();
  const [view, setView] = useState<"overview" | "initiative">(() => (party.combat?.combatants.length ? "initiative" : "overview"));
  const [adding, setAdding] = useState("");
  const summary = useMemo(() => summarizeParty(members), [members]);
  const available = roster.filter((c) => !party.memberIds.includes(c.id));

  /** Start a saved encounter: the party and its monsters in a fresh tracker. */
  const run = (name: string, lines: EncounterLine[]) => {
    if (party.combat?.combatants.length && !confirm(`An encounter is already in the tracker. Replace it with “${name}”? Characters keep their hit points.`)) return;
    const templates = registry ? monsterTemplates(registry) : [];
    onChange({ ...party, combat: combatForEncounter(name, members, lines, templates, newId) });
    setView("initiative");
  };

  const add = () => {
    if (!adding) return;
    onChange({ ...party, memberIds: [...party.memberIds, adding] });
    setAdding("");
  };

  return (
    <div className="party-detail">
      <div className="row wrap">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Character to add" disabled={!available.length}>
          <option value="">{available.length ? "Add a character…" : "No more saved characters"}</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Unnamed"} {c.summary && `(${c.summary})`}
            </option>
          ))}
        </select>
        <button className="primary" disabled={!adding} onClick={add}>
          Add
        </button>
      </div>
      {missing > 0 && (
        <p className="muted small">
          {missing} member{missing > 1 ? "s were" : " was"} deleted from Characters.{" "}
          <button className="link small" onClick={() => onChange({ ...party, memberIds: party.memberIds.filter((id) => members.some((m) => m.id === id)) })}>
            Clean up
          </button>
        </p>
      )}

      <nav className="subtabs view-switch" aria-label="Party view">
        <button className={`subtab ${view === "overview" ? "active" : ""}`} aria-current={view === "overview" ? "page" : undefined} onClick={() => setView("overview")}>
          Overview
        </button>
        <button className={`subtab ${view === "initiative" ? "active" : ""}`} aria-current={view === "initiative" ? "page" : undefined} onClick={() => setView("initiative")}>
          Initiative{party.combat?.round ? ` · round ${party.combat.round}` : ""}
        </button>
      </nav>

      {view === "initiative" ? (
        <InitiativeTracker party={party} members={members} registry={registry} playOf={playOf} updatePlay={updatePlay} onChange={onChange} />
      ) : members.length === 0 ? (
        <p className="muted">Add characters from the Characters list to see the party overview.</p>
      ) : (
        <>
          <div className="party-stats">
            <Tile label="Members" value={summary.size} />
            <Tile label="Average level" value={Math.round(summary.averageLevel * 10) / 10} />
            <Tile label="Best passive Perception" value={summary.passivePerception.value} note={summary.passivePerception.names.join(", ")} />
            <Tile label="Best passive Insight" value={summary.passiveInsight.value} note={summary.passiveInsight.names.join(", ")} />
            <Tile label="Party coin" value={formatGp(summary.wealthGp)} />
          </div>

          <EncounterCalculator
            levels={members.map((m) => m.level)}
            encounter={party.encounter}
            registry={registry}
            onChange={(encounter) => onChange({ ...party, encounter })}
            savedEncounters={party.savedEncounters ?? []}
            onSavedChange={(savedEncounters) => onChange({ ...party, savedEncounters })}
            onRun={run}
          />

          <section className="panel party-table-wrap">
            <table className="party-table">
              <thead>
                <tr>
                  <th scope="col">Character</th>
                  <th scope="col" title="Level">Lvl</th>
                  <th scope="col" title="Armor Class">AC</th>
                  <th scope="col" title="Maximum hit points">HP</th>
                  <th scope="col" title="Initiative">Init</th>
                  <th scope="col">Speed</th>
                  <th scope="col" title="Passive Perception / Insight / Investigation">Passives</th>
                  <th scope="col" title="Spell save DC">Spell DC</th>
                  <th scope="col">Senses</th>
                  <th scope="col">Coin</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">
                      <span className="party-member">
                        <Portrait src={m.portrait} name={m.name} size={36} ring={m.tokenColor ?? DEFAULT_TOKEN_COLOR} />
                        <span>
                          <span className="card-title">{m.name}</span>
                          <span className="muted small block">
                            {m.summary || "—"}
                            {m.playerName && ` · ${m.playerName}`}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td>{m.level}</td>
                    <td className="num">{m.armorClass}</td>
                    <td className="num">{m.maxHp}</td>
                    <td>{formatModifier(m.initiative)}</td>
                    <td>{units.distance(m.speed)}</td>
                    <td title="Perception / Insight / Investigation">
                      {m.passivePerception} / {m.passiveInsight} / {m.passiveInvestigation}
                    </td>
                    <td>{m.spellDcs.length ? m.spellDcs.map((c) => <div key={c.name} title={c.name}>{c.dc}</div>) : <span className="muted">—</span>}</td>
                    <td className="small">
                      {m.vision.length ? m.vision.map((v) => `${v.name}${v.range ? ` ${units.distance(v.range)}` : ""}`).join(", ") : <span className="muted">—</span>}
                    </td>
                    <td className="small">{formatGp(m.wealthGp)}</td>
                    <td>
                      <span className="row nowrap">
                        <button className="small ghost" onClick={() => onOpen(m.id)}>
                          Open
                        </button>
                        <button
                          className="small ghost danger"
                          title="Remove from the party (the character is kept)"
                          onClick={() => onChange({ ...party, memberIds: party.memberIds.filter((id) => id !== m.id) })}
                        >
                          Remove
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="party-grid">
            <Box title="Languages">
              <ul className="plain coverage">
                {summary.languages.map((l) => (
                  <li key={l.name}>
                    <span>{l.name}</span>
                    <span className="muted small">{l.speakers.length === summary.size ? "everyone" : l.speakers.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </Box>
            <Box title="Best at each skill">
              <ul className="plain coverage">
                {summary.skills.map((k) => (
                  <li key={k.name} className={k.proficient.length ? "" : "gap"} title={k.proficient.length ? `Proficient: ${k.proficient.join(", ")}` : "Nobody is proficient"}>
                    <span>
                      <span className="val">{formatModifier(k.best.value)}</span> {k.name}
                    </span>
                    <span className="muted small">{names(k.best, summary.size)}</span>
                  </li>
                ))}
              </ul>
            </Box>
            <div>
              <Box title="Saving throw proficiencies">
                <ul className="plain coverage">
                  {summary.saves.map((s) => (
                    <li key={s.ability} className={s.proficient.length ? "" : "gap"}>
                      <span>{s.ability.charAt(0).toUpperCase() + s.ability.slice(1)}</span>
                      <span className="muted small">{s.proficient.join(", ") || "nobody"}</span>
                    </li>
                  ))}
                </ul>
              </Box>
              <Box title="Dark & defenses">
                <p className="small">
                  {summary.noDarkvision.length === 0
                    ? "Everyone can see in the dark."
                    : `Needs light: ${summary.noDarkvision.join(", ")}.`}
                </p>
                {members
                  .filter((m) => m.defenses.length)
                  .map((m) => (
                    <p key={m.id} className="small">
                      <strong>{m.name}:</strong> {m.defenses.join(", ")}
                    </p>
                  ))}
              </Box>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function names(b: Best, size: number): string {
  if (size > 1 && b.names.length === size) return "everyone";
  return b.names.join(", ");
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat" title={note}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {note && <div className="muted small ellipsis">{note}</div>}
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="box">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

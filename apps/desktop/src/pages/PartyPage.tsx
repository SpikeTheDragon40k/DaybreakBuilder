import { buildSheet, formatModifier, loadCharacterJson, resolveCharacter, type CharacterState, type ContentRegistry } from "@daybreakbuilder/engine";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Portrait } from "../components/Portrait";
import { EncounterCalculator } from "./EncounterCalculator";
import { characters, parties, type CharacterMeta } from "../platform";
import { newId, useApp } from "../state/app";
import { formatGp, memberFromSheet, newParty, summarizeParty, type Best, type Party, type PartyMember } from "../state/party";
import { useUnits } from "../units";

export function PartyPage() {
  const { content, openCharacter, character } = useApp();
  const [list, setList] = useState<Party[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<CharacterMeta[]>([]);
  const [states, setStates] = useState<Record<string, CharacterState>>({});

  useEffect(() => {
    void parties.list().then((l) => {
      setList(l);
      setSelectedId((cur) => cur ?? l[0]?.id ?? null);
    });
  }, []);

  // Saved characters, reloaded when the open one changes so edits show up.
  useEffect(() => {
    void characters.list().then(async (metas) => {
      setRoster(metas);
      const loaded = await Promise.all(metas.map(async (m) => [m.id, await characters.load(m.id)] as const));
      setStates(Object.fromEntries(loaded.filter(([, s]) => s).map(([id, s]) => [id, loadCharacterJson(s)])));
    });
  }, [character]);

  const party = list?.find((p) => p.id === selectedId) ?? null;

  const members = useMemo(() => {
    if (!party || !content) return [];
    const out: PartyMember[] = [];
    for (const id of party.memberIds) {
      const state = states[id];
      if (!state) continue;
      try {
        out.push(memberFromSheet(id, state, buildSheet(resolveCharacter(content.registry, state))));
      } catch (e) {
        console.error(e);
      }
    }
    return out;
  }, [party, states, content]);

  const save = (next: Party) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setList((l) => (l ?? []).map((p) => (p.id === stamped.id ? stamped : p)));
    void parties.save(stamped);
  };

  const create = () => {
    const p = newParty(newId(), `Party ${(list?.length ?? 0) + 1}`);
    setList((l) => [...(l ?? []), p]);
    setSelectedId(p.id);
    void parties.save(p);
  };

  const remove = (p: Party) => {
    if (!confirm(`Delete the party “${p.name}”? The characters are kept.`)) return;
    const rest = (list ?? []).filter((x) => x.id !== p.id);
    setList(rest);
    setSelectedId(rest[0]?.id ?? null);
    void parties.remove(p.id);
  };

  if (list === null) return <p className="muted">Loading…</p>;

  return (
    <div className="party-page">
      <aside className="party-list panel">
        <div className="panel-header">
          <h2>Parties</h2>
          <button className="small primary" onClick={create}>
            New party
          </button>
        </div>
        {list.length === 0 ? (
          <p className="muted small">No parties yet.</p>
        ) : (
          <ul className="plain">
            {list.map((p) => (
              <li key={p.id}>
                <button className={`party-link ${p.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(p.id)}>
                  <span>{p.name || "Unnamed party"}</span>
                  <span className="muted small">{p.memberIds.filter((id) => states[id]).length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {!party ? (
        <div className="callout">
          Create a party to keep your players' characters side by side: armor class, hit points, passive senses, spell DCs, languages and
          an encounter difficulty calculator.
        </div>
      ) : (
        <PartyDetail
          key={party.id}
          party={party}
          members={members}
          roster={roster}
          missing={party.memberIds.filter((id) => !states[id]).length}
          onChange={save}
          onDelete={() => remove(party)}
          onOpen={(id) => states[id] && openCharacter(id, states[id])}
          registry={content?.registry}
        />
      )}
    </div>
  );
}

function PartyDetail({
  party,
  members,
  roster,
  missing,
  onChange,
  onDelete,
  onOpen,
  registry,
}: {
  party: Party;
  members: PartyMember[];
  roster: CharacterMeta[];
  missing: number;
  onChange: (p: Party) => void;
  onDelete: () => void;
  onOpen: (id: string) => void;
  registry: ContentRegistry | undefined;
}) {
  const units = useUnits();
  const [adding, setAdding] = useState("");
  const summary = useMemo(() => summarizeParty(members), [members]);
  const available = roster.filter((c) => !party.memberIds.includes(c.id));

  const add = () => {
    if (!adding) return;
    onChange({ ...party, memberIds: [...party.memberIds, adding] });
    setAdding("");
  };

  return (
    <div className="party-detail">
      <div className="row wrap">
        <input
          className="party-name grow"
          value={party.name}
          aria-label="Party name"
          onChange={(e) => onChange({ ...party, name: e.target.value })}
        />
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
        <button className="ghost danger" onClick={onDelete}>
          Delete party
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

      {members.length === 0 ? (
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
                        <Portrait src={m.portrait} name={m.name} size={36} />
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

      <Box title="DM notes">
        <textarea rows={4} value={party.notes} placeholder="Session notes, hooks, loot to hand out…" onChange={(e) => onChange({ ...party, notes: e.target.value })} />
      </Box>
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

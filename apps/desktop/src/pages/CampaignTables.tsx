import {
  encounterDifficulties,
  generateEncounter,
  generateName,
  generateNpc,
  generateShop,
  generateTavern,
  individualTreasure,
  isTemplate,
  monsterTemplates,
  NAME_SPECIES,
  newNote,
  npcMarkdown,
  rollNoteTable,
  STARTER_TEMPLATES,
  templateForType,
  noteFromTemplate,
  type ContentRegistry,
  type EncounterDifficulty,
  type Note,
  type RulesEdition,
} from "@daybreakbuilder/engine";
import { useMemo, useState, type ReactNode } from "react";
import { newId } from "../state/app";
import type { EncounterLine } from "../state/party";

interface Result {
  id: string;
  title: string;
  lines: string[];
  /** A note to save the result as. */
  note?: () => Note;
  /** Monsters to put in the encounter planner. */
  monsters?: EncounterLine[];
}

const rng = () => Math.random();
const RESULT_LIMIT = 30;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Random tables from the campaign's notes (type "Random table") and built-in
 * generators. Results stay listed until cleared and can be saved as notes.
 */
export function CampaignTables({
  notes,
  levels,
  rules,
  registry,
  onCreate,
  onOpen,
  onPlan,
}: {
  notes: Note[];
  levels: number[];
  rules: RulesEdition;
  registry: ContentRegistry | undefined;
  onCreate: (note: Note) => void;
  onOpen: (note: Note) => void;
  onPlan: (monsters: EncounterLine[]) => void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [species, setSpecies] = useState("");
  const [nameSpecies, setNameSpecies] = useState("Human");
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>(rules === "2014" ? "medium" : "moderate");
  const [cr, setCr] = useState(2);
  const [copied, setCopied] = useState<string | null>(null);
  const tables = notes.filter((n) => n.type === "table" && !isTemplate(n)).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const templates = useMemo(() => (registry ? monsterTemplates(registry) : []), [registry]);
  const difficulties = encounterDifficulties(rules);
  const level = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0;

  const add = (r: Omit<Result, "id">) => setResults((list) => [{ ...r, id: newId() }, ...list].slice(0, RESULT_LIMIT));

  const rollTable = (t: Note) => {
    const r = rollNoteTable(t, notes, rng);
    if (!r) add({ title: t.title, lines: ["This note has no table or list to roll on. Write a Markdown table or a bulleted list in it."] });
    else add({ title: `${t.title} (d${r.die}: ${r.roll})`, lines: [r.text] });
  };

  const newTable = () => {
    const tpl = templateForType("table", notes);
    const starter = STARTER_TEMPLATES.find((t) => t.type === "table")!;
    onCreate(tpl ? noteFromTemplate(tpl, "New table", notes) : newNote("table", "New table", notes, { body: starter.body }));
  };

  const npc = () => {
    const n = generateNpc(rng, species || undefined);
    add({
      title: n.name,
      lines: [`${n.species} ${n.occupation} with ${n.appearance}.`, `Personality: ${n.trait}.`, `Wants ${n.want}.`, `Quirk: ${n.quirk}.`],
      note: () => newNote("npc", n.name, notes, { body: npcMarkdown(n), tags: [n.species.toLowerCase()] }),
    });
  };

  const place = (kind: "tavern" | "shop") => {
    const p = kind === "tavern" ? generateTavern(rng) : generateShop(rng);
    add({ title: p.name, lines: [p.description], note: () => newNote("location", p.name, notes, { body: `**${p.kind}.** ${p.description}\n`, tags: [kind] }) });
  };

  const encounter = () => {
    const e = generateEncounter(templates, levels, rules, difficulty, rng);
    if (!e) {
      add({
        title: "Encounter",
        lines: [levels.length ? "No loaded monster fits this party and difficulty. Load a Monster Manual or another book with creatures in Content." : "Add characters to the party first: the encounter is built for their levels."],
      });
      return;
    }
    add({
      title: `${cap(e.difficulty)} encounter`,
      lines: [...e.monsters.map((m) => `${m.count} × ${m.name} (CR ${m.challenge})`), `${e.xp.toLocaleString()} of ${e.budget.toLocaleString()} XP budget for ${levels.length} character${levels.length === 1 ? "" : "s"}.`],
      monsters: e.monsters.map((m) => ({ id: newId(), name: m.name, cr: m.challenge, xp: 0, count: m.count })),
    });
  };

  const copy = async (r: Result) => {
    try {
      await navigator.clipboard.writeText([r.title, ...r.lines].join("\n"));
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="tables-layout">
      <div className="tables-tools">
        <section className="panel">
          <div className="panel-header">
            <h3>Your tables</h3>
            <button className="small primary" onClick={newTable}>
              New table
            </button>
          </div>
          {tables.length === 0 ? (
            <p className="muted small">
              A random table is a note of type <em>Random table</em> with a Markdown table (a d6, d20 or d100 column and the results) or a
              bulleted list. Dice in results are rolled (“2d6 goblins”) and a result that links another table rolls it too.
            </p>
          ) : (
            <ul className="plain table-list">
              {tables.map((t) => (
                <li key={t.path}>
                  <button className="link" onClick={() => onOpen(t)}>
                    {t.title}
                  </button>
                  <button className="small" onClick={() => rollTable(t)}>
                    Roll
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>Generators</h3>
          <Generator title="NPC" action="Generate" onRun={npc}>
            <select value={species} onChange={(e) => setSpecies(e.target.value)} aria-label="NPC species">
              <option value="">Any species</option>
              {NAME_SPECIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Generator>
          <Generator
            title="Names"
            action="Generate 6"
            onRun={() => add({ title: `${nameSpecies} names`, lines: [Array.from({ length: 6 }, () => generateName(nameSpecies, rng)).join(", ")] })}
          >
            <select value={nameSpecies} onChange={(e) => setNameSpecies(e.target.value)} aria-label="Name species">
              {NAME_SPECIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Generator>
          <Generator title="Tavern" action="Generate" onRun={() => place("tavern")} />
          <Generator title="Shop" action="Generate" onRun={() => place("shop")} />
          <Generator title="Encounter" action="Generate" onRun={encounter} note={levels.length ? `For the party: ${levels.length} character${levels.length === 1 ? "" : "s"}, average level ${level}, from the loaded monsters.` : "Add characters to the party first."}>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as EncounterDifficulty)} aria-label="Encounter difficulty">
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {cap(d)}
                </option>
              ))}
            </select>
          </Generator>
          <Generator
            title="Coins on a foe"
            action="Roll"
            onRun={() => add({ title: `Coins, CR ${cr}`, lines: [individualTreasure(cr, rng)] })}
            note="Individual treasure by challenge rating (2024 Dungeon Master's Guide)."
          >
            <label className="inline-field">
              CR
              <input type="number" min={0} max={30} value={cr} onChange={(e) => setCr(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} aria-label="Challenge rating" />
            </label>
          </Generator>
        </section>
      </div>

      <section className="panel tables-results" aria-live="polite">
        <div className="panel-header">
          <h3>Results</h3>
          {results.length > 0 && (
            <button className="small ghost" onClick={() => setResults([])}>
              Clear
            </button>
          )}
        </div>
        {results.length === 0 ? (
          <p className="muted small">Roll a table or use a generator; results show up here, newest first.</p>
        ) : (
          <ol className="plain roll-results">
            {results.map((r, i) => (
              <li key={r.id} className={i === 0 ? "latest" : ""}>
                <div className="result-title">{r.title}</div>
                {r.lines.map((l, j) => (
                  <p key={j}>{l}</p>
                ))}
                <div className="row wrap result-actions">
                  <button className="small ghost" onClick={() => void copy(r)}>
                    {copied === r.id ? "Copied" : "Copy"}
                  </button>
                  {r.note && (
                    <button className="small ghost" onClick={() => onCreate(r.note!())}>
                      Save as note
                    </button>
                  )}
                  {r.monsters && (
                    <button className="small ghost" onClick={() => onPlan(r.monsters!)}>
                      Put in the encounter planner
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Generator({ title, action, onRun, note, children }: { title: string; action: string; onRun: () => void; note?: string; children?: ReactNode }) {
  return (
    <div className="generator">
      <div className="row nowrap">
        <span className="generator-title">{title}</span>
        <span className="spacer" />
        {children}
        <button className="small" onClick={onRun}>
          {action}
        </button>
      </div>
      {note && <p className="muted small generator-note">{note}</p>}
    </div>
  );
}

import {
  allTags,
  backlinks,
  newNote,
  nextSessionNumber,
  NOTE_TYPE_LABELS,
  plainLinks,
  NOTE_TYPES,
  QUEST_STATUSES,
  resolveNote,
  searchNotes,
  type ContentRegistry,
  type ElementDef,
  type Note,
  type QuestStatus,
  type SearchHit,
} from "@daybreakbuilder/engine";
import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ElementDetail } from "../components/ElementDetail";
import { expandDescription } from "../components/Html";
import { MarkdownEditor, type LinkKind, type LinkSuggestion } from "../components/MarkdownEditor";
import { Portrait } from "../components/Portrait";
import { isTauri, parties, settings } from "../platform";
import { DEFAULT_TOKEN_COLOR } from "../portraits";
import { newId, useApp } from "../state/app";
import { campaignParty, getCampaignStore, moveOldParties, withParty, type CampaignRef, type CampaignStore } from "../state/campaign";
import type { PartyMember } from "../state/party";
import { useCampaign, type OpenCampaign } from "../state/useCampaign";
import { useUnits } from "../units";
import { CampaignParty, usePartyMembers } from "./CampaignParty";

type Tab = "notes" | "sessions" | "quests" | "party";

const OPEN_KEY = "openCampaign";

export function CampaignsPage() {
  const [store, setStore] = useState<CampaignStore | null>(null);
  const [list, setList] = useState<CampaignRef[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => settings.get<string | null>(OPEN_KEY, null));
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = await getCampaignStore(newId);
        await moveOldParties(s, () => parties.list());
        const l = await s.list();
        setStore(s);
        setList(l);
        setSelectedId((cur) => (cur && l.some((c) => c.id === cur) ? cur : (l[0]?.id ?? null)));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => settings.set(OPEN_KEY, selectedId), [selectedId]);

  const refresh = async (select?: string | null) => {
    if (!store) return;
    const l = await store.list();
    setList(l);
    if (select !== undefined) setSelectedId(select);
  };

  const create = async () => {
    if (!store) return;
    setError(null);
    try {
      const ref = await store.create(newName.trim() || `Campaign ${(list?.length ?? 0) + 1}`);
      setNewName("");
      await refresh(ref.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openFolder = async () => {
    if (!store?.openFolder) return;
    setError(null);
    try {
      const ref = await store.openFolder();
      if (ref) await refresh(ref.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const forget = async (ref: CampaignRef) => {
    if (!store) return;
    const question =
      store.kind === "disk"
        ? `Remove “${ref.name}” from the list? The folder and its notes stay on disk; open it again with “Open folder…”.`
        : `Delete the campaign “${ref.name}” and all its notes? This can't be undone.`;
    if (!confirm(question)) return;
    await store.forget(ref);
    const rest = (list ?? []).filter((c) => c.id !== ref.id);
    await refresh(rest[0]?.id ?? null);
  };

  if (error && !store) return <div className="callout error">{error}</div>;
  if (!store || !list) return <p className="muted">Loading…</p>;
  const selected = list.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="campaigns-page">
      <aside className="party-list panel">
        <div className="panel-header">
          <h2>Campaigns</h2>
        </div>
        {list.length === 0 ? (
          <p className="muted small">No campaigns yet.</p>
        ) : (
          <ul className="plain">
            {list.map((c) => (
              <li key={c.id}>
                <button className={`party-link ${c.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(c.id)} title={store.kind === "disk" ? c.id : undefined}>
                  <span>{c.name || "Unnamed campaign"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="new-campaign"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Campaign name" aria-label="New campaign name" />
          <button className="primary small" type="submit">
            New campaign
          </button>
        </form>
        {store.openFolder && (
          <button className="small" onClick={() => void openFolder()} title="Use an existing folder of Markdown notes, such as an Obsidian vault">
            Open folder…
          </button>
        )}
        {error && <p className="error-text small">{error}</p>}
      </aside>

      {selected ? (
        <CampaignWorkspace key={selected.id} store={store} campaign={selected} onForget={() => void forget(selected)} onRenamed={() => void refresh()} />
      ) : (
        <div className="callout">
          A campaign keeps the party, linked notes, a session log and quests together.
          {store.kind === "disk"
            ? " Each campaign is a folder of Markdown files, so you can also open it in Obsidian or keep it in a synced folder."
            : " In the browser, campaigns are kept in this browser's storage; the desktop app keeps them as Markdown files."}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Target = { kind: "note"; note: Note } | { kind: "character"; member: PartyMember } | { kind: "compendium"; element: ElementDef } | { kind: "missing" };

/** Element types tried first when a link name matches several elements. */
const TYPE_ORDER = ["Spell", "Companion", "Magic Item", "Item", "Weapon", "Armor", "Feat", "Race", "Sub Race", "Class", "Archetype", "Background", "Condition", "Information"];

function compendiumIndex(registry: ContentRegistry | undefined): Map<string, ElementDef> {
  const out = new Map<string, ElementDef>();
  if (!registry) return out;
  const rank = (el: ElementDef) => {
    const i = TYPE_ORDER.indexOf(el.type);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  for (const el of registry.all()) {
    if (!el.name || el.type === "Grants" || el.type === "Source" || el.type === "Ability Score Improvement") continue;
    const key = el.name.toLowerCase();
    const cur = out.get(key);
    if (!cur || rank(el) < rank(cur)) out.set(key, el);
  }
  return out;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const tabFor = (type: string): Tab => (type === "session" ? "sessions" : type === "quest" ? "quests" : "notes");
const typeLabel = (type: string) => NOTE_TYPE_LABELS[type as keyof typeof NOTE_TYPE_LABELS] ?? type;

function CampaignWorkspace({ store, campaign, onForget, onRenamed }: { store: CampaignStore; campaign: CampaignRef; onForget: () => void; onRenamed: () => void }) {
  const { content, openCharacter } = useApp();
  const registry = content?.registry;
  const units = useUnits();
  const { open, error } = useCampaign(store, campaign);
  const party = useMemo(() => (open ? campaignParty(campaign.id, open.meta) : null), [open?.meta, campaign.id]);
  const { members, states } = usePartyMembers(party);
  const [tab, setTab] = useState<Tab>("notes");
  const [selected, setSelected] = useState<Record<Tab, string | null>>({ notes: null, sessions: null, quests: null, party: null });
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [popup, setPopup] = useState<Target | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const index = useMemo(() => compendiumIndex(registry), [registry]);

  if (!open) return error ? <div className="callout error">Couldn't open the campaign: {error}</div> : <p className="muted">Loading campaign…</p>;
  const notes = open.notes;

  const resolve = (target: string): Target => {
    const note = resolveNote(target, notes);
    if (note) return { kind: "note", note };
    const t = target.trim().toLowerCase();
    const member = members.find((m) => m.name.toLowerCase() === t);
    if (member) return { kind: "character", member };
    const element = index.get(t);
    if (element) return { kind: "compendium", element };
    return { kind: "missing" };
  };

  const show = (note: Note, inTab?: Tab) => {
    const where = inTab ?? (tab === "notes" ? "notes" : tabFor(note.type));
    setTab(where);
    setSelected((s) => ({ ...s, [where]: note.path }));
  };

  const create = async (note: Note, inTab?: Tab) => {
    await open.createNote(note);
    setJustCreated(note.path);
    show(note, inTab);
  };

  const openLink = (target: string) => {
    const r = resolve(target);
    if (r.kind === "note") show(r.note);
    else if (r.kind === "missing") void create(newNote("general", target, notes), tab === "party" ? "notes" : undefined);
    else setPopup(r);
  };

  const hoverCard = (target: string): HTMLElement | null => {
    const r = resolve(target);
    const el = document.createElement("div");
    el.className = "link-card";
    const head = (title: string, sub: string) => {
      const h = document.createElement("div");
      h.className = "link-card-title";
      h.textContent = title;
      const s = document.createElement("div");
      s.className = "muted small";
      s.textContent = sub;
      el.append(h, s);
    };
    if (r.kind === "note") {
      head(r.note.title, [typeLabel(r.note.type), ...r.note.tags.map((t) => `#${t}`)].join(" · "));
      const p = document.createElement("p");
      const text = r.note.body.replace(/[#>*_`~]|\[\[|\]\]/g, "").trim();
      p.textContent = text ? text.slice(0, 280) + (text.length > 280 ? "…" : "") : "Empty note.";
      el.append(p);
    } else if (r.kind === "character") {
      head(r.member.name, `${r.member.summary} · level ${r.member.level}`);
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = `AC ${r.member.armorClass} · HP ${r.member.maxHp} · Passive Perception ${r.member.passivePerception}`;
      el.append(p);
    } else if (r.kind === "compendium") {
      head(r.element.name, [r.element.type, r.element.source].filter(Boolean).join(" · "));
      const body = document.createElement("div");
      body.className = "html link-card-body";
      body.innerHTML = DOMPurify.sanitize(units.text(expandDescription(r.element.description, registry)), { FORBID_TAGS: ["style", "script", "iframe", "form", "img"], FORBID_ATTR: ["style"] });
      el.append(body);
    } else {
      head(target, "No note yet");
      const p = document.createElement("p");
      p.className = "small muted";
      p.textContent = "Click to create it.";
      el.append(p);
    }
    return el;
  };

  const suggest = (query: string): LinkSuggestion[] => {
    const q = query.trim().toLowerCase();
    const score = (name: string) => {
      const n = name.toLowerCase();
      if (!q) return 1;
      if (n.startsWith(q)) return 2;
      return n.includes(q) ? 1 : 0;
    };
    const out: (LinkSuggestion & { s: number; order: number })[] = [];
    for (const n of notes) {
      const s = score(n.title);
      if (s) out.push({ label: n.title, detail: typeLabel(n.type), kind: "note", s, order: 0 });
    }
    for (const m of members) {
      const s = score(m.name);
      if (s && !out.some((o) => o.label.toLowerCase() === m.name.toLowerCase())) out.push({ label: m.name, detail: "Character", kind: "character", s, order: 1 });
    }
    if (q.length >= 2) {
      let found = 0;
      for (const el of index.values()) {
        const s = score(el.name);
        if (s && !out.some((o) => o.label.toLowerCase() === el.name.toLowerCase())) {
          out.push({ label: el.name, detail: el.type, kind: "compendium", s, order: 2 });
          if (++found > 200) break;
        }
      }
    }
    return out
      .sort((a, b) => b.s - a.s || a.order - b.order || a.label.localeCompare(b.label))
      .slice(0, 40)
      .map(({ label, detail, kind }) => ({ label, detail, kind }));
  };

  const linkKind = (target: string): LinkKind => resolve(target).kind;
  const linkVersion = `${notes.map((n) => n.title).join("\u0000")}|${members.map((m) => m.name).join("\u0000")}|${index.size}`;
  const editorLinks = { linkKind, onOpenLink: openLink, hoverCard, suggest, linkVersion };

  const current = notes.find((n) => n.path === selected[tab]) ?? null;

  const newSession = () =>
    void create(
      newNote("session", `Session ${nextSessionNumber(notes)}`, notes, {
        session: { number: nextSessionNumber(notes), date: today(), present: members.map((m) => m.name) },
      }),
      "sessions",
    );

  const editor = current ? (
    <NoteEditor
      key={current.path}
      campaign={open}
      note={current}
      notes={notes}
      members={members}
      selectTitle={justCreated === current.path}
      onRenamed={(n, changed) => {
        setSelected((s) => ({ ...s, [tab]: n.path }));
        setMessage(changed ? `Renamed. Updated links in ${changed} note${changed > 1 ? "s" : ""}.` : null);
      }}
      onDeleted={() => setSelected((s) => ({ ...s, [tab]: null }))}
      onShow={show}
      links={editorLinks}
    />
  ) : null;

  return (
    <div className="campaign">
      <div className="row wrap campaign-header">
        <input
          className="party-name grow"
          value={open.meta.name}
          aria-label="Campaign name"
          onChange={(e) => open.updateMeta((m) => ({ ...m, name: e.target.value }))}
          onBlur={onRenamed}
        />
        <span className="muted small save-state" role="status">
          {open.saving ? "Saving…" : "Saved"}
        </span>
        {store.reveal && (
          <button className="small" onClick={() => void store.reveal?.(campaign)} title={campaign.id}>
            Show folder
          </button>
        )}
        <button className="small ghost danger" onClick={onForget}>
          {store.kind === "disk" ? "Remove from list" : "Delete campaign"}
        </button>
      </div>
      {open.error && <div className="callout error">{open.error}</div>}
      {message && (
        <p className="ok-text small" role="status">
          {message}
        </p>
      )}

      <nav className="subtabs campaign-tabs" aria-label="Campaign">
        {(
          [
            ["notes", `Notes (${notes.length})`],
            ["sessions", `Sessions (${notes.filter((n) => n.type === "session").length})`],
            ["quests", `Quests (${notes.filter((n) => n.type === "quest" && n.status === "open").length} open)`],
            ["party", `Party (${open.meta.party.memberIds.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={`subtab ${tab === t ? "active" : ""}`} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "party" && party ? (
        <CampaignParty party={party} onChange={(p) => open.updateMeta((m) => withParty(m, p))} />
      ) : (
        <div className="notes-layout">
          <aside className="panel notes-sidebar">
            {tab === "notes" && <NotesList notes={notes} selected={selected.notes} onSelect={(n) => show(n, "notes")} onNew={(type) => void create(newNote(type, type === "general" ? "Untitled" : `New ${typeLabel(type)}`, notes), "notes")} />}
            {tab === "sessions" && <SessionsList notes={notes} selected={selected.sessions} onSelect={(n) => show(n, "sessions")} onNew={newSession} />}
            {tab === "quests" && <QuestsList notes={notes} selected={selected.quests} onSelect={(n) => show(n, "quests")} onNew={() => void create(newNote("quest", "New quest", notes), "quests")} />}
          </aside>
          <section className="notes-main">
            {editor ?? (
              <div className="callout">
                {tab === "sessions"
                  ? "Log each session: date, in-game date, who played, XP and loot, with the recap as the note."
                  : tab === "quests"
                    ? "Track quests as open, done or failed. Link the NPC who gave the quest and the places it leads to with [[links]]."
                    : "Write notes in Markdown. Type [[ to link another note, a party character, or anything in the compendium: [[Fireball]] shows the spell when you hover it."}
              </div>
            )}
          </section>
        </div>
      )}

      {popup && popup.kind === "compendium" && registry && (
        <Modal title={popup.element.name} onClose={() => setPopup(null)}>
          <ElementDetail element={popup.element} registry={registry} />
        </Modal>
      )}
      {popup && popup.kind === "character" && (
        <Modal title={popup.member.name} onClose={() => setPopup(null)}>
          <div className="row character-popup">
            <Portrait src={popup.member.portrait} name={popup.member.name} size={96} ring={popup.member.tokenColor ?? DEFAULT_TOKEN_COLOR} />
            <div>
              <p>
                {popup.member.summary} · level {popup.member.level}
                {popup.member.playerName && ` · played by ${popup.member.playerName}`}
              </p>
              <p className="small">
                AC {popup.member.armorClass} · HP {popup.member.maxHp} · Passive Perception {popup.member.passivePerception}
              </p>
              <button
                className="primary"
                onClick={() => {
                  const s = states[popup.member.id];
                  if (s) openCharacter(popup.member.id, s);
                }}
              >
                Open character
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lists

function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(text.slice(at, a));
    out.push(<mark key={i}>{text.slice(a, b)}</mark>);
    at = b;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

function NotesList({ notes, selected, onSelect, onNew }: { notes: Note[]; selected: string | null; onSelect: (n: Note) => void; onNew: (type: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [newType, setNewType] = useState("general");
  const tags = useMemo(() => allTags(notes), [notes]);
  const hits: SearchHit[] = useMemo(() => searchNotes(notes, query, { type: type || undefined, tag: tag || undefined }), [notes, query, type, tag]);
  const types = [...new Set([...NOTE_TYPES, ...notes.map((n) => n.type)])];

  return (
    <>
      <div className="row nowrap">
        <select value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Type of the new note">
          {NOTE_TYPES.filter((t) => t !== "session" && t !== "quest").map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <button className="primary small grow" onClick={() => onNew(newType)}>
          New note
        </button>
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" aria-label="Search notes" className="notes-search" />
      <div className="row nowrap">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type" className="grow">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className="grow">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
      </div>
      {hits.length === 0 ? (
        <p className="muted small">{notes.length ? "No notes match." : "No notes yet."}</p>
      ) : (
        <ul className="plain note-list" aria-label="Notes">
          {hits.map((h) => (
            <li key={h.note.path}>
              <button className={`note-link ${h.note.path === selected ? "active" : ""}`} onClick={() => onSelect(h.note)}>
                <span className="note-link-title">
                  <span>
                    <Highlight text={h.note.title} ranges={h.titleRanges} />
                  </span>
                  <span className="note-type">{typeLabel(h.note.type)}</span>
                </span>
                {h.snippets.map((s, i) => (
                  <span key={i} className="note-snippet muted small">
                    <Highlight text={s.text} ranges={s.ranges} />
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SessionsList({ notes, selected, onSelect, onNew }: { notes: Note[]; selected: string | null; onSelect: (n: Note) => void; onNew: () => void }) {
  const sessions = notes
    .filter((n) => n.type === "session")
    .sort((a, b) => (b.session.number ?? 0) - (a.session.number ?? 0) || (b.session.date ?? "").localeCompare(a.session.date ?? "") || b.title.localeCompare(a.title, undefined, { numeric: true }));
  const xp = sessions.reduce((n, s) => n + (s.session.xp ?? 0), 0);
  return (
    <>
      <button className="primary small" onClick={onNew}>
        New session
      </button>
      {xp > 0 && <p className="muted small">{xp.toLocaleString()} XP awarded in total.</p>}
      {sessions.length === 0 ? (
        <p className="muted small">No sessions logged yet.</p>
      ) : (
        <ul className="plain note-list" aria-label="Sessions">
          {sessions.map((s) => (
            <li key={s.path}>
              <button className={`note-link ${s.path === selected ? "active" : ""}`} onClick={() => onSelect(s)}>
                <span className="note-link-title">{s.title}</span>
                <span className="muted small">{[s.session.date, s.session.inGameDate, s.session.xp ? `${s.session.xp} XP` : ""].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const STATUS_LABELS: Record<QuestStatus, string> = { open: "Open", done: "Done", failed: "Failed" };

function QuestsList({ notes, selected, onSelect, onNew }: { notes: Note[]; selected: string | null; onSelect: (n: Note) => void; onNew: () => void }) {
  const quests = notes.filter((n) => n.type === "quest");
  return (
    <>
      <button className="primary small" onClick={onNew}>
        New quest
      </button>
      {quests.length === 0 && <p className="muted small">No quests yet.</p>}
      {QUEST_STATUSES.map((status) => {
        const group = quests.filter((q) => q.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className={`quest-group quest-${status}`}>
            <h3>
              {STATUS_LABELS[status]} <span className="muted small">{group.length}</span>
            </h3>
            <ul className="plain note-list" aria-label={`${STATUS_LABELS[status]} quests`}>
              {group.map((q) => (
                <li key={q.path}>
                  <button className={`note-link ${q.path === selected ? "active" : ""}`} onClick={() => onSelect(q)}>
                    <span className="note-link-title">{q.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// One note

interface EditorLinks {
  linkKind: (target: string) => LinkKind;
  onOpenLink: (target: string) => void;
  hoverCard: (target: string) => HTMLElement | null;
  suggest: (query: string) => LinkSuggestion[];
  linkVersion: unknown;
}

function NoteEditor({
  campaign,
  note,
  notes,
  members,
  selectTitle,
  onRenamed,
  onDeleted,
  onShow,
  links,
}: {
  campaign: OpenCampaign;
  note: Note;
  notes: Note[];
  members: PartyMember[];
  selectTitle: boolean;
  onRenamed: (n: Note, changed: number) => void;
  onDeleted: () => void;
  onShow: (n: Note) => void;
  links: EditorLinks;
}) {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags.join(", "));
  const titleRef = useRef<HTMLInputElement>(null);
  const update = (fn: (n: Note) => Note) => campaign.updateNote(note.path, fn);
  const linked = useMemo(() => backlinks(notes, note), [notes, note]);

  useEffect(() => setTitle(note.title), [note.title]);
  useEffect(() => setTags(note.tags.join(", ")), [note.tags]);
  useEffect(() => {
    if (selectTitle) titleRef.current?.select();
  }, [selectTitle]);

  const commitTitle = async () => {
    const t = title.trim();
    if (!t || t === note.title) {
      setTitle(note.title);
      return;
    }
    const r = await campaign.renameNote(note.path, t);
    if (r) {
      setTitle(r.note.title);
      onRenamed(r.note, r.changed);
    } else setTitle(note.title);
  };

  const commitTags = () => {
    const list = [...new Set(tags.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean))];
    if (list.join(",") !== note.tags.join(",")) update((n) => ({ ...n, tags: list }));
    setTags(list.join(", "));
  };

  const remove = async () => {
    if (!confirm(`Delete “${note.title}”?${isTauri ? " It goes to the campaign's .trash folder, where you can still recover it." : ""}`)) return;
    await campaign.deleteNote(note.path);
    onDeleted();
  };

  const types = [...new Set([...NOTE_TYPES, note.type])];
  const s = note.session;
  const setSession = (patch: Partial<Note["session"]>) => update((n) => ({ ...n, session: { ...n.session, ...patch } }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const presentNames = [...new Set([...members.map((m) => m.name), ...s.present])];

  return (
    <article className="panel note-editor">
      <div className="row wrap note-head">
        <input
          ref={titleRef}
          className="note-title grow"
          value={title}
          aria-label="Note title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setTitle(note.title);
          }}
        />
        <select value={note.type} onChange={(e) => update((n) => ({ ...n, type: e.target.value }))} aria-label="Note type">
          {types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <button className="small ghost danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>
      <div className="note-props">
        <label>
          Tags
          <input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={commitTags} placeholder="Separate with commas" aria-label="Tags" />
        </label>
        {note.type === "quest" && (
          <div className="theme-switch" role="group" aria-label="Quest status">
            {QUEST_STATUSES.map((st) => (
              <button key={st} aria-pressed={note.status === st} onClick={() => update((n) => ({ ...n, status: st }))}>
                {STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        )}
        {note.type === "session" && (
          <>
            <label className="narrow">
              Session
              <input type="number" min={0} value={s.number ?? ""} onChange={(e) => setSession({ number: num(e.target.value) })} />
            </label>
            <label>
              Date
              <input type="date" value={s.date ?? ""} onChange={(e) => setSession({ date: e.target.value || undefined })} />
            </label>
            <label>
              In-game date
              <input value={s.inGameDate ?? ""} onChange={(e) => setSession({ inGameDate: e.target.value || undefined })} placeholder="15 Mirtul 1492" />
            </label>
            <label className="narrow">
              XP
              <input type="number" min={0} value={s.xp ?? ""} onChange={(e) => setSession({ xp: num(e.target.value) })} />
            </label>
            <label className="wide">
              Loot
              <input value={s.loot ?? ""} onChange={(e) => setSession({ loot: e.target.value || undefined })} placeholder="120 gp, Potion of Healing" />
            </label>
            {presentNames.length > 0 && (
              <div className="wide">
                <span className="prop-label">Present</span>
                <ul className="chips">
                  {presentNames.map((name) => {
                    const on = s.present.includes(name);
                    return (
                      <li key={name}>
                        <button
                          className={`chip ${on ? "on" : ""}`}
                          aria-pressed={on}
                          onClick={() => setSession({ present: on ? s.present.filter((x) => x !== name) : [...s.present, name] })}
                        >
                          {name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <MarkdownEditor
        value={note.body}
        onChange={(body) => update((n) => ({ ...n, body }))}
        placeholder={note.type === "session" ? "What happened this session…" : "Write here. Type [[ to link a note, a character or a compendium entry."}
        ariaLabel={`Text of ${note.title}`}
        {...links}
      />

      <section className="backlinks">
        <h3>
          Linked from <span className="muted small">{linked.length}</span>
        </h3>
        {linked.length === 0 ? (
          <p className="muted small">No other note links here yet.</p>
        ) : (
          <ul className="plain">
            {linked.map((b) => (
              <li key={b.note.path}>
                <button className="link" onClick={() => onShow(b.note)}>
                  {b.note.title}
                </button>
                {b.lines.slice(0, 2).map((l, i) => (
                  <span key={i} className="muted small block backlink-line">
                    {plainLinks(l)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

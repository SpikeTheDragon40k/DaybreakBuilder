import { importAuroraCharacter, loadCharacterJson, newCharacter } from "@dndbuilder/engine";
import { useEffect, useState } from "react";
import { Portrait } from "../components/Portrait";
import { characters, getPlatform, type CharacterMeta } from "../platform";
import { newId, useApp } from "../state/app";

export function CharactersPage() {
  const { openCharacter, content, character } = useApp();
  const [list, setList] = useState<CharacterMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => characters.list().then(setList);
  useEffect(() => {
    void refresh();
  }, [character]);

  const open = async (id: string) => {
    const state = await characters.load(id);
    if (state) openCharacter(id, loadCharacterJson(state));
  };

  const importFile = async () => {
    setError(null);
    try {
      const platform = await getPlatform();
      const [file] = await platform.pickTextFiles(["dnd5e", "json"], false);
      if (!file) return;
      if (file.name.endsWith(".json")) {
        openCharacter(newId(), loadCharacterJson(JSON.parse(file.content)));
      } else {
        if (!content) throw new Error("Content is still loading.");
        const { state, warnings } = importAuroraCharacter(file.content, content.registry);
        if (warnings.length) setError(`Imported with warnings: ${warnings.slice(0, 5).join("; ")}`);
        openCharacter(newId(), state);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const noContent = content && !content.registry.ofType("Race").length;

  return (
    <div className="characters-page">
      <div className="row">
        <h1 className="grow">Characters</h1>
        <button onClick={importFile}>Import…</button>
        <button className="primary" onClick={() => openCharacter(newId(), newCharacter())}>
          New character
        </button>
      </div>
      {noContent && (
        <div className="callout">
          No races or classes are loaded yet. Open <strong>Content</strong> to download a content index (for example the community
          Aurora Legacy index) or import XML files.
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No characters yet.</p>
      ) : (
        <ul className="character-cards">
          {list.map((c) => (
            <li key={c.id}>
              <button className="card" onClick={() => open(c.id)}>
                <Portrait src={c.portrait ?? ""} name={c.name} size={56} />
                <span className="card-text">
                  <span className="card-title">{c.name || "Unnamed"}</span>
                  <span className="muted">{c.summary || "—"}</span>
                  <span className="muted small">Edited {new Date(c.updatedAt).toLocaleString()}</span>
                </span>
              </button>
              <div className="card-actions">
                <button
                  className="small ghost"
                  onClick={async () => {
                    const state = await characters.load(c.id);
                    if (!state) return;
                    const platform = await getPlatform();
                    await platform.saveTextFile(`${c.name || "character"}.json`, JSON.stringify(state, null, 2), "json");
                  }}
                >
                  Export
                </button>
                <button
                  className="small ghost"
                  onClick={async () => {
                    const state = await characters.load(c.id);
                    if (!state) return;
                    const copy = { ...state, name: `${state.name} (copy)` };
                    await characters.save({ ...c, id: newId(), name: copy.name, updatedAt: new Date().toISOString() }, copy);
                    void refresh();
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="small ghost danger"
                  onClick={async () => {
                    if (!confirm(`Delete ${c.name}?`)) return;
                    await characters.remove(c.id);
                    void refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { AURORA_LEGACY_2024_INDEX, AURORA_LEGACY_INDEX } from "@dndbuilder/engine";
import { useMemo, useState } from "react";
import { getPlatform, isTauri, packs, settings } from "../platform";
import { useApp } from "../state/app";
import { importLocalFiles, installIndex } from "../state/content";

const PRESETS = [
  {
    label: "Aurora Legacy: 2024 rules",
    url: AURORA_LEGACY_2024_INDEX,
    detail: "Only the 2024 (5.5e) books: Player’s Handbook 2024, Dungeon Master’s Guide 2024, Monster Manual 2025",
  },
  { label: "Aurora Legacy: everything", url: AURORA_LEGACY_INDEX, detail: "Every book, 2014 and 2024 rules" },
];

export function ContentPage() {
  const { content, reloadContent, character, update } = useApp();
  const [url, setUrl] = useState(AURORA_LEGACY_2024_INDEX);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setMessage(null);
    setProgress(null);
    try {
      const msg = await fn();
      await reloadContent();
      if (msg) setMessage({ kind: "ok", text: msg });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const install = (indexUrl: string) =>
    run(`Downloading ${indexUrl}`, async () => {
      const { meta, errors } = await installIndex(indexUrl, (done, total) => setProgress({ done, total }));
      return `Installed “${meta.name}”: ${meta.fileCount} files${errors.length ? `, ${errors.length} failed` : ""}.`;
    });

  const importFiles = () =>
    run("Importing files", async () => {
      const platform = await getPlatform();
      const files = await platform.pickTextFiles(["xml"], true);
      if (!files.length) return;
      const meta = await importLocalFiles(files.length === 1 ? files[0].name : `Imported files (${files.length})`, files.map((f) => ({ path: f.name, content: f.content })));
      return `Imported ${meta.fileCount} file(s).`;
    });

  const sourceElements = useMemo(() => {
    if (!content) return [];
    return content.registry.ofType("Source").filter((s) => s.name);
  }, [content]);

  const warningSummary = useMemo(() => {
    if (!content) return [];
    return content.warnings.filter((w) => !w.message.startsWith("duplicate id")).slice(0, 200);
  }, [content]);

  if (!content) return <p className="muted">Loading content…</p>;

  return (
    <div className="content-page">
      <section className="panel">
        <header className="panel-header">
          <h2>Installed content</h2>
          <span className="muted small">{content.registry.size.toLocaleString()} elements</span>
        </header>
        <table className="sources">
          <thead>
            <tr>
              <th>Enabled</th>
              <th>Name</th>
              <th>Files</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {content.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={(s.kind !== "pack" && s.id !== "bundled:srd") || !!busy}
                    aria-label={`Enable ${s.name}`}
                    onChange={(e) => {
                      const on = e.target.checked;
                      if (s.id === "bundled:srd") void run("Updating", async () => settings.set("srdEnabled", on));
                      else if (s.meta) void run("Updating", async () => void (await packs.update({ ...s.meta!, enabled: on })));
                    }}
                  />
                </td>
                <td>
                  {s.name}
                  {s.meta?.indexUrl && <div className="muted small ellipsis">{s.meta.indexUrl}</div>}
                  {s.kind === "custom" && content.customFolder && <div className="muted small ellipsis">{content.customFolder}</div>}
                </td>
                <td>{s.fileCount}</td>
                <td className="small">{s.meta ? new Date(s.meta.updatedAt).toLocaleDateString() : "—"}</td>
                <td className="actions">
                  {s.meta?.indexUrl && (
                    <button className="small" disabled={!!busy} onClick={() => install(s.meta!.indexUrl!)}>
                      Update
                    </button>
                  )}
                  {s.kind === "pack" && (
                    <button
                      className="small ghost"
                      disabled={!!busy}
                      onClick={() => confirm(`Remove “${s.name}”?`) && run("Removing", async () => void (await packs.remove(s.id)))}
                    >
                      Remove
                    </button>
                  )}
                  {s.kind === "custom" && (
                    <>
                      <button className="small" onClick={() => run("Rescanning", async () => "Custom folder rescanned.")}>
                        Rescan
                      </button>
                      <button className="small ghost" onClick={async () => (await getPlatform()).openCustomFolder?.()}>
                        Open folder
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Add content</h2>
        </header>
        <p className="small muted">
          Content uses the Aurora Builder XML format. Paste the URL of an <code>.index</code> file to download it and everything it
          references, or pick one of the community-maintained Aurora Legacy indexes. Only install content you own or that is
          licensed for use.
        </p>
        <div className="row" role="group" aria-label="Aurora Legacy indexes">
          {PRESETS.map((p) => (
            <button key={p.url} className="small" aria-pressed={url === p.url} title={p.detail} onClick={() => setUrl(p.url)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="row">
          <input className="grow" type="url" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Index URL" />
          <button className="primary" disabled={!!busy || !url.trim()} onClick={() => install(url.trim())}>
            Download
          </button>
        </div>
        <div className="row">
          <button disabled={!!busy} onClick={importFiles}>
            Import XML files…
          </button>
          {!isTauri && <span className="muted small">In the desktop app you can also drop files into a custom content folder.</span>}
        </div>
        {busy && (
          <div className="progress">
            <span>{busy}…</span>
            {progress && (
              <>
                <progress max={progress.total} value={progress.done} />
                <span className="small">
                  {progress.done}/{progress.total}
                </span>
              </>
            )}
          </div>
        )}
        {message && <p className={message.kind === "error" ? "error-text" : "ok-text"}>{message.text}</p>}
      </section>

      {character && sourceElements.length > 0 && (
        <section className="panel">
          <header className="panel-header">
            <h2>Sources for this character</h2>
          </header>
          <p className="small muted">Unchecked sources are hidden from choices for {character.state.name}.</p>
          <div className="source-grid">
            {sourceElements.map((src) => (
              <label key={src.id} className="check">
                <input
                  type="checkbox"
                  checked={!character.state.excludedSources.includes(src.name)}
                  onChange={(e) =>
                    update((d) => {
                      d.excludedSources = e.target.checked
                        ? d.excludedSources.filter((x) => x !== src.name)
                        : [...d.excludedSources, src.name];
                    })
                  }
                />
                {src.name}
              </label>
            ))}
          </div>
        </section>
      )}

      {warningSummary.length > 0 && (
        <section className="panel">
          <header className="panel-header">
            <h2>Content warnings</h2>
            <button className="small ghost" onClick={() => setShowWarnings((v) => !v)}>
              {showWarnings ? "Hide" : `Show ${warningSummary.length}`}
            </button>
          </header>
          {showWarnings && (
            <ul className="small warnings-list">
              {warningSummary.map((w, i) => (
                <li key={i}>
                  {w.file && <span className="muted">{w.file}: </span>}
                  {w.element && <code>{w.element}</code>} {w.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

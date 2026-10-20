import { useApp, type Page } from "./state/app";
import { BuildPage } from "./pages/BuildPage";
import { CharactersPage } from "./pages/CharactersPage";
import { CompendiumPage } from "./pages/CompendiumPage";
import { ContentPage } from "./pages/ContentPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { SheetPage } from "./pages/SheetPage";

const TABS: { page: Page; label: string; needsCharacter: boolean }[] = [
  { page: "characters", label: "Characters", needsCharacter: false },
  { page: "build", label: "Build", needsCharacter: true },
  { page: "equipment", label: "Equipment", needsCharacter: true },
  { page: "sheet", label: "Sheet", needsCharacter: true },
  { page: "compendium", label: "Compendium", needsCharacter: false },
  { page: "content", label: "Content", needsCharacter: false },
];

export function App() {
  const { page, setPage, character, resolved, content, contentError, saving, closeCharacter } = useApp();
  const ready = !!(character && resolved && content);
  const current = TABS.find((t) => t.page === page)?.needsCharacter && !ready ? "characters" : page;

  return (
    <div className="app">
      <nav className="topbar no-print">
        <span className="brand">dndbuilder</span>
        {TABS.map((t) => (
          <button
            key={t.page}
            className={`tab ${current === t.page ? "active" : ""}`}
            disabled={t.needsCharacter && !ready}
            onClick={() => setPage(t.page)}
          >
            {t.label}
          </button>
        ))}
        <span className="spacer" />
        {character && (
          <span className="muted small">
            {character.state.name} · {saving ? "saving…" : "saved"}
            <button className="ghost small" onClick={closeCharacter}>
              Close
            </button>
          </span>
        )}
      </nav>
      <main className="main">
        {contentError && <div className="callout error">Failed to load content: {contentError}</div>}
        {!content && !contentError && <p className="muted">Loading content…</p>}
        {current === "characters" && <CharactersPage />}
        {current === "build" && ready && <BuildPage />}
        {current === "equipment" && ready && <EquipmentPage />}
        {current === "sheet" && ready && <SheetPage />}
        {current === "compendium" && <CompendiumPage />}
        {current === "content" && <ContentPage />}
      </main>
    </div>
  );
}

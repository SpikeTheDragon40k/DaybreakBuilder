import { useState } from "react";
import { HistoryControls } from "./components/HistoryControls";
import { useApp, type Page } from "./state/app";
import { setTheme, storedTheme, type Theme } from "./theme";
import { setUnits, useUnits } from "./units";
import { BuildPage } from "./pages/BuildPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CharactersPage } from "./pages/CharactersPage";
import { CompendiumPage } from "./pages/CompendiumPage";
import { ContentPage } from "./pages/ContentPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { PlayPage } from "./pages/PlayPage";
import { SheetPage } from "./pages/SheetPage";
import { SpellsPage } from "./pages/SpellsPage";

const TABS: { page: Page; label: string; needsCharacter: boolean }[] = [
  { page: "characters", label: "Characters", needsCharacter: false },
  { page: "build", label: "Build", needsCharacter: true },
  { page: "equipment", label: "Equipment", needsCharacter: true },
  { page: "spells", label: "Spells", needsCharacter: true },
  { page: "sheet", label: "Sheet", needsCharacter: true },
  { page: "play", label: "Play", needsCharacter: true },
  { page: "campaigns", label: "Campaigns", needsCharacter: false },
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
        <span className="brand">DaybreakBuilder</span>
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
        {ready && <HistoryControls />}
        <UnitSwitch />
        <ThemeSwitch />
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
        {current === "spells" && ready && <SpellsPage />}
        {current === "sheet" && ready && <SheetPage />}
        {current === "play" && ready && <PlayPage />}
        {current === "campaigns" && <CampaignsPage />}
        {current === "compendium" && <CompendiumPage />}
        {current === "content" && <ContentPage />}
      </main>
    </div>
  );
}

const THEMES: { theme: Theme; label: string }[] = [
  { theme: "system", label: "Auto" },
  { theme: "light", label: "Light" },
  { theme: "dark", label: "Dark" },
];

function UnitSwitch() {
  const { system } = useUnits();
  return (
    <span className="theme-switch" role="group" aria-label="Units">
      <button aria-pressed={system === "imperial"} title="Feet and pounds" onClick={() => setUnits("imperial")}>
        ft
      </button>
      <button aria-pressed={system === "metric"} title="Meters and kilograms (5 ft = 1.5 m)" onClick={() => setUnits("metric")}>
        m
      </button>
    </span>
  );
}

function ThemeSwitch() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);
  return (
    <span className="theme-switch" role="group" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.theme}
          aria-pressed={theme === t.theme}
          title={t.theme === "system" ? "Follow the system setting" : `${t.label} theme`}
          onClick={() => {
            setTheme(t.theme);
            setThemeState(t.theme);
          }}
        >
          {t.label}
        </button>
      ))}
    </span>
  );
}

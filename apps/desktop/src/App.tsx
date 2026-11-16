import { useState } from "react";
import { HistoryControls } from "./components/HistoryControls";
import { Popover } from "./components/Popover";
import { Portrait } from "./components/Portrait";
import { DEFAULT_TOKEN_COLOR } from "./portraits";
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

/** The app's sections. Character pages belong to Characters. */
const SECTIONS: { page: Page; label: string }[] = [
  { page: "characters", label: "Characters" },
  { page: "campaigns", label: "Campaigns" },
  { page: "compendium", label: "Compendium" },
  { page: "content", label: "Content" },
];

/** Pages for the open character, in the order you usually go through them. */
const CHARACTER_TABS: { page: Page; label: string }[] = [
  { page: "build", label: "Build" },
  { page: "equipment", label: "Equipment" },
  { page: "spells", label: "Spells" },
  { page: "sheet", label: "Sheet" },
  { page: "play", label: "Play" },
];

const isCharacterPage = (p: Page) => CHARACTER_TABS.some((t) => t.page === p);

export function App() {
  const { page, setPage, character, resolved, content, contentError, saving, closeCharacter } = useApp();
  const ready = !!(character && resolved && content);
  const current = isCharacterPage(page) && !ready ? "characters" : page;
  const section = isCharacterPage(current) ? "characters" : current;

  return (
    <div className={`app ${character ? "has-character" : ""}`}>
      <header className="appbar no-print">
        <nav className="topbar" aria-label="Main">
          <span className="brand">DaybreakBuilder</span>
          {SECTIONS.map((t) => (
            <button key={t.page} className={`tab ${section === t.page ? "active" : ""}`} aria-current={section === t.page ? "page" : undefined} onClick={() => setPage(t.page)}>
              {t.label}
            </button>
          ))}
          <span className="spacer" />
          <SettingsMenu />
        </nav>
        {character && (
          <div className="character-bar">
            <span className="character-bar-who" title={character.state.name || "Unnamed character"}>
              <Portrait src={character.state.portrait} name={character.state.name} size={28} ring={character.state.tokenColor ?? DEFAULT_TOKEN_COLOR} />
              <span className="character-bar-name">{character.state.name || "Unnamed character"}</span>
              <span className="muted small save-state" role="status">
                {saving ? "Saving…" : "Saved"}
              </span>
            </span>
            <nav className="subtabs" aria-label="Character">
              {CHARACTER_TABS.map((t) => (
                <button
                  key={t.page}
                  className={`subtab ${current === t.page ? "active" : ""}`}
                  aria-current={current === t.page ? "page" : undefined}
                  disabled={!ready}
                  onClick={() => setPage(t.page)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <span className="spacer" />
            {ready && <HistoryControls />}
            <button className="ghost small" onClick={closeCharacter} title="Close this character (it is already saved)">
              <span aria-hidden>✕</span> Close
            </button>
          </div>
        )}
      </header>
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

/** Units and theme: set once, so they live in a menu instead of the bar. */
function SettingsMenu() {
  return (
    <Popover className="settings-menu" title="Settings" label={<><span aria-hidden>⚙</span> Settings</>}>
      {() => (
        <div className="settings-panel">
          <div className="setting">
            <span className="setting-label" id="units-label">
              Units
            </span>
            <UnitSwitch />
          </div>
          <div className="setting">
            <span className="setting-label" id="theme-label">
              Theme
            </span>
            <ThemeSwitch />
          </div>
          <p className="muted small settings-about">
            DaybreakBuilder {__APP_VERSION__}
          </p>
        </div>
      )}
    </Popover>
  );
}

const THEMES: { theme: Theme; label: string }[] = [
  { theme: "system", label: "System" },
  { theme: "light", label: "Light" },
  { theme: "dark", label: "Dark" },
];

function UnitSwitch() {
  const { system } = useUnits();
  return (
    <span className="theme-switch" role="group" aria-labelledby="units-label">
      <button aria-pressed={system === "imperial"} onClick={() => setUnits("imperial")}>
        Feet, pounds
      </button>
      <button aria-pressed={system === "metric"} title="5 ft = 1.5 m, 1 lb = 0.5 kg" onClick={() => setUnits("metric")}>
        Meters, kilograms
      </button>
    </span>
  );
}

function ThemeSwitch() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);
  return (
    <span className="theme-switch" role="group" aria-labelledby="theme-label">
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

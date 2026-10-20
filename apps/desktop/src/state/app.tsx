import {
  buildSheet,
  resolveCharacter,
  type CharacterSheet,
  type CharacterState,
  type ResolvedCharacter,
} from "@dndbuilder/engine";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { characters, settings } from "../platform";
import { loadAllContent, type LoadedContent } from "./content";

export type Page = "characters" | "build" | "spells" | "sheet" | "equipment" | "compendium" | "content";

interface OpenCharacter {
  id: string;
  state: CharacterState;
}

interface AppState {
  content: LoadedContent | null;
  contentError: string | null;
  reloadContent: () => Promise<void>;
  page: Page;
  setPage: (p: Page) => void;
  character: OpenCharacter | null;
  openCharacter: (id: string, state: CharacterState) => void;
  closeCharacter: () => void;
  update: (fn: (draft: CharacterState) => void) => void;
  resolved: ResolvedCharacter | null;
  sheet: CharacterSheet | null;
  saving: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

/** Like useApp, for components that only render with an open character. */
export function useCharacter() {
  const app = useApp();
  if (!app.character || !app.resolved || !app.sheet || !app.content) throw new Error("No character open");
  return { ...app, character: app.character, resolved: app.resolved, sheet: app.sheet, content: app.content };
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<LoadedContent | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [page, setPageState] = useState<Page>("characters");
  const [character, setCharacter] = useState<OpenCharacter | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadContent = useCallback(async () => {
    try {
      setContentError(null);
      setContent(await loadAllContent());
    } catch (e) {
      setContentError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reloadContent();
  }, [reloadContent]);

  const setPage = useCallback((p: Page) => {
    setPageState(p);
    settings.set("page", p);
  }, []);

  const resolved = useMemo(() => {
    if (!content || !character) return null;
    try {
      return resolveCharacter(content.registry, character.state);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [content, character]);

  const sheet = useMemo(() => (resolved ? buildSheet(resolved) : null), [resolved]);

  // Debounced autosave.
  useEffect(() => {
    if (!character || !sheet) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      const summary = [sheet.race, sheet.classSummary].filter(Boolean).join(" · ");
      void characters
        .save({ id: character.id, name: character.state.name, summary, level: sheet.level, updatedAt: new Date().toISOString() }, character.state)
        .finally(() => setSaving(false));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [character, sheet]);

  const openCharacter = useCallback(
    (id: string, state: CharacterState) => {
      setCharacter({ id, state });
      settings.set("lastCharacter", id);
      setPage("build");
    },
    [setPage],
  );

  const closeCharacter = useCallback(() => {
    setCharacter(null);
    setPage("characters");
  }, [setPage]);

  const update = useCallback((fn: (draft: CharacterState) => void) => {
    setCharacter((cur) => {
      if (!cur) return cur;
      const draft = structuredClone(cur.state);
      fn(draft);
      return { ...cur, state: draft };
    });
  }, []);

  const value: AppState = {
    content,
    contentError,
    reloadContent,
    page,
    setPage,
    character,
    openCharacter,
    closeCharacter,
    update,
    resolved,
    sheet,
    saving,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

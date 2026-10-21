import {
  buildSheet,
  resolveCharacter,
  type CharacterSheet,
  type CharacterState,
  type ResolvedCharacter,
} from "@daybreakbuilder/engine";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { characters, settings } from "../platform";
import { loadAllContent, type LoadedContent } from "./content";
import { emptyHistory, jump, record, redo as redoStep, undo as undoStep, type History } from "./history";

export type Page = "characters" | "build" | "spells" | "sheet" | "equipment" | "compendium" | "content" | "party";

interface OpenCharacter {
  id: string;
  state: CharacterState;
  /** Undo/redo steps for this editing session (not saved). */
  history: History;
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
  undo: () => void;
  redo: () => void;
  /** Go to a point of the history timeline (see `timeline`). */
  jumpTo: (index: number) => void;
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
      setCharacter({ id, state, history: emptyHistory() });
      settings.set("lastCharacter", id);
      setPage("build");
    },
    [setPage],
  );

  const closeCharacter = useCallback(() => {
    setCharacter(null);
    setPage("characters");
  }, [setPage]);

  // Element names for history labels; a ref so `update` keeps a stable identity.
  const registryRef = useRef(content?.registry);
  registryRef.current = content?.registry;

  const update = useCallback((fn: (draft: CharacterState) => void) => {
    setCharacter((cur) => {
      if (!cur) return cur;
      const draft = structuredClone(cur.state);
      fn(draft);
      // Keep one copy of an unchanged portrait instead of one per history step.
      if (draft.portrait === cur.state.portrait) draft.portrait = cur.state.portrait;
      const history = record(cur.history, cur.state, draft, registryRef.current);
      if (history === cur.history) return cur;
      return { ...cur, state: draft, history };
    });
  }, []);

  const step = useCallback((fn: (h: History, s: CharacterState) => { history: History; state: CharacterState } | null) => {
    setCharacter((cur) => {
      const next = cur && fn(cur.history, cur.state);
      return cur && next ? { ...cur, ...next } : cur;
    });
  }, []);
  const undo = useCallback(() => step(undoStep), [step]);
  const redo = useCallback(() => step(redoStep), [step]);
  const jumpTo = useCallback((index: number) => step((h, s) => jump(h, s, index)), [step]);

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
    undo,
    redo,
    jumpTo,
    resolved,
    sheet,
    saving,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

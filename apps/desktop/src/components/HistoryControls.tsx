import { useEffect } from "react";
import { Popover } from "./Popover";
import { useApp } from "../state/app";
import { canRedo, canUndo, timeline } from "../state/history";

/** Typing in these keeps the browser's own text undo. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !["checkbox", "radio", "button", "range", "color", "file"].includes(target.type);
}

function time(at: number | undefined): string {
  return at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
}

/** Undo, Redo and the list of changes for the open character. */
export function HistoryControls() {
  const { character, undo, redo, jumpTo } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if ((key === "z" && e.shiftKey) || key === "y") redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (!character) return null;
  const h = character.history;
  const items = timeline(h).reverse();
  const lastDone = h.past[h.past.length - 1];
  const nextUndone = h.future[0];

  return (
    <span className="history-controls" role="group" aria-label="History">
      <button
        className="ghost small"
        disabled={!canUndo(h)}
        onClick={undo}
        title={lastDone ? `Undo: ${lastDone.label} (Ctrl+Z)` : "Nothing to undo"}
      >
        <span aria-hidden>↶</span> Undo
      </button>
      <button
        className="ghost small"
        disabled={!canRedo(h)}
        onClick={redo}
        title={nextUndone ? `Redo: ${nextUndone.label} (Ctrl+Shift+Z)` : "Nothing to redo"}
      >
        <span aria-hidden>↷</span> Redo
      </button>
      <Popover
        className="history-menu"
        label={`History${h.past.length ? ` (${h.past.length})` : ""}`}
        title="Changes made since the character was opened"
      >
        {(close) => (
          <>
            <ol className="history-list">
              {items.map((item) => (
                <li key={item.index}>
                  <button
                    className={`history-item ${item.current ? "current" : ""} ${item.undone ? "undone" : ""}`}
                    aria-current={item.current ? "step" : undefined}
                    onClick={() => {
                      jumpTo(item.index);
                      close();
                    }}
                  >
                    <span className="grow">{item.label}</span>
                    <span className="muted small">{time(item.at)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="muted small history-note">
              Click a step to go back to it. Steps you go back past stay available until you make a new change.
            </p>
          </>
        )}
      </Popover>
    </span>
  );
}

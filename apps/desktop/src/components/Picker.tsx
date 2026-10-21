import { featCategory, FEAT_CATEGORIES, type ContentRegistry, type ElementDef, type SelectionOption } from "@daybreakbuilder/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { ElementDetail } from "./ElementDetail";

interface Props {
  title: string;
  options: SelectionOption[];
  current: string | null;
  registry: ContentRegistry;
  onPick: (id: string | null) => void;
  onClose: () => void;
  allowClear?: boolean;
}

/** Modal list of candidate elements with search and a description preview. */
export function Picker({ title, options, current, registry, onPick, onClose, allowClear = true }: Props) {
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [focused, setFocused] = useState<ElementDef | null>(() => options.find((o) => o.element.id === current)?.element ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sources = useMemo(() => [...new Set(options.map((o) => o.element.source))].sort(), [options]);
  const [source, setSource] = useState("");
  const categories = useMemo(() => FEAT_CATEGORIES.filter((c) => options.some((o) => featCategory(o.element) === c)), [options]);
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => showUnavailable || o.available || o.element.id === current)
      .filter((o) => !source || o.element.source === source)
      .filter((o) => !category || featCategory(o.element) === category)
      .filter((o) => !q || o.element.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.available) - Number(a.available) || a.element.name.localeCompare(b.element.name));
  }, [options, query, showUnavailable, source, category, current]);

  const unavailableCount = options.filter((o) => !o.available).length;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal picker" role="dialog" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="picker-toolbar">
          <input ref={inputRef} type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {sources.length > 1 && (
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {categories.length > 1 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Feat category">
              <option value="">All feat categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {unavailableCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={showUnavailable} onChange={(e) => setShowUnavailable(e.target.checked)} />
              Show unavailable ({unavailableCount})
            </label>
          )}
        </div>
        <div className="picker-body">
          <ul className="picker-list">
            {filtered.length === 0 && <li className="muted empty">No matching options. Is the right content loaded?</li>}
            {filtered.map((o) => (
              <li
                key={o.element.id}
                className={`${o.element.id === current ? "selected" : ""} ${focused?.id === o.element.id ? "focused" : ""} ${o.available ? "" : "unavailable"}`}
                onMouseEnter={() => setFocused(o.element)}
                onClick={() => setFocused(o.element)}
                onDoubleClick={() => o.available && onPick(o.element.id)}
              >
                <span className="name">{o.element.name}</span>
                <span className="muted small">{o.reason ?? [featCategory(o.element), o.element.source].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
          <div className="picker-preview">
            {focused ? <ElementDetail element={focused} registry={registry} /> : <p className="muted">Select an option to see its description.</p>}
          </div>
        </div>
        <footer className="modal-footer">
          {allowClear && current && (
            <button className="ghost" onClick={() => onPick(null)}>
              Clear choice
            </button>
          )}
          <span className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!focused || !options.find((o) => o.element.id === focused.id)?.available}
            onClick={() => focused && onPick(focused.id)}
          >
            Choose {focused ? focused.name : ""}
          </button>
        </footer>
      </div>
    </div>
  );
}

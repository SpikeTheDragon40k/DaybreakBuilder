import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, StateEffect, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  hoverTooltip,
  keymap,
  placeholder as placeholderExt,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

/** What a `[[link]]` points at, for its colour. */
export type LinkKind = "note" | "character" | "compendium" | "missing" | "image";

export interface LinkSuggestion {
  label: string;
  detail?: string;
  kind: LinkKind;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  linkKind: (target: string) => LinkKind;
  onOpenLink: (target: string) => void;
  /** Card shown when hovering a link. */
  hoverCard?: (target: string) => HTMLElement | null;
  /** Link targets offered after typing `[[`. */
  suggest: (query: string) => LinkSuggestion[];
  /** Change it to repaint links (e.g. after notes are added or renamed). */
  linkVersion: unknown;
  placeholder?: string;
  ariaLabel?: string;
  /**
   * For an embedded image (`![[map.png]]`, `![alt](path)`): null if the target isn't an
   * image of the campaign, otherwise its URL (null while it loads; change linkVersion when it has).
   */
  image?: (target: string) => { src: string | null } | null;
  /** Save a pasted or dropped image; returns the link target to embed. */
  onAddImage?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

const WIKI = /(!?)\[\[([^[\]\n]+?)\]\]/g;

interface WikiMatch {
  from: number;
  to: number;
  embed: boolean;
  target: string;
  /** Start of the shown text (after `target#heading|` when there is an alias). */
  textFrom: number;
  textTo: number;
}

function wikiLinksIn(text: string, offset: number): WikiMatch[] {
  const out: WikiMatch[] = [];
  for (const m of text.matchAll(WIKI)) {
    const from = offset + m.index;
    const open = from + m[1].length + 2;
    const inner = m[2];
    const bar = inner.indexOf("|");
    const ref = bar === -1 ? inner : inner.slice(0, bar);
    const target = ref.split("#")[0].trim();
    if (!target) continue;
    out.push({ from, to: from + m[0].length, embed: !!m[1], target, textFrom: bar === -1 ? open : open + bar + 1, textTo: open + inner.length });
  }
  return out;
}

const refreshLinks = StateEffect.define<null>();

class BulletWidget extends WidgetType {
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-bullet";
    s.textContent = "•";
    return s;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-md-task";
    box.checked = this.checked;
    box.setAttribute("aria-label", this.checked ? "Done" : "To do");
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly width?: number,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.width === this.width;
  }
  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-md-image";
    img.src = this.src;
    img.alt = this.alt;
    if (this.width) img.style.width = `${this.width}px`;
    return img;
  }
}

const hide = Decoration.replace({});

interface PreviewHooks {
  kind: (target: string) => LinkKind;
  image: (target: string) => { src: string | null } | null;
}

/** Lines that have the cursor or a selection: those show their Markdown as typed. */
function activeLines(view: EditorView): Set<number> {
  const out = new Set<number>();
  if (!view.hasFocus) return out;
  for (const r of view.state.selection.ranges) {
    const a = view.state.doc.lineAt(r.from).number;
    const b = view.state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) out.add(i);
  }
  return out;
}

function livePreview(hooks: { current: PreviewHooks }): Extension {
  const build = (view: EditorView): DecorationSet => {
    const doc = view.state.doc;
    const active = activeLines(view);
    const isActive = (pos: number) => active.has(doc.lineAt(pos).number);
    const decos: Range<Decoration>[] = [];
    const wiki: WikiMatch[] = [];

    for (const { from, to } of view.visibleRanges) {
      // Wiki links first: Markdown syntax inside them is left alone.
      for (let pos = from; pos <= to; ) {
        const line = doc.lineAt(pos);
        for (const w of wikiLinksIn(line.text, line.from)) {
          wiki.push(w);
          const img = w.embed ? hooks.current.image(w.target) : null;
          if (img?.src && !isActive(w.from)) {
            const alias = doc.sliceString(w.textFrom, w.textTo);
            const width = w.textFrom > w.from + 3 && /^\d+$/.test(alias) ? Number(alias) : undefined;
            decos.push(Decoration.replace({ widget: new ImageWidget(img.src, w.target, width) }).range(w.from, w.to));
            continue;
          }
          const kind = img ? "image" : hooks.current.kind(w.target);
          const mark = Decoration.mark({ class: `cm-wikilink cm-wikilink-${kind}`, attributes: { "data-target": w.target } });
          if (isActive(w.from)) {
            decos.push(Decoration.mark({ class: "cm-wikilink-syntax" }).range(w.from, w.textFrom));
            decos.push(mark.range(w.textFrom, w.textTo));
            decos.push(Decoration.mark({ class: "cm-wikilink-syntax" }).range(w.textTo, w.to));
          } else {
            decos.push(hide.range(w.from, w.textFrom));
            decos.push(mark.range(w.textFrom, w.textTo));
            decos.push(hide.range(w.textTo, w.to));
          }
        }
        pos = line.to + 1;
      }
      const inWiki = (a: number, b: number) => wiki.some((w) => a < w.to && b > w.from);

      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          const name = node.name;
          const heading = /^(ATX|Setext)Heading(\d)$/.exec(name);
          if (heading) {
            decos.push(Decoration.line({ class: `cm-md-h cm-md-h${heading[2]}` }).range(doc.lineAt(node.from).from));
            return;
          }
          if (name === "FencedCode" || name === "CodeBlock") {
            for (let l = doc.lineAt(node.from).number; l <= doc.lineAt(node.to).number; l++) {
              decos.push(Decoration.line({ class: "cm-md-codeblock" }).range(doc.line(l).from));
            }
            return;
          }
          if (name === "Blockquote") {
            for (let l = doc.lineAt(node.from).number; l <= doc.lineAt(node.to).number; l++) {
              decos.push(Decoration.line({ class: "cm-md-quote" }).range(doc.line(l).from));
            }
            return;
          }
          if (name === "HorizontalRule") {
            decos.push(Decoration.line({ class: isActive(node.from) ? "" : "cm-md-hr" }).range(doc.lineAt(node.from).from));
            return;
          }
          if (inWiki(node.from, node.to) || isActive(node.from)) return;
          switch (name) {
            case "HeaderMark": {
              // "## " → nothing (the setext underline stays).
              if (node.node.parent?.name.startsWith("Setext")) return;
              const end = Math.min(doc.lineAt(node.from).to, node.to + (doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0));
              decos.push(hide.range(node.from, end));
              return;
            }
            case "EmphasisMark":
            case "StrikethroughMark":
              decos.push(hide.range(node.from, node.to));
              return;
            case "CodeMark":
              if (node.node.parent?.name === "InlineCode") decos.push(hide.range(node.from, node.to));
              return;
            case "QuoteMark": {
              const end = node.to + (doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0);
              decos.push(hide.range(node.from, end));
              return;
            }
            case "ListMark": {
              const text = doc.sliceString(node.from, node.to);
              const task = node.node.parent?.getChild("Task");
              if (/^[-*+]$/.test(text) && !task) decos.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
              else if (task) decos.push(hide.range(node.from, Math.min(node.to + 1, task.from)));
              return;
            }
            case "TaskMarker": {
              const checked = /x/i.test(doc.sliceString(node.from, node.to));
              decos.push(Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to));
              return;
            }
            case "Image": {
              const url = node.node.getChild("URL");
              const img = url ? hooks.current.image(doc.sliceString(url.from, url.to)) : null;
              if (img?.src) {
                const marks = node.node.getChildren("LinkMark");
                const alt = marks.length >= 2 ? doc.sliceString(marks[0].to, marks[1].from) : "";
                decos.push(Decoration.replace({ widget: new ImageWidget(img.src, alt) }).range(node.from, node.to));
              }
              return false;
            }
            case "Link": {
              const marks = node.node.getChildren("LinkMark");
              const url = node.node.getChild("URL");
              if (marks.length < 2) return;
              const textFrom = marks[0].to;
              const textTo = marks[1].from;
              decos.push(hide.range(node.from, textFrom));
              decos.push(Decoration.mark({ class: "cm-md-link", attributes: url ? { title: doc.sliceString(url.from, url.to) } : {} }).range(textFrom, textTo));
              decos.push(hide.range(textTo, node.to));
              return false;
            }
          }
          return;
        },
      });
    }
    return Decoration.set(decos, true);
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshLinks)))) {
          this.decorations = build(u.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

const highlight = HighlightStyle.define([
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.92em" },
  { tag: t.url, color: "var(--muted)" },
  { tag: [t.processingInstruction, t.meta], color: "var(--muted)" },
  { tag: t.quote, color: "var(--muted)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "transparent", fontSize: "15px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit" },
  ".cm-content": { fontFamily: "inherit", lineHeight: "1.6", padding: "0.6rem 0", caretColor: "var(--text)", minHeight: "16rem" },
  ".cm-line": { padding: "0 0.2rem" },
  ".cm-cursor": { borderLeftColor: "var(--text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--accent-soft) !important" },
  ".cm-placeholder": { color: "var(--muted)" },
  ".cm-tooltip": { border: "1px solid var(--border)", backgroundColor: "var(--panel)", color: "var(--text)", borderRadius: "6px", boxShadow: "var(--modal-shadow)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-soft)", color: "var(--text)" },
});

/** A Markdown editor that formats as you type and shows the raw syntax only on the line being edited. */
export function MarkdownEditor(props: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const hooks = useRef<PreviewHooks>({
    kind: (target) => latest.current.linkKind(target),
    image: (target) => latest.current.image?.(target) ?? null,
  });

  useEffect(() => {
    if (!host.current) return;
    const complete = (ctx: CompletionContext): CompletionResult | null => {
      const m = ctx.matchBefore(/\[\[[^[\]\n|#]*/);
      if (!m) return null;
      const query = m.text.slice(2);
      const options: Completion[] = latest.current.suggest(query).map((s) => ({
        label: s.label,
        detail: s.detail,
        type: s.kind === "note" ? "text" : s.kind === "character" ? "variable" : "keyword",
        apply: (v, _c, from, to) => {
          const closed = v.state.doc.sliceString(to, to + 2) === "]]";
          const insert = closed ? s.label : `${s.label}]]`;
          v.dispatch({ changes: { from, to, insert }, selection: { anchor: from + s.label.length + 2 } });
        },
      }));
      return { from: m.from + 2, options, filter: false };
    };

    const hover = hoverTooltip(
      (v, pos) => {
        const line = v.state.doc.lineAt(pos);
        const w = wikiLinksIn(line.text, line.from).find((x) => pos >= x.from && pos <= x.to);
        const card = w && latest.current.hoverCard?.(w.target);
        if (!w || !card) return null;
        return { pos: w.from, end: w.to, above: true, create: () => ({ dom: card }) };
      },
      { hoverTime: 350 },
    );

    const insertImages = (v: EditorView, files: File[], at: number) => {
      const add = latest.current.onAddImage;
      if (!add) return;
      void (async () => {
        let pos = at;
        for (const f of files) {
          try {
            const path = await add(f);
            const name = path.split("/").pop() ?? path;
            const before = pos > 0 && v.state.doc.sliceString(pos - 1, pos) !== "\n" ? "\n" : "";
            const insert = `${before}![[${name}]]\n`;
            v.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } });
            pos += insert.length;
          } catch (e) {
            latest.current.onError?.((e as Error).message);
          }
        }
      })();
    };
    const imagesOf = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

    const clicks = EditorView.domEventHandlers({
      paste(e, v) {
        const files = imagesOf(e.clipboardData?.files);
        if (!files.length || !latest.current.onAddImage) return false;
        e.preventDefault();
        insertImages(v, files, v.state.selection.main.head);
        return true;
      },
      drop(e, v) {
        const files = imagesOf(e.dataTransfer?.files);
        if (!files.length || !latest.current.onAddImage) return false;
        e.preventDefault();
        const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.selection.main.head;
        insertImages(v, files, v.state.doc.lineAt(pos).to);
        return true;
      },
      mousedown(e, v) {
        const el = (e.target as HTMLElement).closest?.(".cm-wikilink") as HTMLElement | null;
        if (el && e.button === 0) {
          const pos = v.posAtDOM(el);
          const editing = v.hasFocus && activeLines(v).has(v.state.doc.lineAt(pos).number);
          if (!editing || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            latest.current.onOpenLink(el.dataset.target ?? "");
            return true;
          }
        }
        const box = e.target as HTMLElement;
        if (box instanceof HTMLInputElement && box.classList.contains("cm-md-task")) {
          e.preventDefault();
          const pos = v.posAtDOM(box);
          const text = v.state.doc.sliceString(pos, pos + 3);
          if (/^\[[ xX]\]$/.test(text)) v.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: /x/i.test(text) ? " " : "x" } });
          return true;
        }
        return false;
      },
    });

    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage, addKeymap: false }),
          syntaxHighlighting(highlight),
          livePreview(hooks),
          autocompletion({ override: [complete], icons: false, activateOnTyping: true }),
          hover,
          clicks,
          keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          placeholderExt(props.placeholder ?? ""),
          theme,
          EditorView.contentAttributes.of({ "aria-label": props.ariaLabel ?? "Note text", spellcheck: "true" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is made once per mount; the parent remounts it (key) for another note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Text changed from outside (another program edited the file).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== props.value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: props.value } });
  }, [props.value]);

  useEffect(() => {
    view.current?.dispatch({ effects: refreshLinks.of(null) });
  }, [props.linkVersion]);

  return <div className="md-editor" ref={host} />;
}

import { NOTE_TYPE_LABELS, noteGraph, type Note, type NoteGraph as Graph } from "@daybreakbuilder/engine";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const W = 1000;
const H = 640;

interface Point {
  x: number;
  y: number;
}

/** Force-directed layout: nodes push each other apart, links pull them together, a weak pull keeps them centred. */
function layout(g: Graph): Point[] {
  const n = g.nodes.length;
  // Start on a spiral so the result is the same every time for the same notes.
  const pos = g.nodes.map((_, i) => {
    const a = i * 2.39996;
    const r = 18 * Math.sqrt(i + 1);
    return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
  });
  if (n < 2) return n ? [{ x: W / 2, y: H / 2 }] : pos;
  const ideal = Math.min(140, Math.max(45, Math.sqrt((W * H) / n) * 0.6));
  let temp = 60;
  for (let step = 0; step < 300; step++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let x = pos[i].x - pos[j].x;
        let y = pos[i].y - pos[j].y;
        let d2 = x * x + y * y;
        if (d2 < 0.01) {
          x = 0.1 * (i - j);
          y = 0.1;
          d2 = x * x + y * y;
        }
        const f = (ideal * ideal) / d2;
        dx[i] += x * f;
        dy[i] += y * f;
        dx[j] -= x * f;
        dy[j] -= y * f;
      }
    }
    for (const [a, b] of g.edges) {
      const x = pos[a].x - pos[b].x;
      const y = pos[a].y - pos[b].y;
      const d = Math.sqrt(x * x + y * y) || 0.1;
      const f = d / ideal;
      dx[a] -= x * f;
      dy[a] -= y * f;
      dx[b] += x * f;
      dy[b] += y * f;
    }
    for (let i = 0; i < n; i++) {
      dx[i] += (W / 2 - pos[i].x) * 0.04;
      dy[i] += (H / 2 - pos[i].y) * 0.04;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const move = Math.min(len, temp);
      pos[i] = { x: pos[i].x + (dx[i] / len) * move, y: pos[i].y + (dy[i] / len) * move };
    }
    temp = Math.max(1, temp * 0.97);
  }
  return fit(pos);
}

/** Scale and move the layout to fill the view with a margin (never enlarging more than twice). */
function fit(pos: Point[]): Point[] {
  const M = 60;
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(2, (W - 2 * M) / Math.max(1, x1 - x0), (H - 2 * M) / Math.max(1, y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return pos.map((p) => ({ x: W / 2 + (p.x - cx) * k, y: H / 2 + (p.y - cy) * k }));
}

const TYPE_CLASS = (type: string) => `graph-${(NOTE_TYPE_LABELS as Record<string, string>)[type] ? type : "general"}`;

/** The campaign's notes and the links between them. Click a note to open it. */
export function NoteGraph({ notes, onOpen }: { notes: Note[]; onOpen: (path: string) => void }) {
  const [hideLonely, setHideLonely] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const graph = useMemo(() => {
    const g = noteGraph(notes);
    if (!hideLonely) return g;
    const keep = g.nodes.map((n) => n.degree > 0);
    const index = new Map<number, number>();
    g.nodes.forEach((_, i) => keep[i] && index.set(i, index.size));
    return { nodes: g.nodes.filter((_, i) => keep[i]), edges: g.edges.map(([a, b]) => [index.get(a)!, index.get(b)!] as [number, number]) };
  }, [notes, hideLonely]);
  const pos = useMemo(() => layout(graph), [graph]);
  const types = [...new Set(graph.nodes.map((n) => n.type))];

  const neighbours = useMemo(() => {
    const out = graph.nodes.map(() => new Set<number>());
    for (const [a, b] of graph.edges) {
      out[a].add(b);
      out[b].add(a);
    }
    return out;
  }, [graph]);

  const toSvg = (dxPx: number, dyPx: number) => {
    const rect = svg.current?.getBoundingClientRect();
    const scale = rect ? W / rect.width : 1;
    return { dx: dxPx * scale, dy: dyPx * scale };
  };

  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as Element).closest(".graph-node")) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { dx, dy } = toSvg(e.clientX - d.x, e.clientY - d.y);
    d.moved = true;
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  if (!graph.nodes.length) return <div className="callout">No notes yet. Notes linked with [[links]] show up here, joined by lines.</div>;

  const lit = (i: number) => hover === null || hover === i || neighbours[hover].has(i);
  const showLabel = (i: number) => graph.nodes.length <= 60 || graph.nodes[i].degree >= 2 || hover === i || (hover !== null && neighbours[hover].has(i));

  return (
    <section className="panel note-graph">
      <div className="row wrap graph-toolbar">
        <span className="muted small">
          {graph.nodes.length} notes, {graph.edges.length} links. Drag to move, scroll to zoom, click a note to open it.
        </span>
        <span className="spacer" />
        <label className="check small">
          <input type="checkbox" checked={hideLonely} onChange={(e) => setHideLonely(e.target.checked)} /> Hide notes without links
        </label>
        <button className="small" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
          Reset view
        </button>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="graph-canvas"
        role="img"
        aria-label="Graph of the links between notes"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => {
          const k = Math.min(4, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
          // Zoom around the middle of the view.
          setView((v) => ({ k, x: W / 2 - ((W / 2 - v.x) * k) / v.k, y: H / 2 - ((H / 2 - v.y) * k) / v.k }));
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.edges.map(([a, b], i) => (
            <line
              key={i}
              x1={pos[a].x}
              y1={pos[a].y}
              x2={pos[b].x}
              y2={pos[b].y}
              className={`graph-edge ${hover !== null && (a === hover || b === hover) ? "lit" : ""} ${hover !== null && a !== hover && b !== hover ? "dim" : ""}`}
            />
          ))}
          {graph.nodes.map((n, i) => (
            <g
              key={n.path}
              className={`graph-node ${TYPE_CLASS(n.type)} ${lit(i) ? "" : "dim"}`}
              transform={`translate(${pos[i].x} ${pos[i].y})`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onOpen(n.path)}
              tabIndex={0}
              role="button"
              aria-label={`${n.title}, ${n.degree} link${n.degree === 1 ? "" : "s"}`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(n.path)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <circle r={5 + Math.sqrt(n.degree) * 3} />
              {showLabel(i) && (
                <text y={-(9 + Math.sqrt(n.degree) * 3)} textAnchor="middle">
                  {n.title}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
      <ul className="plain graph-legend">
        {types.map((t) => (
          <li key={t} className={TYPE_CLASS(t)}>
            <svg width="12" height="12" aria-hidden>
              <circle cx="6" cy="6" r="5" />
            </svg>
            {(NOTE_TYPE_LABELS as Record<string, string>)[t] ?? t}
          </li>
        ))}
      </ul>
    </section>
  );
}

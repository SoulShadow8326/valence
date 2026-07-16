"use client";

import { useMemo } from "react";
import { KIND_META, shortLabel, type Thing } from "../lib/objects";

const W = 300;
const H = 214;

type Pt = { x: number; y: number; vx: number; vy: number };

function solve(count: number, links: Array<[number, number]>) {
  const pts: Pt[] = Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(count, 1)) * Math.PI * 2;
    return { x: Math.cos(a) * 70, y: Math.sin(a) * 70, vx: 0, vy: 0 };
  });

  const REST = 66;
  for (let step = 0; step < 480; step++) {
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        let dx = pts[a].x - pts[b].x;
        let dy = pts[a].y - pts[b].y;
        const d2 = dx * dx + dy * dy || 0.01;
        const f = 1500 / d2;
        const d = Math.sqrt(d2);
        dx = (dx / d) * f;
        dy = (dy / d) * f;
        pts[a].vx += dx;
        pts[a].vy += dy;
        pts[b].vx -= dx;
        pts[b].vy -= dy;
      }
    }
    for (const [i, j] of links) {
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - REST) * 0.02;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      pts[i].vx += fx;
      pts[i].vy += fy;
      pts[j].vx -= fx;
      pts[j].vy -= fy;
    }
    for (const p of pts) {
      p.vx -= p.x * 0.008;
      p.vy -= p.y * 0.008;
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 0);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const padX = 48;
  const padTop = 34;
  const padBottom = 46;
  return pts.map((p) => ({
    x: count === 1 ? W / 2 : padX + ((p.x - minX) / spanX) * (W - padX * 2),
    y: count === 1 ? H / 2 : padTop + ((p.y - minY) / spanY) * (H - padTop - padBottom),
  }));
}

export function KnowledgeGraph({
  things,
  onSelect,
}: {
  things: Thing[];
  onSelect?: (id: string) => void;
}) {
  const { nodes, edges, hull } = useMemo(() => {
    const links: Array<[number, number]> = [];
    const edgeMeta: { i: number; j: number; weight: number }[] = [];
    for (let i = 0; i < things.length; i++) {
      for (let j = i + 1; j < things.length; j++) {
        const a = things[i];
        const b = things[j];
        const shared = a.tags.filter((t) => b.tags.includes(t));
        if (shared.length === 0) continue;
        const kinds = new Set([a.kind, b.kind]);
        if (kinds.has("NEED") && kinds.has("CAPACITY")) {
          const resources = new Set([a.payload.resource, b.payload.resource].filter(Boolean));
          if (shared.every((t) => resources.has(t))) continue;
        }
        links.push([i, j]);
        edgeMeta.push({ i, j, weight: shared.length });
      }
    }

    const pos = solve(things.length, links);

    const parent = pos.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const [i, j] of links) parent[find(i)] = find(j);
    const size = new Map<number, number>();
    pos.forEach((_, i) => size.set(find(i), (size.get(find(i)) ?? 0) + 1));

    const nodes = things.map((thing, i) => {
      const raw = shortLabel(thing);
      return {
        thing,
        x: pos[i].x,
        y: pos[i].y,
        urgent: KIND_META[thing.kind].urgent && thing.status !== "Answered",
        answered: thing.status === "Answered",
        label: raw.length > 15 ? `${raw.slice(0, 14)}…` : raw,
        bonded: (size.get(find(i)) ?? 1) > 1,
      };
    });

    const edges = edgeMeta.map((e) => ({
      x1: pos[e.i].x,
      y1: pos[e.i].y,
      x2: pos[e.j].x,
      y2: pos[e.j].y,
      weight: e.weight,
    }));

    const hull = nodes.filter((n) => n.bonded).map((n) => ({ x: n.x, y: n.y }));
    return { nodes, edges, hull };
  }, [things]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      <style>{`
        @keyframes vlnPop { from { opacity: 0; transform: scale(0.2); } to { opacity: 1; transform: scale(1); } }
        @keyframes vlnFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vlnPulse {
          0% { opacity: 0.45; transform: scale(0.75); }
          70% { opacity: 0; transform: scale(2.1); }
          100% { opacity: 0; transform: scale(2.1); }
        }
        .vln-node, .vln-ring { transform-box: fill-box; transform-origin: center; }
        .vln-node { animation: vlnPop 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .vln-ring { animation: vlnPulse 2.4s ease-out infinite; }
        .vln-edge { animation: vlnFade 0.6s ease both; }
        .vln-label { animation: vlnFade 0.5s ease both; }
      `}</style>

      <defs>
        <filter id="vln-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b" />
          <feColorMatrix
            in="b"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>
      </defs>

      {hull.length > 1 && (
        <g filter="url(#vln-goo)" opacity={0.08}>
          {edges.map((e, i) => (
            <line
              key={`h${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--text)"
              strokeWidth={18}
              strokeLinecap="round"
            />
          ))}
          {hull.map((h, i) => (
            <circle key={i} cx={h.x} cy={h.y} r={16} fill="var(--text)" />
          ))}
        </g>
      )}

      {edges.map((e, i) => (
        <line
          key={i}
          className="vln-edge"
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="var(--text)"
          strokeOpacity={0.28}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ animationDelay: `${0.15 + i * 0.05}s` }}
        />
      ))}

      {nodes.map((n, i) => (
        <g
          key={n.thing.id}
          onClick={() => onSelect?.(n.thing.id)}
          style={{ cursor: onSelect ? "pointer" : "default" }}
        >
          <circle cx={n.x} cy={n.y} r={20} fill="transparent" />
          {n.urgent && (
            <circle
              className="vln-ring"
              cx={n.x}
              cy={n.y}
              r={13}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}
          <circle
            className="vln-node"
            cx={n.x}
            cy={n.y}
            r={11}
            fill={n.urgent ? "var(--accent)" : "var(--text)"}
            stroke="var(--card)"
            strokeWidth={3}
            style={{ animationDelay: `${0.25 + i * 0.06}s` }}
          />
          {n.answered && (
            <path
              d={`M ${n.x - 4.5} ${n.y} l 3 3 l 6 -6.5`}
              fill="none"
              stroke="var(--card)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <text
            className="vln-label"
            x={n.x}
            y={n.y + 26}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={n.urgent ? "var(--accent)" : "var(--text)"}
            style={{
              paintOrder: "stroke",
              stroke: "var(--card)",
              strokeWidth: 3,
              animationDelay: `${0.35 + i * 0.06}s`,
            }}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

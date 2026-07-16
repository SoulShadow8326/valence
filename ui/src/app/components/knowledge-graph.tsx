"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { KIND_META, type Thing } from "../lib/objects";

export function KnowledgeGraph({ things }: { things: Thing[] }) {
  const { nodes, edges } = useMemo(() => {
    const size = 300;
    const radius = 108;
    const center = size / 2;
    const placed = things.map((thing, index) => {
      const angle = (index / things.length) * Math.PI * 2 - Math.PI / 2;
      return {
        thing,
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      };
    });

    const links: { a: (typeof placed)[number]; b: (typeof placed)[number]; weight: number }[] = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const shared = placed[i].thing.tags.filter((tag) => placed[j].thing.tags.includes(tag));
        if (shared.length > 0) links.push({ a: placed[i], b: placed[j], weight: shared.length });
      }
    }
    return { nodes: placed, edges: links };
  }, [things]);

  return (
    <svg viewBox="0 0 300 300" className="w-full">
      {edges.map((edge, index) => (
        <motion.line
          key={`${edge.a.thing.id}-${edge.b.thing.id}`}
          x1={edge.a.x}
          y1={edge.a.y}
          x2={edge.b.x}
          y2={edge.b.y}
          stroke="var(--text)"
          strokeOpacity={0.16}
          strokeWidth={edge.weight * 1.25}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: index * 0.02, ease: "easeOut" }}
        />
      ))}
      {nodes.map((node, index) => (
        <motion.circle
          key={node.thing.id}
          cx={node.x}
          cy={node.y}
          r={7 + node.thing.people}
          fill={KIND_META[node.thing.kind].urgent ? "var(--accent)" : "var(--text)"}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 + index * 0.03, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
        />
      ))}
    </svg>
  );
}

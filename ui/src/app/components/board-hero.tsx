"use client";

import { KnowledgeGraph } from "./knowledge-graph";
import type { Thing, ThingKind } from "../lib/objects";

const PHRASE: Partial<Record<ThingKind, string>> = {
  NEED: "a request",
  CAPACITY: "an offer",
  ROUTE: "a route",
  OBSERVATION: "a report",
};

function joinPhrases(list: string[]) {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function answerSummary(things: Thing[]) {
  const n = things.length;
  const parent = things.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (things[i].tags.some((t) => things[j].tags.includes(t))) parent[find(i)] = find(j);
    }
  }
  const comps = new Map<number, number[]>();
  things.forEach((_, i) => {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(i);
  });
  let best: number[] | null = null;
  for (const idxs of comps.values()) {
    if (idxs.length > 1 && idxs.some((i) => things[i].status === "Answered")) {
      if (!best || idxs.length > best.length) best = idxs;
    }
  }
  if (!best) return null;
  const phrases = Array.from(new Set(best.map((i) => PHRASE[things[i].kind]).filter(Boolean)));
  return joinPhrases(phrases as string[]);
}

function Dot({ accent }: { accent?: boolean }) {
  return (
    <span
      className="h-[9px] w-[9px] shrink-0 rounded-full"
      style={{ background: accent ? "var(--accent)" : "var(--text)" }}
    />
  );
}

export function BoardHero({
  things,
  onOpen,
}: {
  things: Thing[];
  onOpen: (id: string) => void;
}) {
  const summary = answerSummary(things);

  return (
    <div className="px-4" data-reveal>
      <div className="overflow-hidden rounded-[18px] bg-card">
        <div className="flex items-start justify-between px-4 pt-3.5">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.01em]">The Board</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">
              Facts different people posted, connecting on their own.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-bg px-2 py-1 text-[10px] font-semibold text-muted">
            no server
          </span>
        </div>

        {things.length ? (
          <>
            <div className="px-2 pt-1">
              <KnowledgeGraph things={things} onSelect={onOpen} />
            </div>

            <p className="px-4 pt-1 text-[13px] leading-relaxed">
              {summary ? (
                <>
                  The network linked <span className="font-semibold">{summary}</span> into one
                  answer — nobody assigned it.
                </>
              ) : (
                <span className="text-muted">
                  Facts connect when they are about the same thing. When enough connect, an answer
                  forms on its own.
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3.5 pt-2.5 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <Dot accent /> Needs an answer
              </span>
              <span className="flex items-center gap-1.5">
                <Dot /> A fact
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 rounded-full" style={{ background: "var(--text)", opacity: 0.4 }} />
                Connected
              </span>
            </div>
          </>
        ) : (
          <p className="px-4 pb-5 pt-3 text-[13px] leading-relaxed text-muted">
            Nothing on the board yet. Publish a need or an offer and watch the network connect it to
            what others have posted.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import { COORDINATION_KINDS, KIND_META, type AtomKind } from "../../lib/objects";
import { useStore } from "../../lib/store";
import { ObjectList } from "../../components/object-row";
import { BoardHero } from "../../components/board-hero";
import { Group, Empty, Count } from "../../components/group";
import { Offline } from "../../components/offline";

const subscribe = () => () => {};

function greetingNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function BoardPage() {
  const { things, peers, connected, loading, open } = useStore();
  const [filter, setFilter] = useState<AtomKind | null>(null);
  const greeting = useSyncExternalStore(subscribe, greetingNow, () => "Welcome back");

  const all = things.filter((thing) => COORDINATION_KINDS.includes(thing.kind as AtomKind));
  const shown = filter ? all.filter((thing) => thing.kind === filter) : all;

  if (!connected && !loading) return <Offline />;

  return (
    <div>
      <header className="px-5 pb-1 pt-12" data-reveal-head>
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">{greeting}</h1>
        <p className="mt-2 text-[14px] text-muted">
          <Count>{all.length}</Count> on the board, <Count>{peers.length}</Count>{" "}
          {peers.length === 1 ? "node" : "nodes"} nearby.
        </p>
      </header>

      <div className="pt-3">
        <BoardHero things={all} onOpen={open} />
      </div>

      {all.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 pt-3" data-scroll-hide data-reveal>
          {([null, ...COORDINATION_KINDS] as (AtomKind | null)[]).map((kind) => {
            const active = filter === kind;
            return (
              <button
                key={kind ?? "all"}
                type="button"
                onClick={() => setFilter(kind)}
                className="shrink-0 rounded-full px-3.5 py-[6px] text-[13px] font-semibold transition-colors duration-100"
                style={{
                  background: active ? "var(--text)" : "var(--card)",
                  color: active ? "var(--card)" : "var(--muted)",
                }}
              >
                {kind ? KIND_META[kind].label : "All"}
              </button>
            );
          })}
        </div>
      )}

      {shown.length ? (
        <Group footer="Everyone holding the same facts sees the same result here, with no server deciding what is true.">
          <ObjectList things={shown} onOpen={open} />
        </Group>
      ) : (
        <Empty
          title="Nothing on the board yet"
          sub="Publish a need or an offer, and the network will connect it to what others have posted."
        />
      )}
    </div>
  );
}

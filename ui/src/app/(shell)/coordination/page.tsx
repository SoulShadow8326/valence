"use client";

import { useState } from "react";
import { COORDINATION_KINDS, KIND_META, type AtomKind } from "../../lib/objects";
import { useStore } from "../../lib/store";
import { ObjectList } from "../../components/object-row";
import { Group, LargeTitle, Empty, Count } from "../../components/group";
import { Offline } from "../../components/offline";

export default function CoordinationPage() {
  const { things, connected, loading, open } = useStore();
  const [filter, setFilter] = useState<AtomKind | null>(null);

  const all = things.filter((thing) => COORDINATION_KINDS.includes(thing.kind as AtomKind));
  const shown = filter ? all.filter((thing) => thing.kind === filter) : all;
  const answered = all.filter((thing) => thing.status === "Answered").length;

  if (!connected && !loading) return <Offline />;

  return (
    <div>
      <LargeTitle
        sub={
          answered ? (
            <>
              <Count>{answered}</Count> of {all.length} answered by the network, with nobody
              assigning anything.
            </>
          ) : (
            "Shared work. Everyone holding the same facts sees the same result."
          )
        }
      >
        Coordination
      </LargeTitle>

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

      {shown.length ? (
        <Group footer="Everyone holding the same facts sees the same result here, with no server deciding what is true.">
          <ObjectList things={shown} onOpen={open} />
        </Group>
      ) : (
        <Empty
          title="Nothing here yet"
          sub="Publish a need or an offer and the network will connect them on its own."
        />
      )}
    </div>
  );
}

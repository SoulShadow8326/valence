"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { matches, COORDINATION_KINDS, type AtomKind } from "../../lib/objects";
import { useStore } from "../../lib/store";
import { ObjectList } from "../../components/object-row";
import { Group, Empty, Count } from "../../components/group";
import { Offline } from "../../components/offline";

const subscribe = () => () => {};

function greetingNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { things, peers, connected, loading, open } = useStore();
  const [query, setQuery] = useState("");
  const greeting = useSyncExternalStore(subscribe, greetingNow, () => "Welcome back");

  const found = useMemo(() => things.filter((thing) => matches(thing, query)), [things, query]);
  const searching = query.trim().length > 0;

  const conversations = found.filter((thing) => thing.kind === "CONVERSATION");
  const coordination = found.filter((thing) =>
    COORDINATION_KINDS.includes(thing.kind as AtomKind),
  );

  if (!connected && !loading) return <Offline />;

  return (
    <div>
      <header className="px-5 pb-3 pt-12" data-reveal-head>
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">{greeting}</h1>
        <p className="mt-2 text-[14px] text-muted">
          <Count>{things.length}</Count> open, <Count>{peers.length}</Count>{" "}
          {peers.length === 1 ? "node" : "nodes"} nearby.
        </p>
      </header>

      <div className="px-4" data-reveal>
        <div className="flex items-center gap-2 rounded-[12px] bg-card px-3">
          <Search size={16} className="shrink-0 text-faint" strokeWidth={2.5} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search everything"
            className="min-h-[40px] w-full bg-transparent text-[15px] outline-none"
          />
        </div>
      </div>

      {searching ? (
        found.length ? (
          <Group label={`${found.length} ${found.length === 1 ? "result" : "results"}`}>
            <ObjectList things={found} onOpen={open} />
          </Group>
        ) : (
          <Empty title="Nothing found" sub={`No matches for "${query.trim()}".`} />
        )
      ) : things.length === 0 ? (
        <Empty
          title="Nothing yet"
          sub="Publish a need or an offer, and anything nearby that matches will find it."
        />
      ) : (
        <>
          {coordination.length > 0 && (
            <Group label="Coordination">
              <ObjectList things={coordination} onOpen={open} />
            </Group>
          )}
          {conversations.length > 0 && (
            <Group label="Messages">
              <ObjectList things={conversations} onOpen={open} />
            </Group>
          )}
        </>
      )}
    </div>
  );
}

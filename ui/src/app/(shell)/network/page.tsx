"use client";

import { Waypoints, ChevronRight } from "lucide-react";
import { useStore } from "../../lib/store";
import { useNow } from "../../lib/clock";
import { agoOf } from "../../lib/objects";
import { LargeTitle, Group, Row, Empty, Count } from "../../components/group";
import { KnowledgeGraph } from "../../components/knowledge-graph";
import { useConnect } from "../../components/connect-peer";
import { Switch } from "../../components/switch";
import { Offline } from "../../components/offline";

export default function NetworkPage() {
  const { things, peers, profiles, graph, devMode, setDevMode, connected, loading } = useStore();
  const { start, sheet } = useConnect();
  const now = useNow();
  const atoms = things.filter((thing) => thing.kind !== "CONVERSATION");

  if (!connected && !loading) return <Offline />;

  return (
    <div>
      <LargeTitle
        sub={
          peers.length ? (
            <>
              <Count>{peers.length}</Count> {peers.length === 1 ? "node" : "nodes"} reachable
              right now, no towers involved.
            </>
          ) : (
            "Nothing reachable yet. Start another node and it appears here on its own."
          )
        }
      >
        Network
      </LargeTitle>

      {peers.length ? (
        <Group
          label="Connections"
          footer="Each of these is another device running Valence nearby. Tap one to open a private line — you reach them by their identity, which won't change even if their network does."
        >
          {peers.map((peer) => {
            const name = profiles[peer.pubKey]?.name;
            return (
              <Row key={peer.pubKey} onClick={() => start(peer)} inset={48}>
                <Waypoints size={22} strokeWidth={2.25} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-semibold leading-tight ${
                      name ? "text-[15px] tracking-[-0.01em]" : "font-mono text-[13px]"
                    }`}
                  >
                    {name ?? peer.pubKey.slice(0, 12)}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted">
                    {name ? `${peer.pubKey.slice(0, 10)} · ${peer.transport}` : peer.addr}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] text-faint">{agoOf(peer.lastSeen, now)}</span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-faint" strokeWidth={2.75} />
              </Row>
            );
          })}
        </Group>
      ) : (
        <Empty
          title="Nothing nearby"
          sub="Start another node on this machine or network and it will appear here on its own."
        />
      )}

      <Group
        label="How it works"
        footer="No server holds this data. Every device builds it independently from the same shared facts, and always lands on the same answer."
      >
        <Row inset={14}>
          <span className="flex-1 text-[15px]">Show how the facts connect</span>
          <Switch on={devMode} onChange={setDevMode} label="Show how the facts connect" />
        </Row>
      </Group>

      {devMode && (
        <>
          <Group
            footer="Each dot is one shared fact. A line means two facts share a topic. Red means it still needs an answer."
          >
            <div className="p-2">
              <KnowledgeGraph things={atoms} />
            </div>
            <div className="flex items-center gap-4 px-4 pb-3 pt-1 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--accent)" }} />
                Needs an answer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[9px] w-[9px] rounded-full bg-text" />
                Everything else
              </span>
            </div>
          </Group>
          <Group footer="No two devices compared notes to get here. Same facts in, same graph out, every time.">
            <Row inset={14}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Facts held</span>
                <span className="block text-[12px] text-muted">Needs, offers, and routes on this device</span>
              </span>
              <span className="text-[15px] text-muted">{graph?.atoms.length ?? atoms.length}</span>
            </Row>
            <Row inset={14}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Connections found</span>
                <span className="block text-[12px] text-muted">Facts that fit together on their own</span>
              </span>
              <span className="text-[15px] text-muted">{graph?.bonds.length ?? "—"}</span>
            </Row>
            <Row inset={14}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Clusters formed</span>
                <span className="block text-[12px] text-muted">Groups that resolved with nobody assigning anything</span>
              </span>
              <span className="text-[15px] text-muted">{graph?.molecules.length ?? "—"}</span>
            </Row>
            <Row inset={14}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Agreement proof</span>
                <span className="block text-[12px] text-muted">Identical on every device holding these facts</span>
              </span>
              <span className="font-mono text-[12px] text-muted">
                {graph ? `${graph.graphHash.slice(0, 8)}…${graph.graphHash.slice(-5)}` : "sample"}
              </span>
            </Row>
          </Group>
        </>
      )}

      {sheet}
    </div>
  );
}

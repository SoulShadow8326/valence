"use client";

import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { useStore } from "../../lib/store";
import { ObjectList } from "../../components/object-row";
import { Group, LargeTitle, Empty, Count, Row } from "../../components/group";
import { Sheet } from "../../components/sheet";
import { Offline } from "../../components/offline";

export default function MessagesPage() {
  const { things, connected, loading, open, dial } = useStore();
  const [dialOpen, setDialOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const conversations = things.filter((thing) => thing.kind === "CONVERSATION");

  async function connect() {
    if (!addr.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await dial(addr.trim());
      setDialOpen(false);
      setAddr("");
      open(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  if (!connected && !loading) return <Offline />;

  return (
    <div>
      <LargeTitle
        sub={
          conversations.length ? (
            <>
              <Count>{conversations.length}</Count> open{" "}
              {conversations.length === 1 ? "line" : "lines"}. Nothing here is written down.
            </>
          ) : (
            "Direct, private lines to people near you. Nothing is written down."
          )
        }
      >
        Messages
      </LargeTitle>

      <Group>
        <Row onClick={() => setDialOpen(true)} inset={48}>
          <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--accent)" }}
          >
            <Plus size={14} strokeWidth={3} className="text-white" />
          </span>
          <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
            New conversation
          </span>
          <ChevronRight size={15} className="shrink-0 text-faint" strokeWidth={2.75} />
        </Row>
      </Group>

      {conversations.length ? (
        <Group footer="These are live only. Nothing here is stored, synced, or recoverable once the session ends.">
          <ObjectList things={conversations} onOpen={open} />
        </Group>
      ) : (
        <Empty
          title="No conversations yet"
          sub="Connect to someone's node address above to open a private line."
        />
      )}

      <Sheet open={dialOpen} title="Start a conversation" onClose={() => setDialOpen(false)}>
        <div className="flex flex-col gap-3 px-1 pt-1">
          <input
            autoFocus
            value={addr}
            onChange={(event) => setAddr(event.target.value)}
            placeholder="127.0.0.1:9201"
            aria-label="Node address"
            className="min-h-[46px] w-full rounded-[12px] bg-card px-3.5 font-mono text-[14px] outline-none"
          />
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            Their node address, not an account. There is no directory and no lookup, you reach
            the device directly.
          </p>
          {error && (
            <p className="px-1 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={connect}
            disabled={!addr.trim() || busy}
            className="min-h-[48px] rounded-[12px] bg-accent text-[15px] font-semibold text-white disabled:opacity-30"
          >
            {busy ? "Connecting" : "Connect"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

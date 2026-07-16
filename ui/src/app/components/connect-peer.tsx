"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "../lib/store";
import { useToast } from "./toast";
import { Sheet } from "./sheet";
import type { PeerDTO } from "../lib/api";

export function useConnect() {
  const { connectPeer, open, profiles } = useStore();
  const toast = useToast();
  const [peer, setPeer] = useState<PeerDTO | null>(null);
  const [adding, setAdding] = useState(false);

  async function add(target: PeerDTO) {
    if (adding) return;
    setAdding(true);
    try {
      const sessionId = await connectPeer(target.pubKey);
      toast.ok("Connection added");
      setPeer(null);
      open(sessionId);
    } catch {
      toast.bad("Could not reach that device");
    } finally {
      setAdding(false);
    }
  }

  const named = peer ? profiles[peer.pubKey] : undefined;

  const sheet = (
    <Sheet open={peer !== null} title="Add connection" onClose={() => setPeer(null)}>
      {peer && (
        <div className="flex flex-col gap-3 px-1 pt-1">
          <div className="rounded-[12px] bg-card p-3.5">
            {named?.name ? (
              <>
                <p className="text-[16px] font-bold tracking-[-0.01em]">{named.name}</p>
                {named.about && (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{named.about}</p>
                )}
                <p className="mt-2 break-all font-mono text-[11px] text-faint">
                  {peer.pubKey.slice(0, 24)}…
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Their identity
                </p>
                <p className="mt-1.5 break-all font-mono text-[13px] leading-relaxed">
                  {peer.pubKey.slice(0, 32)}…
                </p>
              </>
            )}
          </div>
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            This device is near you right now. Add them and a private line opens on both sides —
            they will see that you found them nearby and added them.
          </p>
          <button
            type="button"
            onClick={() => add(peer)}
            disabled={adding}
            className="min-h-[48px] rounded-[12px] bg-accent text-[15px] font-semibold text-white disabled:opacity-30"
          >
            {adding ? "Connecting" : "Add connection"}
          </button>
        </div>
      )}
    </Sheet>
  );

  return { start: setPeer as (peer: PeerDTO) => void, sheet: sheet as ReactNode };
}

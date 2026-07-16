"use client";

import { motion } from "motion/react";
import LogoMark from "../landing/logo-mark";
import { groupNodeId } from "../lib/store";

export function IdentityCard({
  pubKey,
  peers,
  live,
  nodeId,
  name,
}: {
  pubKey: string;
  peers: number;
  live: boolean;
  nodeId?: string;
  name?: string;
}) {
  const onboarding = Boolean(nodeId);
  const grouped = nodeId
    ? groupNodeId(nodeId)
    : pubKey
      ? (pubKey.slice(0, 12).match(/.{1,4}/g) ?? []).join(" ")
      : "…";

  return (
    <div className="relative aspect-[1.6/1] w-full overflow-hidden rounded-[20px] bg-[#0d090e] p-5 text-[#fdfffe]">
      <LogoMark
        variant="rings"
        className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 opacity-[0.3]"
      />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
            LiNode
          </span>
          {onboarding ? (
            <span className="rounded-full bg-white/12 px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.1em] text-white/70">
              New
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold">
              {live && (
                <motion.span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: "var(--accent)" }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <span className={live ? "text-[#fdfffe]" : "text-white/45"}>
                {live ? "Active" : "Offline"}
              </span>
            </span>
          )}
        </div>

        <div>
          <p className="text-[21px] font-bold leading-none tracking-[-0.02em]">
            {onboarding ? "Your Node ID" : name || "This device"}
          </p>
          <p className="mt-1.5 text-[12px] text-white/50">
            {onboarding
              ? "Save this to come back to this identity"
              : `${peers} ${peers === 1 ? "node" : "nodes"} reachable`}
          </p>
          <p className="mt-3.5 font-mono text-[12px] tracking-[0.14em] text-white/80">{grouped}</p>
        </div>
      </div>
    </div>
  );
}

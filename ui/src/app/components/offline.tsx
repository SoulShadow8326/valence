"use client";

import { CloudOff } from "lucide-react";
import { NODE_URL } from "../lib/api";

export function Offline() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-10 text-center">
      <CloudOff size={30} strokeWidth={2} style={{ color: "var(--accent)" }} />
      <p className="text-[17px] font-bold tracking-[-0.01em]">No node running</p>
      <p className="max-w-[260px] text-[13px] leading-relaxed text-muted">
        This app is the screen. The node is the thing that actually talks to the network, and
        it is not answering at {NODE_URL}.
      </p>
      <code className="mt-1 rounded-[10px] bg-card px-3 py-2 font-mono text-[11px]">
        go run ./node -http 127.0.0.1:8080
      </code>
    </div>
  );
}

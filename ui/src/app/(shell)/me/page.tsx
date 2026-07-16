"use client";

import { useState } from "react";
import { ChevronRight, KeyRound, Shield, Layers, FlaskConical, Copy, Check } from "lucide-react";
import { useStore, groupNodeId } from "../../lib/store";
import { IdentityCard } from "../../components/identity-card";
import { Sheet } from "../../components/sheet";
import { Switch } from "../../components/switch";
import { Group, Row, LargeTitle } from "../../components/group";
import { useToast } from "../../components/toast";

type Panel = "identity" | "trust" | "protocols";

const TITLES: Record<Panel, string> = {
  identity: "Keys",
  trust: "Trust",
  protocols: "Protocols",
};

export default function MePage() {
  const { identity, peers, connected, mode, setMode, nodeId, profile } = useStore();
  const toast = useToast();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyNodeId() {
    try {
      await navigator.clipboard.writeText(nodeId);
      setCopied(true);
      toast.ok("Node ID copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.bad("Could not copy");
    }
  }

  const rows = [
    {
      key: "identity" as const,
      Icon: KeyRound,
      label: "Keys",
      value: identity ? identity.slice(0, 6) : "—",
    },
    { key: "trust" as const, Icon: Shield, label: "Trust", value: `${peers.length} known` },
    { key: "protocols" as const, Icon: Layers, label: "Protocols", value: "2 active" },
  ];

  return (
    <div>
      <LargeTitle
        sub={
          mode === "demo"
            ? "Running on sample data. Nothing leaves this device."
            : "One key, no account. This is who you are on the network."
        }
      >
        Me
      </LargeTitle>

      <div className="px-4 pt-1" data-reveal>
        <IdentityCard
          pubKey={identity}
          peers={peers.length}
          live={connected}
          name={mode === "live" ? profile.name : undefined}
        />
      </div>

      <Group label="This node">
        {rows.map(({ key, Icon, label, value }) => (
          <Row key={key} onClick={() => setPanel(key)} inset={48}>
            <Icon size={22} strokeWidth={2.25} className="shrink-0" />
            <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">{label}</span>
            <span className="text-[15px] text-muted">{value}</span>
            <ChevronRight size={15} className="shrink-0 text-faint" strokeWidth={2.75} />
          </Row>
        ))}
      </Group>

      <Group
        label="Data"
        footer={
          mode === "demo"
            ? "The demo runs on sample data held on this device. Nothing is published to any network."
            : connected
              ? "Connected to your node. Everything you publish is signed and synced to real peers."
              : "Not connected to a node yet. Start one and it will connect automatically."
        }
      >
        <Row inset={48}>
          <FlaskConical size={22} strokeWidth={2.25} className="shrink-0" />
          <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">Demo mode</span>
          <Switch
            on={mode === "demo"}
            onChange={(on) => setMode(on ? "demo" : "live")}
            label="Demo mode"
          />
        </Row>
      </Group>

      <Sheet open={panel !== null} title={panel ? TITLES[panel] : ""} onClose={() => setPanel(null)}>
        {panel === "identity" && (
          <div className="space-y-3 px-1">
            {mode === "live" && nodeId && (
              <div className="rounded-[12px] bg-card p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Node ID
                </p>
                <p className="mt-1.5 break-all font-mono text-[14px] tracking-[0.06em]">
                  {groupNodeId(nodeId)}
                </p>
                <button
                  type="button"
                  onClick={copyNodeId}
                  className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold transition-transform duration-100 active:scale-[0.98]"
                  style={{ boxShadow: "inset 0 0 0 1.5px var(--line)" }}
                >
                  {copied ? (
                    <>
                      <Check size={15} strokeWidth={2.8} style={{ color: "#34c759" }} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={15} strokeWidth={2.4} />
                      Copy Node ID
                    </>
                  )}
                </button>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  Your Node ID only works together with your LiNode card. On its own it can&apos;t
                  log in or act as anyone, so it&apos;s safe to share when you connect.
                </p>
              </div>
            )}
            <div className="rounded-[12px] bg-card p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Public key
              </p>
              <p className="mt-1.5 break-all font-mono text-[13px] leading-relaxed">
                {identity || "unknown"}
              </p>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              This key is who you are on the network. It never changes, even when your address,
              your network, or the way you connect does.
            </p>
          </div>
        )}

        {panel === "trust" && (
          <div className="-mx-4">
            <Group footer="Trust is yours alone. It changes what you keep and what you see first, never what the network agrees is true.">
              {peers.length ? (
                peers.map((peer) => (
                  <Row key={peer.pubKey} inset={14}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px]">
                        {peer.pubKey.slice(0, 16)}
                      </span>
                    </span>
                    <span className="text-[15px] text-muted">{peer.trust.toFixed(2)}</span>
                  </Row>
                ))
              ) : (
                <Row inset={14}>
                  <span className="flex-1 text-[15px] text-muted">No peers known yet</span>
                </Row>
              )}
            </Group>
          </div>
        )}

        {panel === "protocols" && (
          <div className="space-y-4 px-1 pt-1">
            <Protocol symbol="Li" number={3} name="Messages">
              Private conversation with forward secrecy. Nothing is stored or synced.
            </Protocol>
            <Protocol symbol="H" number={1} name="Coordination">
              Shared facts that converge on every node without a server.
            </Protocol>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Protocol({
  symbol,
  number,
  name,
  children,
}: {
  symbol: string;
  number: number;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] border-2 border-text">
        <span className="text-[8px] font-bold leading-none text-muted">{number}</span>
        <span className="text-[17px] font-bold leading-none tracking-[-0.03em]">{symbol}</span>
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="text-[13px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

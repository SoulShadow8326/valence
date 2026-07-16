"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Radio, FlaskConical, Check, ChevronLeft, ArrowRight, Copy } from "lucide-react";
import Loader from "./loader";
import LogoMark from "./logo-mark";
import { getHealth } from "../lib/api";
import { IdentityCard } from "../components/identity-card";
import { writeMode, writeNodeId, newNodeId, type Mode } from "../lib/store";

type Step = "intro" | "enter" | "card";

function normalizeId(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 128);
}

function Choice({
  Icon,
  title,
  sub,
  selected,
  badge,
  onSelect,
}: {
  Icon: typeof Radio;
  title: string;
  sub: string;
  selected: boolean;
  badge?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-[16px] bg-card p-4 text-left transition-transform duration-100 active:scale-[0.99]"
      style={{ boxShadow: selected ? "inset 0 0 0 2px var(--accent)" : "none" }}
    >
      <Icon
        size={22}
        strokeWidth={2.25}
        className="mt-[2px] shrink-0"
        style={{ color: selected ? "var(--accent)" : "var(--text)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-muted">{sub}</span>
      </span>
      <span
        className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-100"
        style={{
          background: selected ? "var(--accent)" : "transparent",
          boxShadow: selected ? "none" : "inset 0 0 0 1.5px var(--line)",
        }}
      >
        {selected && <Check size={11} strokeWidth={3.5} className="text-white" />}
      </span>
    </button>
  );
}

export default function Landing() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("live");
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [typed, setTyped] = useState("");
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getHealth().then(setServerUp);
  }, []);

  function connect(id: string) {
    const clean = normalizeId(id);
    if (!clean) return;
    writeNodeId(clean);
    writeMode("live");
    router.push("/home");
  }

  function onGetStarted() {
    if (mode === "demo") {
      writeMode("demo");
      router.push("/home");
      return;
    }
    setStep("enter");
  }

  function generate() {
    setGenerated(newNodeId());
    setCopied(false);
    setStep("card");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-bg px-5 pb-10 pt-16">
      {loading && <Loader onDone={() => setLoading(false)} />}

      <AnimatePresence mode="wait">
        {!loading && step === "intro" && (
          <motion.div
            key="intro"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <LogoMark tone="light" className="h-20 w-20" />
              <div className="space-y-2.5">
                <h1 className="font-brand text-[32px] font-bold leading-none tracking-[-0.03em]">
                  Valence
                </h1>
                <p className="max-w-[280px] text-[15px] leading-relaxed text-muted">
                  The scary aliens have methods which broke comms, so we fixed that for everyone using non conventional protocols!
                </p>
              </div>
            </div>

            <motion.div
              className="flex flex-col gap-2.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <Choice
                Icon={Radio}
                title="Use my node"
                sub={
                  serverUp === false
                    ? "The network is offline right now. Try the demo instead."
                    : "Get a real node on the network. Message and coordinate for real."
                }
                selected={mode === "live"}
                badge={
                  serverUp !== null && (
                    <span
                      className="flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[10px] font-bold"
                      style={{
                        background: serverUp ? "var(--accent-soft)" : "var(--raised)",
                        color: serverUp ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {serverUp ? "Online" : "Offline"}
                    </span>
                  )
                }
                onSelect={() => setMode("live")}
              />
              <Choice
                Icon={FlaskConical}
                title="Try the demo"
                sub="Sample data, nothing to install. Nothing leaves this device."
                selected={mode === "demo"}
                onSelect={() => setMode("demo")}
              />

              <button
                type="button"
                onClick={onGetStarted}
                className="mt-2 flex min-h-[52px] items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
              >
                Get started
              </button>
              <p className="pt-1 text-center text-[12px] text-faint">
                You can switch at any time from Me.
              </p>
            </motion.div>
          </motion.div>
        )}

        {!loading && step === "enter" && (
          <motion.div
            key="enter"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => setStep("intro")}
              aria-label="Back"
              className="-ml-1 mb-4 flex h-9 w-9 items-center justify-center text-muted active:opacity-50"
            >
              <ChevronLeft size={24} strokeWidth={2.4} />
            </button>

            <div className="flex flex-1 flex-col">
              <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">
                Enter your Node ID
              </h1>
              <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">
                Your Node ID is who you are on the network. Paste it to pick up right where you
                left off.
              </p>

              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && connect(typed)}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="abcd efgh ijkl mnop"
                aria-label="Node ID"
                className="mt-6 min-h-[52px] w-full rounded-[14px] bg-card px-4 font-mono text-[15px] tracking-[0.08em] outline-none"
                style={{ boxShadow: "inset 0 0 0 1.5px var(--line)" }}
              />

              <button
                type="button"
                onClick={() => connect(typed)}
                disabled={!normalizeId(typed)}
                className="mt-3 flex min-h-[52px] items-center justify-center gap-1.5 rounded-full bg-accent text-[15px] font-semibold text-white transition-opacity duration-100 active:scale-[0.98] disabled:opacity-30"
              >
                Connect
                <ArrowRight size={18} strokeWidth={2.6} />
              </button>
            </div>

            <div className="rounded-[16px] bg-card p-4">
              <p className="text-[14px] font-semibold">New here?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Get a fresh identity in one tap. We&apos;ll show you the Node ID to save.
              </p>
              <button
                type="button"
                onClick={generate}
                className="mt-3 flex min-h-[46px] w-full items-center justify-center rounded-full text-[15px] font-semibold transition-transform duration-100 active:scale-[0.98]"
                style={{ boxShadow: "inset 0 0 0 1.5px var(--text)" }}
              >
                I don&apos;t have one
              </button>
            </div>
          </motion.div>
        )}

        {!loading && step === "card" && (
          <motion.div
            key="card"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => setStep("enter")}
              aria-label="Back"
              className="-ml-1 mb-4 flex h-9 w-9 items-center justify-center text-muted active:opacity-50"
            >
              <ChevronLeft size={24} strokeWidth={2.4} />
            </button>

            <div className="flex flex-1 flex-col justify-center gap-5">
              <div>
                <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">
                  This is you
                </h1>
                <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">
                  Save your Node ID somewhere safe. It&apos;s the only way back to this identity,
                  and there&apos;s no reset.
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <IdentityCard pubKey="" peers={0} live={false} nodeId={generated} />
              </motion.div>

              <button
                type="button"
                onClick={copy}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] bg-card text-[15px] font-semibold transition-transform duration-100 active:scale-[0.98]"
                style={{ boxShadow: "inset 0 0 0 1.5px var(--line)" }}
              >
                {copied ? (
                  <>
                    <Check size={17} strokeWidth={2.8} style={{ color: "#34c759" }} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={17} strokeWidth={2.4} />
                    Copy Node ID
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => connect(generated)}
              className="mt-4 flex min-h-[52px] items-center justify-center gap-1.5 rounded-full bg-accent text-[15px] font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
            >
              I saved it, continue
              <ArrowRight size={18} strokeWidth={2.6} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { KIND_META, REQUIRED_FIELDS, COORDINATION_KINDS, type AtomKind } from "../lib/objects";
import { useStore, type Compose } from "../lib/store";
import { useToast } from "./toast";
import { tap } from "../lib/haptics";
import { Sheet } from "./sheet";
import { KindTile } from "./object-row";
import { Group, Row } from "./group";

const HINTS: Record<AtomKind, string> = {
  NEED: "Something you need. Others can answer it.",
  CAPACITY: "Something you have that others might need.",
  ROUTE: "A way to get from one place to another.",
  OBSERVATION: "Something you saw that others should know.",
};

const SHOW_ON = ["/board", "/messages"];

export function Publish() {
  const pathname = usePathname();
  const { publish, open, compose, openCompose, closeCompose } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<AtomKind | null>(null);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef<Compose | null>(null);

  useEffect(() => {
    if (compose && compose !== seen.current) {
      seen.current = compose;
      setKind(compose.kind ?? null);
      setTitle(compose.title ?? "");
      setTags((compose.tags ?? []).join(" "));
      setFields(compose.fields ?? {});
      setError("");
    }
    if (!compose) seen.current = null;
  }, [compose]);

  const showFab = SHOW_ON.includes(pathname);

  function reset() {
    closeCompose();
    setKind(null);
    setTitle("");
    setFields({});
    setTags("");
    setError("");
  }

  const specs = kind ? REQUIRED_FIELDS[kind] : [];
  const ready = kind && title.trim() && specs.every((f) => fields[f.key]?.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!kind || !ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, string> = { title: title.trim() };
      for (const spec of specs) payload[spec.key] = fields[spec.key].trim();
      const tagList = tags
        .split(/[\s,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const id = await publish(kind, tagList, payload);
      tap([6, 40, 12]);
      toast.ok(`${KIND_META[kind].label} published`);
      reset();
      open(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showFab && (
        <motion.button
          type="button"
          onClick={() => {
            tap(6);
            openCompose();
          }}
          aria-label="Publish"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 24, delay: 0.15 }}
          whileTap={{ scale: 0.9 }}
          className="absolute bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-30 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_22px_rgba(236,27,39,0.32)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Plus size={24} strokeWidth={2.4} />
        </motion.button>
      )}

      <Sheet open={compose !== null} title={kind ? KIND_META[kind].label : "Create"} onClose={reset}>
        {!kind ? (
          <div className="-mx-4">
            <Group>
              {COORDINATION_KINDS.map((option) => (
                <Row key={option} onClick={() => setKind(option)} inset={48}>
                  <KindTile kind={option} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em]">
                      {KIND_META[option].label}
                    </span>
                    <span className="mt-[3px] block truncate text-[13px] leading-tight text-muted">
                      {HINTS[option]}
                    </span>
                  </span>
                </Row>
              ))}
            </Group>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 px-1 pt-1">
            <Field label="Title">
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Water for Sector 7"
                className="min-h-[46px] w-full rounded-[12px] bg-card px-3.5 text-[15px] outline-none"
              />
            </Field>

            {specs.map((spec) => (
              <Field key={spec.key} label={spec.label}>
                <input
                  value={fields[spec.key] ?? ""}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, [spec.key]: event.target.value }))
                  }
                  placeholder={spec.placeholder}
                  className="min-h-[46px] w-full rounded-[12px] bg-card px-3.5 text-[15px] outline-none"
                />
              </Field>
            ))}

            <Field label="Tags">
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="water sector7"
                className="min-h-[46px] w-full rounded-[12px] bg-card px-3.5 text-[15px] outline-none"
              />
            </Field>

            <p className="px-1 text-[12px] leading-relaxed text-muted">
              Tags are how this finds the other half. A need and an offer that share tags will
              connect on their own.
            </p>

            {error && (
              <p className="px-1 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKind(null)}
                className="min-h-[48px] flex-1 rounded-[12px] bg-card text-[15px] font-semibold"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!ready || busy}
                className="min-h-[48px] flex-[2] rounded-[12px] bg-accent text-[15px] font-semibold text-white transition-opacity duration-100 disabled:opacity-30"
              >
                {busy ? "Publishing" : "Publish"}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

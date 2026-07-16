"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Check, TriangleAlert } from "lucide-react";
import { KIND_META, agoOf, type Thing } from "../lib/objects";
import { useStore } from "../lib/store";
import { KindTile } from "./object-row";
import { Chat } from "./chat";
import { Group, Row } from "./group";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Row inset={14}>
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="max-w-[55%] truncate text-[15px] text-muted">{value}</span>
    </Row>
  );
}

function Coordination({ thing }: { thing: Thing }) {
  const { devMode } = useStore();
  const extra = Object.entries(thing.payload).filter(([key]) => key !== "title");

  const answered = thing.status === "Answered";
  const conflicting = thing.status === "Conflicting";

  return (
    <div className="flex-1 overflow-y-auto pb-10" data-scroll-hide>
      <div className="px-5 pb-1 pt-4">
        <p className="text-[15px] leading-relaxed text-muted">{thing.detail}</p>
      </div>

      {answered && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-card px-3.5 py-3">
          <Check size={17} strokeWidth={3} className="shrink-0" />
          <span className="text-[14px] font-semibold">Answered by the network</span>
        </div>
      )}
      {conflicting && (
        <div
          className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] px-3.5 py-3 text-white"
          style={{ background: "var(--accent)" }}
        >
          <TriangleAlert size={17} strokeWidth={2.6} className="shrink-0" />
          <span className="text-[14px] font-semibold">Nodes disagree, take a look</span>
        </div>
      )}

      <Group>
        {extra.map(([key, value]) => (
          <Field key={key} label={key[0].toUpperCase() + key.slice(1)} value={value} />
        ))}
        <Field label="Contributors" value={String(thing.people)} />
        <Field label="Seen" value={agoOf(thing.updatedMs) || "just now"} />
      </Group>

      {thing.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3">
          {thing.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-card px-2.5 py-1 text-[12px] font-medium text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {thing.derived && (
        <p className="px-5 pt-3 text-[13px] leading-relaxed text-muted">
          No one authored this connection. It formed on its own once enough nodes held facts
          that fit together.
        </p>
      )}

      {devMode && (
        <Group label="Developer">
          <Field label="Protocol" value={KIND_META[thing.kind].protocol} />
          <Field label="Atom kind" value={thing.kind} />
          <Field label="Entropy" value={thing.entropy.toFixed(3)} />
          <Field label="Atom id" value={thing.id.slice(0, 12)} />
        </Group>
      )}
    </div>
  );
}

export function ObjectDetail() {
  const { things, openId, close } = useStore();
  const thing = things.find((item) => item.id === openId);

  return (
    <AnimatePresence>
      {thing && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col bg-bg"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 560, damping: 46 }}
        >
          <header className="flex items-center gap-2 border-b border-line px-2 pb-2.5 pt-12">
            <button
              type="button"
              onClick={close}
              aria-label="Back"
              className="flex h-9 shrink-0 items-center pl-1 pr-2 text-accent transition-opacity duration-100 active:opacity-50"
            >
              <ChevronLeft size={24} strokeWidth={2.4} />
            </button>
            <KindTile kind={thing.kind} size={22} urgent={thing.status === "Answered" ? false : undefined} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-bold leading-tight tracking-[-0.015em]">
                {thing.title}
              </h1>
              <p className="truncate text-[12px] text-muted">
                {KIND_META[thing.kind].label} · {thing.status}
              </p>
            </div>
          </header>
          {thing.kind === "CONVERSATION" ? (
            <Chat thing={thing} />
          ) : (
            <Coordination thing={thing} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

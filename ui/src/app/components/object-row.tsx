"use client";

import { ChevronRight, Check, TriangleAlert } from "lucide-react";
import { KIND_META, agoOf, type Thing, type ThingKind } from "../lib/objects";
import { useNow } from "../lib/clock";
import { Row } from "./group";

export function KindTile({
  kind,
  size = 22,
  urgent,
}: {
  kind: ThingKind;
  size?: number;
  urgent?: boolean;
}) {
  const { icon: Icon } = KIND_META[kind];
  const isUrgent = urgent ?? KIND_META[kind].urgent;
  return (
    <Icon
      size={size}
      strokeWidth={2.25}
      className="shrink-0"
      style={{ color: isUrgent ? "var(--accent)" : "var(--text)" }}
    />
  );
}

export function ObjectRow({ thing, onOpen }: { thing: Thing; onOpen: () => void }) {
  const now = useNow();
  const answered = thing.status === "Answered";
  const conflicting = thing.status === "Conflicting";

  return (
    <Row onClick={onOpen} inset={48}>
      <KindTile kind={thing.kind} urgent={answered ? false : undefined} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
            {thing.title}
          </span>
          <span className="shrink-0 text-[12px] text-faint">
            {thing.kind === "CONVERSATION" ? "Live" : agoOf(thing.updatedMs, now)}
          </span>
        </span>
        {answered ? (
          <span className="mt-[3px] flex items-center gap-1 truncate text-[13px] leading-tight text-muted">
            <Check size={13} strokeWidth={3} className="shrink-0" />
            Answered by the network
          </span>
        ) : conflicting ? (
          <span
            className="mt-[3px] flex items-center gap-1 truncate text-[13px] font-medium leading-tight"
            style={{ color: "var(--accent)" }}
          >
            <TriangleAlert size={13} strokeWidth={2.6} className="shrink-0" />
            Nodes disagree, take a look
          </span>
        ) : (
          <span className="mt-[3px] block truncate text-[13px] leading-tight text-muted">
            {thing.detail}
          </span>
        )}
      </span>
      <ChevronRight size={15} className="shrink-0 text-faint" strokeWidth={2.75} />
    </Row>
  );
}

export function ObjectList({ things, onOpen }: { things: Thing[]; onOpen: (id: string) => void }) {
  return (
    <>
      {things.map((thing) => (
        <ObjectRow key={thing.id} thing={thing} onOpen={() => onOpen(thing.id)} />
      ))}
    </>
  );
}

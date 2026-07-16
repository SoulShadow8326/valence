import {
  MessageCircle,
  TriangleAlert,
  Package,
  Route,
  Eye,
  type LucideIcon,
} from "lucide-react";

export type AtomKind = "NEED" | "CAPACITY" | "ROUTE" | "OBSERVATION";
export type ThingKind = AtomKind | "CONVERSATION";

export type Status = "Open" | "Answered" | "Conflicting" | "Live";

export type Message = {
  id: string;
  text: string;
  mine: boolean;
  at: number;
  replyTo?: string;
  state?: "sending" | "sent" | "failed";
};

export function clockOf(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function sameGroup(a: Message, b: Message) {
  return a.mine === b.mine && Math.abs(b.at - a.at) < 120000 && !b.replyTo;
}

export type Thing = {
  id: string;
  kind: ThingKind;
  title: string;
  detail: string;
  status: Status;
  updatedMs: number;
  people: number;
  tags: string[];
  derived: boolean;
  entropy: number;
  payload: Record<string, string>;
  messages?: Message[];
};

export const KIND_META: Record<
  ThingKind,
  { label: string; icon: LucideIcon; urgent: boolean; protocol: "LiP" | "HEP" }
> = {
  CONVERSATION: { label: "Conversation", icon: MessageCircle, urgent: false, protocol: "LiP" },
  NEED: { label: "Need", icon: TriangleAlert, urgent: true, protocol: "HEP" },
  CAPACITY: { label: "Offer", icon: Package, urgent: false, protocol: "HEP" },
  ROUTE: { label: "Route", icon: Route, urgent: false, protocol: "HEP" },
  OBSERVATION: { label: "Report", icon: Eye, urgent: false, protocol: "HEP" },
};

export const COORDINATION_KINDS: AtomKind[] = ["NEED", "CAPACITY", "ROUTE", "OBSERVATION"];

export type FieldSpec = { key: string; label: string; placeholder: string };

export const REQUIRED_FIELDS: Record<AtomKind, FieldSpec[]> = {
  NEED: [
    { key: "resource", label: "What", placeholder: "water" },
    { key: "quantity", label: "How much", placeholder: "200" },
  ],
  CAPACITY: [
    { key: "resource", label: "What", placeholder: "water" },
    { key: "quantity", label: "How much", placeholder: "500" },
  ],
  ROUTE: [
    { key: "from", label: "From", placeholder: "sector3" },
    { key: "to", label: "To", placeholder: "sector7" },
  ],
  OBSERVATION: [
    { key: "subject", label: "Subject", placeholder: "power, east block" },
    { key: "state", label: "State", placeholder: "restored" },
  ],
};

export function titleOf(kind: AtomKind, payload: Record<string, string>) {
  if (payload.title) return payload.title;
  switch (kind) {
    case "NEED":
      return `${payload.resource ?? "Something"} needed`;
    case "CAPACITY":
      return `${payload.resource ?? "Something"} available`;
    case "ROUTE":
      return `${payload.from ?? "?"} to ${payload.to ?? "?"}`;
    case "OBSERVATION":
      return payload.subject ?? "Report";
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortLabel(thing: Thing) {
  const p = thing.payload;
  switch (thing.kind) {
    case "NEED":
    case "CAPACITY":
      if (p.resource) return p.quantity ? `${cap(p.resource)} ×${p.quantity}` : cap(p.resource);
      return thing.title;
    case "ROUTE":
      return p.from && p.to ? `${p.from}→${p.to}` : thing.title;
    case "OBSERVATION":
      return p.subject ? cap(p.subject) : thing.title;
    default:
      return thing.title;
  }
}

export function detailOf(kind: AtomKind, payload: Record<string, string>) {
  switch (kind) {
    case "NEED":
      return `${payload.quantity ?? "?"} ${payload.resource ?? ""} needed.`.trim();
    case "CAPACITY":
      return `${payload.quantity ?? "?"} ${payload.resource ?? ""} staged and ready.`.trim();
    case "ROUTE":
      return `Route from ${payload.from ?? "?"} to ${payload.to ?? "?"}.`;
    case "OBSERVATION":
      return `${payload.subject ?? "Subject"} is ${payload.state ?? "unknown"}.`;
  }
}

export function matches(thing: Thing, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    thing.title.toLowerCase().includes(q) ||
    thing.detail.toLowerCase().includes(q) ||
    thing.tags.some((tag) => tag.includes(q)) ||
    KIND_META[thing.kind].label.toLowerCase().includes(q) ||
    Object.values(thing.payload).some((v) => v.toLowerCase().includes(q))
  );
}

export function agoOf(ms: number, now: number = Date.now()) {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

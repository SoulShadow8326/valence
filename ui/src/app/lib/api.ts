import {
  type AtomKind,
  type Status,
  type Thing,
  detailOf,
  titleOf,
} from "./objects";

export const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL ?? "http://127.0.0.1:8080";

let apiToken = "";

export function setApiToken(token: string) {
  apiToken = token;
}

function base() {
  return apiToken ? `${NODE_URL}/n/${apiToken}` : NODE_URL;
}

export const getHealth = () =>
  fetch(`${NODE_URL}/health`, { cache: "no-store" }).then((r) => r.ok).catch(() => false);

export type AtomDTO = {
  id: string;
  kind: string;
  tags: string[];
  payload: Record<string, string>;
  refs: string[];
  pubKey: string;
  seq: number;
  firstSeen: number;
  entropy: number;
};

export type BondDTO = { a: string; b: string; type: string; strength: number };

export type MoleculeDTO = { id: string; members: string[]; stability: string };

export type GraphDTO = {
  atoms: AtomDTO[];
  bonds: BondDTO[];
  molecules: MoleculeDTO[];
  graphHash: string;
};

export type PeerDTO = {
  pubKey: string;
  transport: string;
  addr: string;
  lastSeen: number;
  trust: number;
};

export type SessionDTO = { id: string; peerId: string };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()).trim() || `${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const getGraph = () => get<GraphDTO>("/graph");
export const getPeers = () => get<PeerDTO[]>("/peers");
export const getSessions = () => get<SessionDTO[]>("/lip/sessions");
export const getIdentity = () => get<{ pubKey: string }>("/identity");

export const publishAtom = (body: {
  kind: AtomKind;
  tags: string[];
  payload: Record<string, string>;
  refs?: string[];
}) => post<AtomDTO>("/publish", { refs: [], ...body });

export const publishProfile = (name: string, about?: string) =>
  post<AtomDTO>("/publish", {
    kind: "PROFILE",
    tags: [],
    refs: [],
    payload: about ? { name, about } : { name },
  });

export const crystallize = (body: {
  kind: AtomKind;
  tags: string[];
  payload: Record<string, string>;
}) => post<AtomDTO>("/crystallize", { refs: [], ...body });

export const lipSend = (sessionId: string, text: string) =>
  post<{ ok: boolean }>("/lip/send", { sessionId, text });

export const lipDial = (addr: string) => post<{ sessionId: string }>("/lip/dial", { addr });

export type Extracted = {
  kind: AtomKind;
  title: string;
  tags: string[];
  fields: Record<string, string>;
};

const EXTRACT_FIELDS: Record<AtomKind, string[]> = {
  NEED: ["resource", "quantity"],
  CAPACITY: ["resource", "quantity"],
  ROUTE: ["from", "to"],
  OBSERVATION: ["subject", "state"],
};

export async function extractAtom(text: string): Promise<Extracted | null> {
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const kind = d.kind as AtomKind;
    if (!EXTRACT_FIELDS[kind]) return null;
    const fields: Record<string, string> = {};
    for (const k of EXTRACT_FIELDS[kind]) if (d[k]) fields[k] = String(d[k]);
    const tags = Array.isArray(d.tags) ? d.tags.map((t: unknown) => String(t)) : [];
    return { kind, title: typeof d.title === "string" ? d.title : "", tags, fields };
  } catch {
    return null;
  }
}

export function subscribeGraph(onChange: (hash: string) => void) {
  const es = new EventSource(`${base()}/events`);
  es.addEventListener("graph", (event) => onChange((event as MessageEvent).data));
  return () => es.close();
}

export function subscribeFrames(
  onFrame: (frame: { sessionId: string; peerId: string; text: string }) => void,
) {
  const es = new EventSource(`${base()}/lip/events`);
  es.addEventListener("frame", (event) => onFrame(JSON.parse((event as MessageEvent).data)));
  return () => es.close();
}

const KNOWN: AtomKind[] = ["NEED", "CAPACITY", "ROUTE", "OBSERVATION"];

function statusOf(stability: string | undefined): Status {
  if (stability === "UNSTABLE") return "Conflicting";
  if (stability === "STABLE") return "Answered";
  return "Open";
}

export function graphToThings(graph: GraphDTO): Thing[] {
  const moleculeOf = new Map<string, MoleculeDTO>();
  for (const molecule of graph.molecules) {
    for (const member of molecule.members) moleculeOf.set(member, molecule);
  }
  const authorOf = new Map(graph.atoms.map((a) => [a.id, a.pubKey]));

  return graph.atoms
    .filter((a): a is AtomDTO & { kind: AtomKind } => KNOWN.includes(a.kind as AtomKind))
    .map((a) => {
      const molecule = moleculeOf.get(a.id);
      const members = molecule?.members ?? [a.id];
      const authors = new Set(members.map((m) => authorOf.get(m)).filter(Boolean));
      return {
        id: a.id,
        kind: a.kind,
        title: titleOf(a.kind, a.payload),
        detail: detailOf(a.kind, a.payload),
        status: statusOf(molecule?.stability),
        updatedMs: a.firstSeen,
        people: authors.size,
        tags: a.tags,
        derived: members.length > 1 && authors.size > 1,
        entropy: a.entropy,
        payload: a.payload,
      } satisfies Thing;
    })
    .sort((x, y) => y.updatedMs - x.updatedMs);
}

export function sessionToThing(session: SessionDTO, messages: Thing["messages"]): Thing {
  const last = messages?.[messages.length - 1];
  return {
    id: session.id,
    kind: "CONVERSATION",
    title: session.peerId.slice(0, 8),
    detail: last?.text ?? "No messages yet.",
    status: "Live",
    updatedMs: Date.now(),
    people: 2,
    tags: [],
    derived: false,
    entropy: 1,
    payload: {},
    messages: messages ?? [],
  };
}

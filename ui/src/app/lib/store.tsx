"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getGraph,
  getPeers,
  getSessions,
  getIdentity,
  publishAtom,
  lipSend,
  lipDial,
  subscribeGraph,
  subscribeFrames,
  graphToThings,
  sessionToThing,
  setApiToken,
  type GraphDTO,
  type PeerDTO,
  type SessionDTO,
} from "./api";
import { demoThings, demoPeers, demoIdentity } from "./demo";
import { decode, encode, newId } from "./wire";
import type { AtomKind, Message, Thing } from "./objects";

export type Mode = "demo" | "live";

export type Compose = { kind?: AtomKind; title?: string; tags?: string[] };

type Store = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  nodeId: string;
  things: Thing[];
  peers: PeerDTO[];
  graph: GraphDTO | null;
  identity: string;
  connected: boolean;
  loading: boolean;
  devMode: boolean;
  setDevMode: (on: boolean) => void;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  compose: Compose | null;
  openCompose: (prefill?: Compose) => void;
  closeCompose: () => void;
  publish: (kind: AtomKind, tags: string[], payload: Record<string, string>) => Promise<string>;
  send: (sessionId: string, text: string, replyTo?: string) => Promise<void>;
  retry: (sessionId: string, messageId: string) => Promise<void>;
  dial: (addr: string) => Promise<string>;
  refresh: () => Promise<void>;
};

const DEMO_REPLIES = [
  "Copy that.",
  "On it, give me five.",
  "Understood, rerouting now.",
  "Got it, I'll flag it here too.",
];

const Ctx = createContext<Store | null>(null);
const MODE_KEY = "valence.mode";
const NODE_ID_KEY = "valence.nodeId";

let cachedMode: Mode | null = null;
let modeListeners: (() => void)[] = [];

function subscribeMode(listener: () => void) {
  modeListeners.push(listener);
  return () => {
    modeListeners = modeListeners.filter((l) => l !== listener);
  };
}

function modeSnapshot(): Mode {
  if (cachedMode === null) {
    const stored = window.localStorage.getItem(MODE_KEY);
    cachedMode = stored === "demo" || stored === "live" ? stored : "live";
  }
  return cachedMode;
}

export function writeMode(mode: Mode) {
  cachedMode = mode;
  window.localStorage.setItem(MODE_KEY, mode);
  modeListeners.forEach((listener) => listener());
}

let cachedNodeId: string | null = null;
let nodeIdListeners: (() => void)[] = [];

function subscribeNodeId(listener: () => void) {
  nodeIdListeners.push(listener);
  return () => {
    nodeIdListeners = nodeIdListeners.filter((l) => l !== listener);
  };
}

function nodeIdSnapshot(): string {
  if (cachedNodeId === null) cachedNodeId = window.localStorage.getItem(NODE_ID_KEY) ?? "";
  return cachedNodeId;
}

export function writeNodeId(id: string) {
  cachedNodeId = id;
  window.localStorage.setItem(NODE_ID_KEY, id);
  nodeIdListeners.forEach((listener) => listener());
}

// A Node ID is the user's identity credential: the gateway derives the same
// keypair from it every time, so re-entering it restores the same node. Opaque
// lowercase base32, grouped into fours only for display.
export function newNodeId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % 32]).join("");
}

export function groupNodeId(id: string) {
  return (id.match(/.{1,4}/g) ?? []).join(" ");
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeMode, modeSnapshot, () => "live" as Mode);
  const nodeId = useSyncExternalStore(subscribeNodeId, nodeIdSnapshot, () => "");
  const [graph, setGraph] = useState<GraphDTO | null>(null);
  const [livePeers, setLivePeers] = useState<PeerDTO[]>([]);
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [demoExtra, setDemoExtra] = useState<Thing[]>([]);
  const [liveIdentity, setLiveIdentity] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveLoading, setLiveLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [seed] = useState(() => Date.now());
  const messagesRef = useRef<Record<string, Message[]>>({});
  const modeRef = useRef<Mode>(mode);

  useEffect(() => {
    modeRef.current = mode;
    messagesRef.current = messages;
  });

  const refresh = useCallback(async () => {
    if (modeRef.current === "demo") return;
    try {
      const [g, p, s] = await Promise.all([getGraph(), getPeers(), getSessions()]);
      setGraph(g);
      setLivePeers(p);
      setSessions(s);
      setLiveConnected(true);
    } catch {
      setLiveConnected(false);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const setMode = useCallback((next: Mode) => {
    writeMode(next);
    if (next === "live") setLiveLoading(true);
  }, []);

  const demoBase = useMemo(() => demoThings(seed), [seed]);
  const peers = mode === "demo" ? demoPeers(seed) : livePeers;
  const identity = mode === "demo" ? demoIdentity : liveIdentity;
  const connected = mode === "demo" ? true : liveConnected;
  const loading = mode === "demo" ? false : liveLoading;

  useEffect(() => {
    if (mode === "demo") return;
    setApiToken(nodeId);

    const first = setTimeout(() => {
      refresh();
      getIdentity()
        .then((i) => setLiveIdentity(i.pubKey))
        .catch(() => setLiveIdentity(""));
    }, 0);

    const stopGraph = subscribeGraph(() => refresh());
    const stopFrames = subscribeFrames((frame) => {
      const parsed = decode(frame.text);
      setMessages((current) => ({
        ...current,
        [frame.sessionId]: [
          ...(current[frame.sessionId] ?? []),
          {
            id: parsed.id,
            text: parsed.text,
            replyTo: parsed.replyTo,
            mine: false,
            at: Date.now(),
          },
        ],
      }));
      setSessions((current) =>
        current.some((s) => s.id === frame.sessionId)
          ? current
          : [...current, { id: frame.sessionId, peerId: frame.peerId }],
      );
    });

    const poll = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      stopGraph();
      stopFrames();
    };
  }, [mode, nodeId, refresh]);

  const things = useMemo(() => {
    if (mode === "demo") {
      return [...demoExtra, ...demoBase].map((thing) =>
        thing.kind === "CONVERSATION"
          ? { ...thing, messages: [...(thing.messages ?? []), ...(messages[thing.id] ?? [])] }
          : thing,
      );
    }
    const hep = graph ? graphToThings(graph) : [];
    const lip = sessions.map((s) => sessionToThing(s, messages[s.id] ?? []));
    return [...lip, ...hep];
  }, [mode, demoExtra, demoBase, graph, sessions, messages]);

  const publish = useCallback(
    async (kind: AtomKind, tags: string[], payload: Record<string, string>) => {
      if (modeRef.current === "demo") {
        const id = `demo-${newId()}`;
        setDemoExtra((current) => [
          {
            id,
            kind,
            title: payload.title ?? kind,
            detail: Object.entries(payload)
              .filter(([k]) => k !== "title")
              .map(([k, v]) => `${k}: ${v}`)
              .join(", "),
            status: "Open",
            updatedMs: Date.now(),
            people: 1,
            tags,
            derived: false,
            entropy: 0.5,
            payload,
          },
          ...current,
        ]);
        return id;
      }
      const atom = await publishAtom({ kind, tags, payload });
      await refresh();
      return atom.id;
    },
    [refresh],
  );

  const mark = useCallback((sessionId: string, id: string, state: Message["state"]) => {
    setMessages((current) => ({
      ...current,
      [sessionId]: (current[sessionId] ?? []).map((m) => (m.id === id ? { ...m, state } : m)),
    }));
  }, []);

  const deliver = useCallback(
    async (sessionId: string, message: Message) => {
      if (modeRef.current === "demo") {
        mark(sessionId, message.id, "sent");
        const reply = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
        setTimeout(() => {
          setMessages((current) => ({
            ...current,
            [sessionId]: [
              ...(current[sessionId] ?? []),
              { id: newId(), text: reply, mine: false, at: Date.now() },
            ],
          }));
        }, 1100 + Math.random() * 900);
        return;
      }
      try {
        await lipSend(sessionId, encode(message.id, message.text, message.replyTo));
        mark(sessionId, message.id, "sent");
      } catch {
        mark(sessionId, message.id, "failed");
      }
    },
    [mark],
  );

  const send = useCallback(
    async (sessionId: string, text: string, replyTo?: string) => {
      const message: Message = {
        id: newId(),
        text,
        replyTo,
        mine: true,
        at: Date.now(),
        state: "sending",
      };
      setMessages((current) => ({
        ...current,
        [sessionId]: [...(current[sessionId] ?? []), message],
      }));
      await deliver(sessionId, message);
    },
    [deliver],
  );

  const retry = useCallback(
    async (sessionId: string, messageId: string) => {
      const message = (messagesRef.current[sessionId] ?? []).find((m) => m.id === messageId);
      if (!message) return;
      mark(sessionId, messageId, "sending");
      await deliver(sessionId, message);
    },
    [deliver, mark],
  );

  const dial = useCallback(
    async (addr: string) => {
      const { sessionId } = await lipDial(addr);
      await refresh();
      return sessionId;
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      nodeId,
      things,
      peers,
      graph,
      identity,
      connected,
      loading,
      devMode,
      setDevMode,
      openId,
      open: setOpenId,
      close: () => setOpenId(null),
      compose,
      openCompose: (prefill?: Compose) => setCompose(prefill ?? {}),
      closeCompose: () => setCompose(null),
      publish,
      send,
      retry,
      dial,
      refresh,
    }),
    [
      mode,
      setMode,
      nodeId,
      things,
      peers,
      graph,
      identity,
      connected,
      loading,
      devMode,
      openId,
      compose,
      publish,
      send,
      retry,
      dial,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

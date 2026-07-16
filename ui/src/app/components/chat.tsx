"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import {
  ArrowUp,
  ChevronDown,
  Reply,
  Copy,
  Sparkles,
  X,
  Check,
  CircleAlert,
} from "lucide-react";
import { clockOf, sameGroup, type Message, type Thing } from "../lib/objects";
import { useStore } from "../lib/store";
import { useToast } from "./toast";
import { tap } from "../lib/haptics";
import { ContextMenu, useLongPress, type MenuState } from "./context-menu";

function Ticks({ state, onRetry }: { state: Message["state"]; onRetry?: () => void }) {
  if (state === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 font-semibold"
        style={{ color: "var(--accent)" }}
      >
        <CircleAlert size={12} strokeWidth={2.8} />
        Tap to retry
      </button>
    );
  }
  if (state === "sending") {
    return (
      <motion.span
        className="block h-[7px] w-[7px] rounded-full border border-current"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }
  return <Check size={12} strokeWidth={3} className="opacity-55" />;
}

function TypingDots() {
  return (
    <div className="flex w-fit items-center gap-1 self-start rounded-[18px] bg-card px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-[6px] w-[6px] rounded-full bg-faint"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const REPLY_THRESHOLD = 56;

function Bubble({
  message,
  quoted,
  first,
  last,
  spaced,
  onMenu,
  onJump,
  onRetry,
  onSwipeReply,
}: {
  message: Message;
  quoted?: Message;
  first: boolean;
  last: boolean;
  spaced: boolean;
  onMenu: (x: number, y: number) => void;
  onJump: (id: string) => void;
  onRetry: () => void;
  onSwipeReply: () => void;
}) {
  const press = useLongPress(onMenu);
  const mine = message.mine;
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, REPLY_THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, REPLY_THRESHOLD], [0.5, 1]);
  const crossed = useRef(false);

  const radius = mine
    ? `18px ${first ? "18px" : "6px"} ${last ? "18px" : "6px"} 18px`
    : `${first ? "18px" : "6px"} 18px 18px ${last ? "18px" : "6px"}`;

  return (
    <div
      className={`relative flex max-w-[80%] flex-col ${spaced ? "mt-2" : ""} ${
        mine ? "items-end self-end" : "items-start self-start"
      }`}
    >
      <motion.span
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2"
        style={{ opacity: iconOpacity, scale: iconScale }}
      >
        <Reply size={16} strokeWidth={2.4} className="text-faint" />
      </motion.span>
      <motion.div
        id={`msg-${message.id}`}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: REPLY_THRESHOLD + 24 }}
        dragElastic={{ left: 0, right: 0.5 }}
        dragSnapToOrigin
        onDrag={(_, info) => {
          const past = info.offset.x > REPLY_THRESHOLD;
          if (past && !crossed.current) tap(5);
          crossed.current = past;
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > REPLY_THRESHOLD) {
            tap([8, 30, 8]);
            onSwipeReply();
          }
          crossed.current = false;
        }}
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col"
        {...press}
      >
        <div
          className={`select-none px-3 py-2 ${
            mine ? "bg-bubble text-bubble-text" : "bg-card text-text"
          }`}
          style={{ borderRadius: radius }}
        >
          {quoted && (
            <button
              type="button"
              onClick={() => onJump(quoted.id)}
              className={`mb-1.5 flex w-full flex-col items-start gap-0.5 rounded-[9px] border-l-[3px] px-2 py-1 text-left ${
                mine ? "bg-white/10" : "bg-raised"
              }`}
              style={{ borderColor: "var(--accent)" }}
            >
              <span className="text-[11px] font-semibold opacity-70">
                {quoted.mine ? "You" : "Them"}
              </span>
              <span className="line-clamp-2 text-[12px] opacity-60">{quoted.text}</span>
            </button>
          )}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.35]">
            {message.text}
          </p>
        </div>
        {last && (
          <span
            className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-faint ${
              mine ? "flex-row" : "flex-row-reverse"
            }`}
          >
            {mine && <Ticks state={message.state} onRetry={onRetry} />}
            {message.state !== "failed" && clockOf(message.at)}
          </span>
        )}
      </motion.div>
    </div>
  );
}

export function Chat({ thing }: { thing: Thing }) {
  const { send, retry, openCompose } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [typing, setTyping] = useState(false);
  const messages = thing.messages ?? [];
  const byId = new Map(messages.map((m) => [m.id, m]));
  const lastMessage = messages[messages.length - 1];
  const waiting = Boolean(lastMessage?.mine && lastMessage.state === "sent");
  const lastMineId = waiting ? lastMessage!.id : null;

  useEffect(() => {
    if (!lastMineId) return;
    const show = setTimeout(() => setTyping(true), 250);
    const hide = setTimeout(() => setTyping(false), 2400);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setTyping(false);
    };
  }, [lastMineId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, atBottom, typing]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 640 });
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    tap(6);
    setDraft("");
    setReplyTo(null);
    setAtBottom(true);
    send(thing.id, text, replyTo?.id);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok("Copied");
    } catch {
      toast.bad("Could not copy");
    }
  }

  function startReply(message: Message) {
    setReplyTo(message);
    inputRef.current?.focus();
  }

  function menuFor(message: Message) {
    return (x: number, y: number) =>
      setMenu({
        x,
        y,
        items: [
          {
            label: "Reply",
            Icon: Reply,
            onSelect: () => startReply(message),
          },
          { label: "Copy", Icon: Copy, onSelect: () => copy(message.text) },
          {
            label: "Make it shared",
            Icon: Sparkles,
            onSelect: () => openCompose({ title: message.text.slice(0, 60), tags: thing.tags }),
          },
        ],
      });
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex flex-1 flex-col gap-[3px] overflow-y-auto px-3 pb-3 pt-3"
        data-scroll-hide
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-[15px] font-semibold">Say something</p>
            <p className="max-w-[230px] text-[13px] leading-relaxed text-muted">
              This line is private and forward secret. Nothing is written down, so it disappears
              when you close it.
            </p>
          </div>
        ) : (
          <>
            <p className="mx-auto mb-2 max-w-[240px] text-center text-[11px] leading-relaxed text-faint">
              Private and forward secret. Nothing here is stored.
            </p>
            {messages.map((message, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const first = !prev || !sameGroup(prev, message);
              const last = !next || !sameGroup(message, next);
              return (
                <Bubble
                  key={message.id}
                  message={message}
                  quoted={message.replyTo ? byId.get(message.replyTo) : undefined}
                  first={first}
                  last={last}
                  spaced={Boolean(first && prev)}
                  onMenu={menuFor(message)}
                  onJump={jumpTo}
                  onRetry={() => retry(thing.id, message.id)}
                  onSwipeReply={() => startReply(message)}
                />
              );
            })}
            <AnimatePresence>
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1"
                >
                  <TypingDots />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {!atBottom && messages.length > 0 && (
          <motion.button
            type="button"
            onClick={() => setAtBottom(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-[104px] right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-[0_4px_16px_rgba(13,9,14,0.18)]"
            aria-label="Jump to latest"
          >
            <ChevronDown size={18} strokeWidth={2.4} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="border-t border-line bg-bg px-3 pb-7 pt-2">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="overflow-hidden"
            >
              <div
                className="mb-2 flex items-center gap-2 rounded-[10px] border-l-[3px] bg-card px-2.5 py-1.5"
                style={{ borderColor: "var(--accent)" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-muted">
                    Replying to {replyTo.mine ? "yourself" : thing.title}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{replyTo.text}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                  className="shrink-0 text-faint"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Message"
            aria-label={`Message ${thing.title}`}
            className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-[19px] bg-card px-4 py-[9px] text-[15px] leading-[1.3] outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-white transition-all duration-100 disabled:opacity-100"
            style={{ background: draft.trim() ? "var(--accent)" : "var(--raised)" }}
          >
            <ArrowUp
              size={19}
              strokeWidth={2.6}
              style={{ color: draft.trim() ? "#fff" : "var(--faint)" }}
            />
          </button>
        </form>
      </div>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
    </>
  );
}

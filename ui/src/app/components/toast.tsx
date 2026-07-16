"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, CircleAlert, type LucideIcon } from "lucide-react";

type Toast = { id: number; text: string; Icon: LucideIcon; tone: "ok" | "bad" };

const Ctx = createContext<{
  ok: (text: string) => void;
  bad: (text: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: "ok" | "bad") => {
    const id = seq.current++;
    setToasts((current) => [
      ...current.filter((t) => t.text !== text),
      { id, text, tone, Icon: tone === "ok" ? Check : CircleAlert },
    ]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 2200);
  }, []);

  const value = useMemo(
    () => ({ ok: (text: string) => push(text, "ok"), bad: (text: string) => push(text, "bad") }),
    [push],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-[104px] z-[70] flex flex-col items-center gap-2 px-6">
        <AnimatePresence initial={false}>
          {toasts.map(({ id, text, Icon, tone }) => (
            <motion.div
              key={id}
              role="status"
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className="flex items-center gap-2 rounded-full bg-[#0d090e] py-2.5 pl-3 pr-4 text-[13px] font-semibold text-[#fdfffe] shadow-[0_8px_28px_rgba(13,9,14,0.3)]"
            >
              <Icon
                size={15}
                strokeWidth={3}
                style={{ color: tone === "ok" ? "#34c759" : "var(--accent)" }}
              />
              {text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { tap } from "../lib/haptics";

export type MenuItem = {
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
};

export type MenuState = { x: number; y: number; items: MenuItem[] } | null;

export function useLongPress(onTrigger: (x: number, y: number) => void) {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer) clearTimeout(timer);
    setTimer(null);
  };

  return {
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      onTrigger(event.clientX, event.clientY);
    },
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0];
      const t = setTimeout(() => {
        tap(9);
        onTrigger(touch.clientX, touch.clientY);
      }, 420);
      setTimer(t);
    },
    onTouchEnd: cancel,
    onTouchMove: cancel,
  };
}

export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [state, onClose]);

  const width = 208;
  const height = state ? state.items.length * 44 + 8 : 0;

  let x = 0;
  let y = 0;
  if (state) {
    const frame = document.getElementById("phone-viewport")?.getBoundingClientRect();
    const localX = state.x - (frame?.left ?? 0);
    const localY = state.y - (frame?.top ?? 0);
    const boundW = frame?.width ?? window.innerWidth;
    const boundH = frame?.height ?? window.innerHeight;
    x = Math.min(Math.max(8, localX - width / 2), boundW - width - 8);
    y = Math.min(localY + 6, boundH - height - 12);
  }

  return (
    <AnimatePresence>
      {state && (
        <>
          <motion.div
            className="absolute inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            onContextMenu={(event) => {
              event.preventDefault();
              onClose();
            }}
          />
          <motion.div
            role="menu"
            className="absolute z-[61] overflow-hidden rounded-[14px] bg-card py-1 shadow-[0_10px_40px_rgba(13,9,14,0.22)]"
            style={{ left: x, top: y, width }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
          >
            {state.items.map(({ label, Icon, onSelect, danger }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect();
                  onClose();
                }}
                className="flex h-11 w-full items-center justify-between px-3.5 text-left text-[15px] transition-colors duration-75 active:bg-raised"
                style={danger ? { color: "var(--accent)" } : undefined}
              >
                {label}
                <Icon size={17} strokeWidth={2.1} />
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

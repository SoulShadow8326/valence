"use client";

import { motion, AnimatePresence, type PanInfo } from "motion/react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 70 || info.velocity.y > 450) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 max-h-[80%] overflow-y-auto rounded-t-[22px] bg-bg px-4 pb-10 pt-2.5 shadow-[0_-1px_0_var(--line),0_-20px_60px_rgba(13,9,14,0.16)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 44 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={onDragEnd}
            data-scroll-hide
          >
            <div className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-line" />
            <h2 className="px-1 pb-3 text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

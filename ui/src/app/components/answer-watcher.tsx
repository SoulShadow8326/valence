"use client";

import { useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { useToast } from "./toast";
import { tap } from "../lib/haptics";

export function AnswerWatcher() {
  const { things } = useStore();
  const toast = useToast();
  const prev = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (prev.current.size > 0) {
      for (const t of things) {
        const before = prev.current.get(t.id);
        if (t.status === "Answered" && before && before !== "Answered") {
          toast.ok(`${t.title} — answered by the network`);
          tap([8, 40, 12]);
        }
      }
    }
    prev.current = new Map(things.map((t) => [t.id, t.status]));
  }, [things, toast]);

  return null;
}

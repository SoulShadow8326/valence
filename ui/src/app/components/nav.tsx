"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Handshake, MessageCircle, Globe, User } from "lucide-react";
import { tap } from "../lib/haptics";

const TABS = [
  { href: "/board", label: "Board", Icon: Handshake },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/network", label: "Network", Icon: Globe },
  { href: "/me", label: "Me", Icon: User },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-card pt-2 pb-[calc(22px+env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => !active && tap(5)}
            className="flex min-w-[54px] flex-col items-center gap-[3px] rounded-[10px] py-1 outline-none transition-opacity duration-100 focus-visible:ring-2 focus-visible:ring-accent active:opacity-50"
            style={{ color: active ? "var(--accent)" : "var(--muted)" }}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[10px] font-semibold tracking-[-0.01em]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

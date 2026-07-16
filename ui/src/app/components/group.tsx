"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function Group({
  label,
  footer,
  children,
}: {
  label?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`px-4 ${label ? "" : "pt-4"}`} data-reveal>
      {label && (
        <h2 className="px-1 pb-2 pt-6 text-[13px] font-semibold text-muted">{label}</h2>
      )}
      <div className="overflow-hidden rounded-[16px] bg-card">{children}</div>
      {footer && (
        <p className="px-1 pt-2 text-[12px] leading-relaxed text-muted">{footer}</p>
      )}
    </section>
  );
}

export function Row({
  onClick,
  inset = 56,
  children,
}: {
  onClick?: () => void;
  inset?: number;
  children: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className="relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 after:absolute after:bottom-0 after:right-0 after:h-px after:bg-line after:content-[''] after:[left:var(--inset)] last:after:hidden active:bg-raised"
      style={{ ["--inset" as string]: `${inset}px` }}
    >
      {children}
    </Tag>
  );
}

export function LargeTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <header className="px-5 pb-1 pt-12" data-reveal-head>
      <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">{children}</h1>
      {sub && <p className="mt-2 text-[14px] leading-snug text-muted">{sub}</p>}
    </header>
  );
}

export function Count({ children }: { children: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = children;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === from.current) {
      el.textContent = String(target);
      from.current = target;
      return;
    }

    const obj = { n: from.current };
    const tween = gsap.to(obj, {
      n: target,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(obj.n));
      },
    });
    from.current = target;
    return () => {
      tween.kill();
    };
  }, [children]);

  return (
    <span ref={ref} className="font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
      {children}
    </span>
  );
}

export function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-10 py-20 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-[240px] text-[13px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

"use client";

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: on ? "var(--accent)" : "var(--raised)" }}
    >
      <span
        className="absolute top-[2px] block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(13,9,14,0.28)] transition-all duration-200"
        style={{ left: on ? 22 : 2 }}
      />
    </button>
  );
}

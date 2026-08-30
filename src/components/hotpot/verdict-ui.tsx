import type { Verdict } from "@/lib/hotpot/types";

export const VERDICT_STYLE: Record<
  Verdict,
  { text: string; bg: string; ring: string; bar: string; label: string }
> = {
  SAFE: {
    text: "text-safe",
    bg: "bg-safe-soft",
    ring: "ring-1 ring-safe/40",
    bar: "bg-safe",
    label: "SAFE",
  },
  SUSPICIOUS: {
    text: "text-suspicious",
    bg: "bg-suspicious-soft",
    ring: "ring-1 ring-suspicious/40",
    bar: "bg-suspicious",
    label: "SUSPICIOUS",
  },
  SCAM: {
    text: "text-scam",
    bg: "bg-scam-soft",
    ring: "ring-1 ring-scam/50",
    bar: "bg-scam",
    label: "SCAM",
  },
};

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-widest ${s.bg} ${s.text} ${s.ring}`}
    >
      <span className={`size-1.5 rounded-full ${s.bar}`} />
      {s.label}
    </span>
  );
}

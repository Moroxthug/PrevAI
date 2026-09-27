import { cn } from "@/lib/utils";

/*
 * Phone-only building blocks (fase 19, premium mobile). Styles live in
 * mockup-system.css under "PREMIUM MOBILE"; these components render only
 * inside `.m-only` containers, so desktop never sees them.
 */

const TINTS = ["teal", "purple", "green", "amber", "navy"] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return "·";
  const first = words[0]![0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1]![0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Initials on a tint picked from the name, so a client keeps its colour everywhere. */
export function Monogram({ name, size = 38, className }: { name: string; size?: number; className?: string }) {
  const tint = TINTS[hash(name.toLowerCase()) % TINTS.length];
  return (
    <span className={cn("mono", `mono-${tint}`, className)} style={{ width: size, height: size }} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

export function statusTone(status: string): "ok" | "wait" | "accepted" | "draft" {
  if (status === "unlocked") return "ok";
  if (status === "pending_payment") return "wait";
  if (status === "accepted") return "accepted";
  return "draft";
}

export function StatusDot({ status }: { status: string }) {
  return <span className={cn("sdot", `sdot-${statusTone(status)}`)} aria-hidden />;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" }).replace(".", "");

/** 8-week area sparkline for the hero card; marks the best week. */
export function Sparkline({ values }: { values: number[] }) {
  const w = 320, h = 60, pad = 6;
  const max = Math.max(...values, 0);
  if (max <= 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden>
        <path d={`M0 ${h - pad} H${w}`} className="spark-line" />
      </svg>
    );
  }
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const best = pts[values.lastIndexOf(max)]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fd3c7" stopOpacity=".45" />
          <stop offset="1" stopColor="#5fd3c7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#spark-fill)" />
      <path d={line} className="spark-line" />
      <circle cx={best[0]} cy={best[1]} r="3.5" fill="#fff" />
    </svg>
  );
}

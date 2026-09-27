import type { Score } from "@/lib/evaluation/scoring";

const STATUS = {
  good: { color: "#0ca30c", track: "#d7f0d7", icon: "✓", label: "Strong" },
  warning: { color: "#fab219", track: "#fdeec9", icon: "◐", label: "Developing" },
  critical: { color: "#d03b3b", track: "#f6d6d6", icon: "!", label: "Needs work" },
} as const;

export function statusFor(value: number | null) {
  if (value === null) return null;
  return value >= 75 ? STATUS.good : value >= 50 ? STATUS.warning : STATUS.critical;
}

/** Stat tile + meter. The meter's fill carries severity; icon + label keep it readable without color. */
export function ScoreTile({ label, score, note, method }: { label: string; score: Score; note?: string; method?: string }) {
  const s = statusFor(score.value);
  return (
    <div className="flex flex-col rounded-2xl bg-paper p-4 shadow-sm ring-1 ring-ink/5">
      <div className="text-sm font-bold text-ink-soft">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold text-ink">{score.value ?? "n/a"}</span>
        {score.value !== null && <span className="text-sm text-ink-soft">/ 100</span>}
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full"
        style={{ background: s?.track ?? "#e6ebf3" }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score.value ?? undefined}
        aria-label={`${label} score`}
      >
        {s && <div className="h-full rounded-full" style={{ width: `${Math.max(3, score.value ?? 0)}%`, background: s.color }} />}
      </div>
      <div className="mt-1.5 text-xs font-bold text-ink-soft">
        {s ? (
          <>
            <span aria-hidden className="mr-1">
              {s.icon}
            </span>
            {s.label}
          </>
        ) : (
          "Not enough data"
        )}
      </div>
      <p className="mt-2 text-sm leading-snug text-ink">{score.headline}</p>
      <ul className="mt-1.5 space-y-0.5 text-xs leading-snug text-ink-soft">
        {score.detail.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      {note && <p className="mt-2 text-[11px] italic leading-snug text-ink-soft">{note}</p>}
      {method && (
        <details className="mt-auto pt-3 text-xs">
          <summary className="cursor-pointer font-bold text-brand">How this is calculated</summary>
          <p className="mt-1 leading-snug text-ink-soft">{method}</p>
        </details>
      )}
    </div>
  );
}

import { ProgressBar } from "@/components/ui/ProgressBar";
import { withoutEmDashes } from "@/lib/evaluation/text";
import type { AgentAnalysis } from "@/lib/session/types";
import { clock, useElapsed } from "./FeedbackProgress";
import { statusFor } from "./ScoreTile";

function items(value: unknown): { a: string; b?: string }[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, ...rest] = s.split("=>");
      return { a: withoutEmDashes(a), b: withoutEmDashes(rest.join("=>")) || undefined };
    });
}

const CRITERIA_NAMES: Record<string, string> = {
  objective_completed: "Objective completed",
  comprehension: "Comprehension",
  target_language_use: "Target-language use",
  register: "Politeness & register",
};

/** While ElevenLabs Agents writes the review: what is happening, for how long, and a placeholder of what's coming. */
function ReviewWaiting({ npcName, wait }: { npcName: string; wait?: { since: number; gaveUp: boolean } | null }) {
  const elapsed = useElapsed(wait?.since, !!wait);
  if (wait?.gaveUp) {
    return (
      <p className="text-sm text-ink-soft" role="status">
        <span className="font-bold text-ink">The review is taking longer than usual.</span> Open this page again in a minute or two to see it.
      </p>
    );
  }
  return (
    <div role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold">{npcName} is reading back your conversation to write the review…</span>
        {wait && <span className="text-xs font-bold tabular-nums text-ink-soft">{clock(elapsed)}</span>}
      </div>
      <ProgressBar label={`${npcName}'s review`} className="mt-2" />
      <p className="mt-2 text-xs text-ink-soft">ElevenLabs Agents analyses the real conversation once it has ended. It usually takes under a minute; the rest of your results are already here.</p>
      <div className="mt-4 space-y-2" aria-hidden>
        <div className="shimmer h-3 w-11/12 rounded-full bg-ink/10" />
        <div className="shimmer h-3 w-4/5 rounded-full bg-ink/10" />
        <div className="shimmer h-3 w-2/3 rounded-full bg-ink/10" />
      </div>
    </div>
  );
}

/** ElevenAgents post-call analysis: evaluation criteria + data collection, written from the NPC's side. */
export function AgentReview({
  analysis,
  npcName,
  pending,
  wait,
}: {
  analysis: AgentAnalysis | null;
  npcName: string;
  /** The session has a conversation to analyse. */
  pending: boolean;
  wait?: { since: number; gaveUp: boolean } | null;
}) {
  if (!pending) return <p className="text-sm text-ink-soft">No agent analysis for this session.</p>;
  if (analysis?.status === "failed") {
    return <p className="text-sm text-ink-soft">ElevenLabs couldn&apos;t analyse this conversation, so there&apos;s no review this time.</p>;
  }
  if (!analysis || analysis.status !== "done") return <ReviewWaiting npcName={npcName} wait={wait} />;
  const d = analysis.data;
  const strengths = items(d.strengths?.value);
  const improvements = items(d.improvements?.value);
  const errors = items(d.learner_errors?.value);
  const expressions = items(d.key_expressions?.value);
  const translations = items(d.npc_translations?.value);

  return (
    <div className="space-y-5">
      {analysis.summary && <p className="text-[15px] leading-relaxed text-ink">{withoutEmDashes(analysis.summary)}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {analysis.criteria.map((c) => {
          const numeric = c.score != null && c.maxScore;
          const value = numeric ? Math.round((c.score! / c.maxScore!) * 100) : null;
          const s = numeric ? statusFor(value) : null;
          const ok = c.result === "success";
          return (
            <div key={c.id} className="rounded-xl bg-white/70 p-3">
              <div className="text-xs font-bold text-ink-soft">{CRITERIA_NAMES[c.id] ?? c.name ?? c.id}</div>
              {numeric ? (
                <div className="text-2xl font-bold text-ink">
                  {value}
                  <span className="text-sm font-normal text-ink-soft"> / 100</span>
                  {s && (
                    <span className="ml-2 text-xs font-bold text-ink-soft">
                      {s.icon} {s.label}
                    </span>
                  )}
                </div>
              ) : (
                <div className={`text-lg font-bold ${ok ? "text-[#0a7a0a]" : c.result === "failure" ? "text-[#a52b2b]" : "text-ink-soft"}`}>
                  {ok ? "✓ Yes" : c.result === "failure" ? "✗ No" : "? Unknown"}
                </div>
              )}
              <p className="mt-1 text-xs leading-snug text-ink-soft">{c.rationale && withoutEmDashes(c.rationale)}</p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {strengths.length > 0 && (
          <div>
            <h4 className="mb-1 font-bold">What {npcName} noticed you did well</h4>
            <ul className="space-y-1 text-sm">
              {strengths.map((s, i) => (
                <li key={i}>✓ {s.a}</li>
              ))}
            </ul>
          </div>
        )}
        {improvements.length > 0 && (
          <div>
            <h4 className="mb-1 font-bold">Suggestions</h4>
            <ul className="space-y-1 text-sm">
              {improvements.map((s, i) => (
                <li key={i}>→ {s.a}</li>
              ))}
            </ul>
          </div>
        )}
        {errors.length > 0 && (
          <div>
            <h4 className="mb-1 font-bold">Corrections</h4>
            <ul className="space-y-1 text-sm">
              {errors.map((s, i) => (
                <li key={i} className="font-jp">
                  <span className="text-[#a52b2b] line-through decoration-1">{s.a}</span>
                  {s.b && <span> → {s.b}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {expressions.length > 0 && (
          <div>
            <h4 className="mb-1 font-bold">Key expressions from this conversation</h4>
            <ul className="space-y-1 text-sm">
              {expressions.map((s, i) => (
                <li key={i}>
                  <span className="font-jp font-bold">{s.a}</span>
                  {s.b && <span className="text-ink-soft">: {s.b}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {translations.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-ink-soft">Everything {npcName} said, translated</summary>
          <ol className="mt-2 space-y-1.5 text-sm">
            {translations.map((t, i) => (
              <li key={i}>
                <span className="font-jp">{t.a}</span>
                {t.b && <span className="block text-ink-soft italic">{t.b}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

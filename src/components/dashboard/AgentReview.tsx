import type { AgentAnalysis } from "@/lib/session/types";
import { statusFor } from "./ScoreTile";

function items(value: unknown): { a: string; b?: string }[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, ...rest] = s.split("=>");
      return { a: a.trim(), b: rest.join("=>").trim() || undefined };
    });
}

const CRITERIA_NAMES: Record<string, string> = {
  objective_completed: "Objective completed",
  comprehension: "Comprehension",
  target_language_use: "Target-language use",
  register: "Politeness & register",
};

/** ElevenAgents post-call analysis: evaluation criteria + data collection, written from the NPC's side. */
export function AgentReview({ analysis, npcName, pending }: { analysis: AgentAnalysis | null; npcName: string; pending: boolean }) {
  if (!analysis || analysis.status === "unavailable") {
    return (
      <p className="text-sm text-ink-soft">
        {pending ? "Waiting for ElevenLabs to finish analysing the conversation…" : "No agent analysis for this session."}
      </p>
    );
  }
  if (analysis.status !== "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/40 border-t-transparent" />
        ElevenLabs Agents is analysing the conversation (status: {analysis.status}). This usually takes under a minute…
      </div>
    );
  }
  const d = analysis.data;
  const strengths = items(d.strengths?.value);
  const improvements = items(d.improvements?.value);
  const errors = items(d.learner_errors?.value);
  const expressions = items(d.key_expressions?.value);
  const translations = items(d.npc_translations?.value);

  return (
    <div className="space-y-5">
      {analysis.summary && <p className="text-[15px] leading-relaxed text-ink">{analysis.summary}</p>}
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
              <p className="mt-1 text-xs leading-snug text-ink-soft">{c.rationale}</p>
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
                  {s.b && <span className="text-ink-soft"> — {s.b}</span>}
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

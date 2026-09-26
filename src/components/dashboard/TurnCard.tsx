"use client";

import { turnAudioUrl } from "@/lib/client/api";
import type { ReferenceTiming, TurnSpeechMetrics } from "@/lib/evaluation/speech";
import { GENERIC_INTENTS, type ResponseMode, type ScenarioDef } from "@/lib/scenarios/types";
import type { LearnerTurn } from "@/lib/session/types";
import { PlayButton } from "./PlayButton";
import { RhythmChart } from "./RhythmChart";

const OUTCOME: Record<string, { icon: string; label: string; cls: string }> = {
  advance: { icon: "✓", label: "Moved the scene forward", cls: "bg-[#0ca30c]/12 text-[#0a7a0a]" },
  complete: { icon: "★", label: "Finished the scene", cls: "bg-[#0ca30c]/12 text-[#0a7a0a]" },
  info: { icon: "✓", label: "Got a useful answer", cls: "bg-[#0ca30c]/12 text-[#0a7a0a]" },
  branch: { icon: "↪", label: "The situation changed", cls: "bg-[#2a78d6]/12 text-[#1f5ea8]" },
  learner_clarify: { icon: "↺", label: "You asked for clarification", cls: "bg-[#2a78d6]/12 text-[#1f5ea8]" },
  clarify: { icon: "✗", label: "Not understood", cls: "bg-[#d03b3b]/12 text-[#a52b2b]" },
};

function intentLabel(scenario: ScenarioDef, id?: string) {
  if (!id) return "—";
  return scenario.intents[id] ?? GENERIC_INTENTS[id] ?? id;
}

function fmt(n: number | null | undefined, digits = 1) {
  return n == null ? "—" : n.toFixed(digits);
}

export function TurnCard({
  mode,
  turn,
  metrics,
  scenario,
  sessionId,
  reference,
  referenceState,
  referenceUrl,
}: {
  mode: ResponseMode;
  turn: LearnerTurn;
  metrics: TurnSpeechMetrics;
  scenario: ScenarioDef;
  sessionId: string;
  reference: ReferenceTiming | null | undefined;
  referenceState: "none" | "loading" | "unavailable" | "ready";
  referenceUrl?: () => Promise<string>;
}) {
  const lang = scenario.language;
  const o = turn.outcome ? OUTCOME[turn.outcome.kind] : null;
  const words = turn.stt?.words ?? [];
  const joiner = lang === "ja" ? "" : " ";
  const hintsUsed = turn.hints.length ? Math.max(...turn.hints) : 0;
  const text = mode === "text";

  return (
    <article className="rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-widest text-brand">
          Turn {turn.index + 1} · {turn.stageGroup}
        </div>
        {o ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${o.cls}`}>
            <span aria-hidden className="mr-1">
              {o.icon}
            </span>
            {o.label}
          </span>
        ) : (
          <span className="rounded-full bg-ink/10 px-2.5 py-1 text-xs font-bold text-ink-soft">Not evaluated</span>
        )}
      </header>

      {turn.npcPrompt && (
        <div className="mt-3 border-l-4 border-ink/15 pl-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{scenario.npc.name} said</div>
          <div className="font-jp text-lg" lang={lang}>
            {turn.npcPrompt}
          </div>
          <div className="text-sm italic text-ink-soft">{turn.npcPromptMeaning}</div>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{text ? "You wrote" : "You said"}</div>
          <p className="font-jp text-lg leading-relaxed" lang={lang}>
            {words.length
              ? words.map((w, i) => {
                  const low = w.confidence != null && w.confidence < 0.55;
                  return (
                    <span key={i}>
                      <span
                        className={low ? "rounded bg-[#fab219]/30 underline decoration-[#d03b3b] decoration-wavy underline-offset-4" : ""}
                        title={w.confidence != null ? `Recognised with ${Math.round(w.confidence * 100)}% confidence` : undefined}
                      >
                        {w.text}
                      </span>
                      {i < words.length - 1 ? joiner : ""}
                    </span>
                  );
                })
              : metrics.transcript || <span className="text-ink-soft">(no transcript)</span>}
          </p>
          {/* Older Voice Mode sessions could mix in typed replies. */}
          {!text && turn.inputMethod === "text" && <div className="text-xs font-bold text-ink-soft">⌨ typed, not spoken</div>}
          {metrics.lowConfidenceWords.length > 0 && (
            <div className="mt-1 text-xs text-ink-soft">
              <span className="font-bold text-[#a52b2b]">Hard to recognise:</span> {metrics.lowConfidenceWords.join(" · ")}
            </div>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          <div>
            <span className="font-bold text-ink-soft">You wanted to: </span>
            {turn.expected ? `${turn.expected.label}` : text ? "(wrote freely)" : "(spoke freely)"}
          </div>
          <div>
            <span className="font-bold text-ink-soft">{scenario.npc.name} understood: </span>
            {intentLabel(scenario, turn.outcome?.intent ?? turn.report?.intent)}
            {turn.outcome?.intentMatched === true && <span className="ml-1 font-bold text-[#0a7a0a]">✓ match</span>}
            {turn.outcome?.intentMatched === false && <span className="ml-1 font-bold text-[#a52b2b]">≠ not what you meant</span>}
          </div>
          {turn.outcome?.note && <div className="rounded-lg bg-ink/5 px-2 py-1 text-[13px]">{turn.outcome.note}</div>}
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            {hintsUsed > 0 && <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold">💡 hint level {hintsUsed}</span>}
            {turn.repeats > 0 && <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold">🔁 ×{turn.repeats}</span>}
            {turn.slows > 0 && <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold">🐢 ×{turn.slows}</span>}
            {turn.translations > 0 && <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold">EN ×{turn.translations}</span>}
            {!hintsUsed && !turn.repeats && !turn.slows && !turn.translations && (text || turn.inputMethod === "voice") && (
              <span className="rounded-full bg-[#0ca30c]/12 px-2 py-0.5 font-bold text-[#0a7a0a]">✓ no help used</span>
            )}
          </div>
        </div>
      </div>

      {/* Speech analytics: Voice Mode only (Text Mode has no audio to measure). */}
      {!text && metrics.hasSpeech && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          {[
            ["Started after", `${fmt(metrics.latency)}s`],
            ["Pace vs native", metrics.rateRatio == null ? "—" : `${Math.round(metrics.rateRatio * 100)}%`],
            ["Pauses > 0.45s", String(metrics.pauses)],
            ["Recognition clarity", metrics.clarity == null ? "—" : `${Math.round(metrics.clarity * 100)}%`],
            ["Like the model phrase", metrics.similarity == null ? "—" : `${Math.round(metrics.similarity * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink/5 px-2 py-1.5">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="text-base font-bold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {((!text && turn.audio?.uploaded) || turn.expected) && (
        <div className="mt-4 rounded-xl bg-white/70 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold text-ink-soft">{text ? "Model phrase:" : "Compare:"}</span>
            {turn.expected && referenceUrl && <PlayButton getSrc={referenceUrl} label="Native reference" tone="native" />}
            {!text && turn.audio?.uploaded && <PlayButton src={turnAudioUrl(sessionId, turn.id)} label="Your recording" tone="learner" />}
            {turn.expected && (
              <span className="font-jp text-sm text-ink-soft" lang={lang}>
                “{turn.expected.reference}”
              </span>
            )}
          </div>
          {!text && metrics.hasSpeech && <RhythmChart native={reference?.segments ?? null} nativeState={referenceState} learner={metrics.segments} />}
        </div>
      )}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-bold text-ink-soft">Turn data</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <tbody className="[&_td]:border-t [&_td]:border-ink/10 [&_td]:py-1 [&_td]:pr-3 [&_td]:align-top">
            <tr><td className="font-bold">Turn ID</td><td>{turn.id}</td></tr>
            <tr><td className="font-bold">Start → end</td><td>{new Date(turn.startedAt).toLocaleTimeString()} → {turn.endedAt ? new Date(turn.endedAt).toLocaleTimeString() : "—"}</td></tr>
            <tr><td className="font-bold">NPC prompt</td><td className="font-jp">{turn.npcPrompt || "—"}</td></tr>
            <tr><td className="font-bold">Expected intent</td><td>{turn.expected ? `${turn.expected.intent} (${turn.expected.label})` : "free response"}</td></tr>
            <tr><td className="font-bold">Detected intent</td><td>{turn.report?.intent ?? "—"} · answered question: {String(turn.report?.answered_question ?? "—")} · language: {turn.report?.language ?? "—"}</td></tr>
            <tr><td className="font-bold">Task progress</td><td>{turn.outcome ? `${turn.outcome.kind} → ${turn.outcome.nextStageId} (success: ${turn.outcome.success})` : "—"}</td></tr>
            <tr><td className="font-bold">Agent transcript</td><td className="font-jp">{turn.transcriptAgent ?? "—"}</td></tr>
            <tr><td className="font-bold">Scribe transcript</td><td className="font-jp">{turn.stt ? `${turn.stt.transcript} (${turn.stt.model}, ${turn.stt.languageCode} ${Math.round(turn.stt.languageProbability * 100)}%)` : "—"}</td></tr>
            <tr><td className="font-bold">Word timestamps</td><td className="font-jp">{words.length ? words.map((w) => `${w.text} ${w.start.toFixed(2)}–${w.end.toFixed(2)}s${w.confidence != null ? ` (${Math.round(w.confidence * 100)}%)` : ""}`).join(" · ") : "—"}</td></tr>
            <tr><td className="font-bold">Hints used</td><td>{turn.hints.length ? turn.hints.join(", ") : "none"}</td></tr>
            <tr><td className="font-bold">Repeats / slow</td><td>{turn.repeats} / {turn.slows}</td></tr>
            <tr><td className="font-bold">Raw audio</td><td>{turn.audio ? `${turn.audio.mimeType}, ${(turn.audio.durationMs / 1000).toFixed(1)}s${turn.audio.uploaded ? "" : " (not uploaded)"}` : "—"}</td></tr>
          </tbody>
        </table>
      </details>
    </article>
  );
}

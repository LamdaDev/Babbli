"use client";

import { Avatar } from "@/components/profile/Avatar";
import { Pin } from "@/components/profile/Pin";
import { Flag } from "@/components/ui/Flag";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStage } from "@/lib/engine/engine";
import { api, turnAudioUrl, type TtsResult } from "@/lib/client/api";
import { useProfile, useProgress } from "@/lib/client/profileStore";
import { buildReport } from "@/lib/evaluation/scoring";
import { referenceTiming, type ReferenceTiming } from "@/lib/evaluation/speech";
import { withoutEmDashes } from "@/lib/evaluation/text";
import { badgeDef } from "@/lib/profile/badges";
import { coachVoiceKey, displayName, pronounsOf } from "@/lib/profile/profile";
import { getScenario } from "@/lib/scenarios";
import { DIFFICULTIES, type Difficulty } from "@/lib/scenarios/types";
import { responseModeOf, type AgentAnalysis, type SessionRecord } from "@/lib/session/types";
import { AgentReview } from "./AgentReview";
import { PlayButton } from "./PlayButton";
import { ScoreTile } from "./ScoreTile";
import { SpeechAnalytics } from "./SpeechAnalytics";
import { TurnCard } from "./TurnCard";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NEXT: Record<Difficulty, Difficulty | null> = { beginner: "intermediate", intermediate: "immersion", immersion: null };

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Dashboard({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, { timing: ReferenceTiming | null; tts: TtsResult } | null>>({});
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [sttStatus, setSttStatus] = useState<{ done: number; total: number } | null>(null);
  const refsStarted = useRef(new Set<string>());
  const profile = useProfile();
  const progress = useProgress();

  useEffect(() => {
    api
      .session(sessionId)
      .then((s) => {
        setSession(s);
        if (s.analysis) setAnalysis(s.analysis);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [sessionId]);

  const scenario = session ? getScenario(session.scenarioId) : undefined;

  // ElevenLabs Scribe analysis for recordings not transcribed yet: Live mode leaves it to this page,
  // so scenes nobody looks at never pay for it. Saved afterwards, so it only runs once per session.
  useEffect(() => {
    if (!session || !scenario) return;
    const missing = session.turns.filter((t) => t.audio?.uploaded && !t.stt && t.inputMethod === "voice");
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      setSttStatus({ done: 0, total: missing.length });
      const updated: SessionRecord = { ...session, turns: session.turns.map((t) => ({ ...t })) };
      let done = 0;
      const queue = [...missing];
      const worker = async () => {
        while (queue.length && !cancelled) {
          const t = queue.shift()!;
          try {
            const blob = await fetch(turnAudioUrl(session.id, t.id)).then((r) => r.blob());
            // Same keyterms the scene used for this reply.
            const keyterms = Array.from(new Set([...(t.expected?.keywords ?? []), ...scenario.asrKeywords])).slice(0, 40);
            const stt = await api.stt(blob, scenario.language, keyterms);
            const target = updated.turns.find((x) => x.id === t.id);
            if (target) target.stt = stt;
          } catch (e) {
            console.warn("[babbli] backfill STT failed", e);
          }
          done++;
          if (!cancelled) setSttStatus({ done, total: missing.length });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (cancelled) return;
      setSession(updated);
      setSttStatus(null);
      void api.saveSession(updated).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, scenario]);

  // Native reference audio (ElevenLabs TTS with timestamps) for every model phrase the learner attempted.
  useEffect(() => {
    if (!session || !scenario) return;
    const phrases = Array.from(new Set(session.turns.map((t) => t.expected?.reference).filter((p): p is string => !!p)));
    for (const p of phrases) {
      if (refsStarted.current.has(p)) continue;
      refsStarted.current.add(p);
      api
        .tts(p, `coach_${scenario.language}`, 1)
        .then((tts) => setRefs((r) => ({ ...r, [p]: { tts, timing: referenceTiming(tts.alignment, p, scenario.language) } })))
        .catch(() => setRefs((r) => ({ ...r, [p]: null })));
    }
  }, [session, scenario]);

  // ElevenAgents post-call analysis arrives asynchronously — poll until it's done.
  useEffect(() => {
    if (!session?.conversationId || analysis?.status === "done") return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      tries++;
      try {
        const a = await api.analysis(session.id);
        setAnalysis(a);
        if (a.status === "done" || a.status === "failed") return;
      } catch {
        /* keep trying */
      }
      if (tries < 30) timer = setTimeout(poll, 6000);
    };
    void poll();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.conversationId]);

  const report = useMemo(() => {
    if (!session || !scenario) return null;
    const timings: Record<string, ReferenceTiming | null> = {};
    for (const [k, v] of Object.entries(refs)) timings[k] = v?.timing ?? null;
    return buildReport(session, scenario, timings, analysis);
  }, [session, scenario, refs, analysis]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-page p-6 text-ink">
        <div className="text-center">
          <div className="font-display text-2xl">Session not found</div>
          <p className="mt-2 text-ink-soft">{error}</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2 font-bold text-cream">
            Home
          </Link>
        </div>
      </main>
    );
  }
  if (!session || !scenario || !report) {
    return <main className="grid min-h-dvh place-items-center bg-page text-ink-soft">Loading your session…</main>;
  }

  const diff = DIFFICULTIES.find((d) => d.id === session.difficulty)!;
  const next = NEXT[session.difficulty];
  const mode = responseModeOf(session);
  const text = mode === "text";
  // Retries keep the way the learner chose to respond.
  const playHref = (difficulty: Difficulty) =>
    `/play/${scenario.id}?difficulty=${difficulty}&respond=${mode}${text ? "" : `&mode=${session.inputMode}`}`;
  const turns = session.turns.filter((t) => report.metrics[t.id]);
  const reached = getStage(scenario, session.state.stageId).group;
  // Native playback uses the coach voice chosen in the profile; the scores keep the standard coach's timing.
  const coach = coachVoiceKey(scenario.language, profile.coachVoice);
  // Only a session played on this device shows the traveler and the pins it unlocked.
  const mine = progress.stamps.some((s) => s.sessionId === session.id);
  const unlocked = progress.unlocked.filter((u) => u.sessionId === session.id);
  const name = displayName(profile);
  const mins = Math.floor(report.completion.durationSec / 60);
  const secs = report.completion.durationSec % 60;

  return (
    <main className="min-h-dvh bg-page pb-20 text-ink">
      <div className="bg-navy text-cream">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <div className="flex items-center justify-between text-sm">
            <Link href="/" className="font-bold text-cream/80 hover:text-cream">
              ← Babbli
            </Link>
            <span className="text-cream/60">
              {new Date(session.startedAt).toLocaleString()} · {mins}m {secs}s
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              {mine && (
                <Link href="/profile" title="Your Traveler Profile" className="hidden shrink-0 rounded-full ring-4 ring-white/10 sm:block">
                  <Avatar look={profile.avatar} size={84} label={`${name}'s avatar`} />
                </Link>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="text-xs font-black tracking-[0.2em] text-gold">
                    <Flag code={scenario.language} /> {scenario.locationLabel} · {diff.label.toUpperCase()}
                  </div>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-cream">{text ? "⌨ Text Session" : "🎙 Voice Session"}</span>
                </div>
                <h1 className="mt-1 font-display text-4xl">{scenario.title}</h1>
                <p className="mt-1 text-cream/70">
                  {mine ? `${name}'s visit · ` : ""}
                  {scenario.objective}
                </p>
              </div>
            </div>
            <div
              className={`rounded-2xl px-5 py-3 text-lg font-bold ${report.completion.objectiveComplete ? "bg-[#0ca30c] text-white" : "bg-gold text-ink"}`}
              role="status"
            >
              {report.completion.objectiveComplete ? "✓ Objective complete" : `○ Not completed (reached “${reached}”)`}
            </div>
          </div>
          <div className="mt-4 text-sm text-cream/70">
            {report.completion.stagesDone} of {report.completion.stagesTotal} steps · {report.counts.turns} replies · {report.counts.missed} missed ·{" "}
            {report.counts.recoveries} recovered
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5">
        {sttStatus && (
          <div className="mt-6 rounded-xl bg-[#2a78d6]/10 px-4 py-2 text-sm font-bold text-[#1f5ea8]">
            Analysing your recordings with ElevenLabs Scribe… {sttStatus.done}/{sttStatus.total}
          </div>
        )}

        {mine && unlocked.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gold/15 px-5 py-4 ring-1 ring-gold/40">
            <div className="flex -space-x-2">
              {unlocked.map((u) => (
                <Pin key={u.id} id={u.id} size={44} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg">
                New in {name}&apos;s passport: {unlocked.map((u) => badgeDef(u.id).name).join(", ")}
              </div>
              <p className="text-sm text-ink-soft">
                {capitalize(pronounsOf(profile).subject)} can wear {unlocked.length === 1 ? "it" : "them"} on {name === "Traveler" ? "the" : `${name}'s`} avatar. Pins are just for
                fun: they never change a score.
              </p>
            </div>
            <Link href="/profile" className="rounded-full bg-paper px-4 py-2 text-sm font-bold ring-1 ring-ink/10 transition hover:ring-brand/40">
              See your pins →
            </Link>
          </div>
        )}

        <Section
          title="How you did"
          subtitle={
            !report.completion.objectiveComplete
              ? undefined
              : text
                ? "Five signals measured from your written replies. Understanding the scene is scored separately from how accurately you wrote."
                : "Five separate signals. Understanding what was said is scored separately from how clearly you said it."
          }
        >
          {/* Scores only mean something for a finished scene. */}
          {!report.completion.objectiveComplete ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-paper p-6 shadow-sm ring-1 ring-ink/5" role="status">
              <div className="flex items-start gap-4">
                <span className="text-3xl" aria-hidden>
                  🔒
                </span>
                <div>
                  <div className="font-display text-xl">Session incomplete</div>
                  <p className="mt-0.5 text-ink-soft">
                    Full results will appear when you complete the session. You reached “{reached}” (step {report.completion.stagesDone} of{" "}
                    {report.completion.stagesTotal}).
                  </p>
                </div>
              </div>
              <Link href={playHref(session.difficulty)} className="rounded-2xl bg-brand px-5 py-3 font-display text-lg text-white transition-colors hover:bg-brand-dark">
                Try again →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {report.scores.map((s) => (
                  <ScoreTile key={s.id} label={s.label} score={s} method={s.method} />
                ))}
              </div>
              {/* Voice Mode only: the report has no speech stats for text sessions. */}
              {report.speech && (
                <div className="mt-4">
                  <SpeechAnalytics stats={report.speech} />
                </div>
              )}
              {report.notApplicable.length > 0 && (
                <p className="mt-3 rounded-xl bg-ink/5 px-4 py-2.5 text-sm text-ink-soft">
                  <span className="font-bold text-ink">Not measured in Text Mode:</span> {report.notApplicable.map((m) => m.label).join(" · ")} (pace, pauses,
                  filler words, response time). These need a voice recording, so they aren&apos;t scored and don&apos;t count toward anything here.
                </p>
              )}
            </>
          )}
        </Section>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <h3 className="font-display text-lg">✓ Handled well</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.handledWell.length ? report.handledWell.map((x) => <li key={x}>{withoutEmDashes(x)}</li>) : <li className="text-ink-soft">Keep going. Every attempt counts.</li>}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <h3 className="font-display text-lg">! Struggled with</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.struggledWith.length ? report.struggledWith.map((x) => <li key={x}>{withoutEmDashes(x)}</li>) : <li className="text-ink-soft">Nothing major. Nice work!</li>}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <h3 className="font-display text-lg">→ Next time</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.nextTime.length ? report.nextTime.map((x) => <li key={x}>{withoutEmDashes(x)}</li>) : <li className="text-ink-soft">Try a harder difficulty or another city.</li>}
            </ul>
          </div>
        </div>

        <Section title={`${scenario.npc.name}'s review`} subtitle="Written by ElevenLabs Agents' post-call analysis of the real conversation.">
          <div className="rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5">
            <AgentReview analysis={analysis} npcName={scenario.npc.name} pending={!!session.conversationId} />
          </div>
        </Section>

        <Section
          title="Replay the conversation"
          subtitle={
            text
              ? "Every reply with what you wrote, what was understood, the help you used, and the model phrase to listen to."
              : "Every reply with what was heard, what was understood, the help you used, and native-vs-you timing."
          }
        >
          <div className="space-y-4">
            {turns.length ? (
              turns.map((t) => {
                const ref = t.expected ? refs[t.expected.reference] : undefined;
                return (
                  <TurnCard
                    key={t.id}
                    mode={mode}
                    turn={t}
                    metrics={report.metrics[t.id]}
                    scenario={scenario}
                    sessionId={session.id}
                    reference={ref?.timing}
                    referenceState={!t.expected ? "none" : ref === undefined ? "loading" : ref === null || !ref.timing ? "unavailable" : "ready"}
                    referenceUrl={
                      t.expected
                        ? async () => (profile.coachVoice === "standard" ? ref?.tts.url : undefined) ?? (await api.tts(t.expected!.reference, coach, 1)).url
                        : undefined
                    }
                  />
                );
              })
            ) : (
              <p className="text-ink-soft">No replies were recorded in this session.</p>
            )}
          </div>
        </Section>

        <Section title="Vocabulary & expressions" subtitle="What came up in this scene. ✓ marks the ones you used yourself.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.vocabulary.map((v) => (
              <div key={v.term} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 shadow-sm ring-1 ring-ink/5">
                <div>
                  <div className="font-jp text-lg font-bold" lang={scenario.language}>
                    {v.term} {v.used && <span className="align-middle text-xs font-bold text-[#0a7a0a]">✓ used</span>}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {v.reading ? `${v.reading} · ` : ""}
                    {v.meaning}
                  </div>
                </div>
                <PlayButton label="Hear" getSrc={async () => (await api.tts(v.term.split(" / ")[0], coach, 0.95)).url} />
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={playHref(session.difficulty)} className="rounded-2xl bg-ink px-5 py-3 font-display text-lg text-cream">
            Try again
          </Link>
          {next && (
            <Link href={playHref(next)} className="rounded-2xl bg-brand px-5 py-3 font-display text-lg text-white transition-colors hover:bg-brand-dark">
              Try {DIFFICULTIES.find((d) => d.id === next)!.label} →
            </Link>
          )}
          <Link href="/" className="rounded-2xl border-2 border-ink/15 px-5 py-3 font-display text-lg">
            Another city
          </Link>
        </div>
      </div>
    </main>
  );
}

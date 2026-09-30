"use client";

import { useRef, useState } from "react";
import type { SpeechStats } from "@/lib/evaluation/scoring";
import { FLUENCY_SOURCE, SPEECH_HEURISTICS } from "@/lib/evaluation/sources";
import { LEARNER, NATIVE } from "./RhythmChart";

/*
 * Voice Mode speech analytics: two compact visuals built on the same ElevenLabs Scribe word timings
 * as the scores. Never rendered for Text Mode (the report has no speech stats there).
 */

const fmt = (n: number | null, digits = 1) => (n === null ? "n/a" : n.toFixed(digits));
const card = "rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5";

/** A tiny hover/focus tooltip for chart marks. */
function useTooltip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const bind = (text: string) => ({
    tabIndex: 0,
    "aria-label": text,
    onMouseEnter: (e: React.MouseEvent) => place(e.currentTarget, text),
    onFocus: (e: React.FocusEvent) => place(e.currentTarget, text),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const place = (el: Element, text: string) => {
    const b = box.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (b) setTip({ x: r.left + r.width / 2 - b.left, y: r.top - b.top, text });
  };
  const layer = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-cream shadow-lg"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      {tip.text}
    </div>
  );
  return { box, bind, layer };
}

/* ------------------------------------------------------------------ */
/* 1. Filler words                                                     */
/* ------------------------------------------------------------------ */

function FillerChart({ stats, lang }: { stats: SpeechStats; lang?: string }) {
  const { box, bind, layer } = useTooltip();
  const top = stats.fillers.slice(0, 5);
  const rest = stats.fillers.slice(5).reduce((s, f) => s + f.count, 0);
  const rows = rest ? [...top, { label: "other", count: rest }] : top;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className={card}>
      <h3 className="font-display text-lg text-ink">Filler words</h3>
      <p className="text-sm text-ink-soft">
        {stats.fillerCount === 0 ? (
          "No hesitation fillers detected."
        ) : (
          <>
            <b className="text-ink">{stats.fillerCount}</b> {stats.fillerCount === 1 ? "filler" : "fillers"} ·{" "}
            <b className="text-ink">{fmt(stats.fillersPerMin)}</b> per minute of speaking
          </>
        )}
      </p>
      {rows.length > 0 && (
        <div ref={box} className="relative mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 rounded-md outline-none ring-brand/40 focus-visible:ring-2" {...bind(`“${r.label}”: ${r.count} ${r.count === 1 ? "time" : "times"}`)}>
              <span className="w-20 shrink-0 truncate text-right font-jp text-sm font-bold text-ink" lang={lang}>
                {r.label}
              </span>
              <span className="h-3 flex-1">
                <span className="block h-3 rounded-r-[4px]" style={{ width: `${(r.count / max) * 100}%`, background: LEARNER }} />
              </span>
              <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-ink">{r.count}</span>
            </div>
          ))}
          {layer}
        </div>
      )}
      {/* A table ignores sr-only's 1px width (and widens the page on phones), so a div hides it. */}
      <div className="sr-only">
        <table>
          <caption>Filler words by count</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-snug text-ink-soft">
        Hesitation sounds (um, uh, euh, えっと…) always count. Words that are also ordinary words (like, so, este, あの) count only when they stand
        alone between pauses.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Fluency breakdown                                                */
/* ------------------------------------------------------------------ */

/** One row of dots on a seconds axis: every pause, or every reply's response time. */
function DotStrip({ points, unit, label, bind }: { points: { turn: number; value: number }[]; unit: string; label: (p: { turn: number; value: number }) => string; bind: ReturnType<typeof useTooltip>["bind"] }) {
  const maxV = Math.max(2, Math.ceil(Math.max(...points.map((p) => p.value), 0)));
  const mean = points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : null;
  const x = (v: number) => `${(v / maxV) * 100}%`;
  return (
    <div className="mt-1.5">
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-ink/10" />
        {mean !== null && <div className="absolute top-0 h-5 w-0.5 rounded bg-ink/40" style={{ left: x(mean) }} aria-hidden />}
        {points.map((p, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none ring-2 ring-paper focus-visible:ring-brand"
            style={{ left: x(p.value), background: LEARNER }}
            {...bind(label(p))}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-ink-soft">
        <span>0 {unit}</span>
        {mean !== null && <span>│ = average</span>}
        <span>
          {maxV} {unit}
        </span>
      </div>
    </div>
  );
}

function FluencyBreakdown({ stats }: { stats: SpeechStats }) {
  const { box, bind, layer } = useTooltip();
  const unit = stats.unit === "characters" ? "characters/min" : "syllables/min";
  const rates = [
    { who: "You", value: stats.speechRate, color: LEARNER },
    ...(stats.nativeRate !== null ? [{ who: "Native model phrases", value: stats.nativeRate, color: NATIVE }] : []),
  ];
  const maxRate = Math.max(1, ...rates.map((r) => r.value ?? 0)) * 1.08;
  return (
    <div className={card}>
      <h3 className="font-display text-lg text-ink">Fluency breakdown</h3>
      <p className="text-sm text-ink-soft">Speaking rate, pauses and response time across your spoken replies.</p>
      <div ref={box} className="relative mt-3 space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-ink">Speaking rate</span>
            <span className="text-ink-soft">
              <b className="text-ink">{fmt(stats.speechRate, 0)}</b> {unit}
            </span>
          </div>
          {rates.length > 1 && (
            <div className="mt-1 flex gap-3 text-[11px] text-ink-soft" aria-hidden>
              {rates.map((r) => (
                <span key={r.who} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
                  {r.who}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 space-y-1.5">
            {rates.map((r) => (
              <div key={r.who} className="flex items-center gap-2 rounded-md outline-none ring-brand/40 focus-visible:ring-2" {...bind(`${r.who}: ${fmt(r.value, 0)} ${unit}`)}>
                <span className="h-3 flex-1">
                  <span className="block h-3 rounded-r-[4px]" style={{ width: `${((r.value ?? 0) / maxRate) * 100}%`, background: r.color }} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-ink">{fmt(r.value, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-ink">Pauses</span>
            <span className="text-ink-soft">
              <b className="text-ink">{fmt(stats.pausesPerMin)}</b>/min · avg <b className="text-ink">{fmt(stats.avgPause, 2)} s</b> · longest{" "}
              <b className="text-ink">{fmt(stats.longestPause, 2)} s</b>
            </span>
          </div>
          {stats.pauses.length ? (
            <DotStrip points={stats.pauses} unit="s" bind={bind} label={(p) => `Reply ${p.turn}: ${p.value.toFixed(2)} s pause`} />
          ) : (
            <p className="mt-1 text-xs text-ink-soft">No pauses of {SPEECH_HEURISTICS.pauseSeconds} s or more.</p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-ink">Response time</span>
            <span className="text-ink-soft">
              avg <b className="text-ink">{fmt(stats.avgLatency)} s</b> before you started speaking
            </span>
          </div>
          {stats.latencies.length > 0 && <DotStrip points={stats.latencies} unit="s" bind={bind} label={(p) => `Reply ${p.turn}: started after ${p.value.toFixed(1)} s`} />}
        </div>
        {layer}
      </div>

      <div className="sr-only">
        <table>
          <caption>Fluency breakdown</caption>
          <tbody>
            <tr><th scope="row">Speaking rate ({unit})</th><td>{fmt(stats.speechRate, 0)}{stats.nativeRate !== null ? ` (native model phrases ${fmt(stats.nativeRate, 0)})` : ""}</td></tr>
            <tr><th scope="row">Pauses per minute</th><td>{fmt(stats.pausesPerMin)}</td></tr>
            <tr><th scope="row">Average pause (s)</th><td>{fmt(stats.avgPause, 2)}</td></tr>
            <tr><th scope="row">Longest pause (s)</th><td>{fmt(stats.longestPause, 2)}</td></tr>
            <tr><th scope="row">Average response time (s)</th><td>{fmt(stats.avgLatency)}</td></tr>
          </tbody>
        </table>
      </div>

      <details className="mt-4 text-xs">
        <summary className="cursor-pointer font-bold text-brand">How this is calculated</summary>
        <div className="mt-1.5 space-y-1.5 leading-snug text-ink-soft">
          <p>
            <b className="text-ink">Speaking rate</b> = {FLUENCY_SOURCE.speechRate.formula}. {FLUENCY_SOURCE.speechRate.finding}{" "}
            {FLUENCY_SOURCE.speechRate.babbliProcess} Source:{" "}
            <a href={FLUENCY_SOURCE.url} target="_blank" rel="noreferrer" className="font-bold text-brand underline">
              Kormos &amp; Dénes (2004), System 32(2)
            </a>
            .
          </p>
          <p>
            <b className="text-ink">Pauses, fillers and response time</b> are Babbli feedback, not validated measures. A pause is a silence of{" "}
            {SPEECH_HEURISTICS.pauseSeconds} s or more; response time runs from the mic opening to your first word. {FLUENCY_SOURCE.caveat}
          </p>
        </div>
      </details>
    </div>
  );
}

export function SpeechAnalytics({ stats, lang }: { stats: SpeechStats; lang?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FillerChart stats={stats} lang={lang} />
      <FluencyBreakdown stats={stats} />
    </div>
  );
}

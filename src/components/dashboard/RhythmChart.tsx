"use client";

import { useState } from "react";

export interface Segment {
  start: number;
  end: number;
  text: string;
  confidence?: number | null;
}

/** Series colors shared by the speech charts (validated pair: native vs learner). */
export const NATIVE = "#2a78d6";
export const LEARNER = "#eb6834";

/**
 * Timing comparison: speech segments of the native ElevenLabs reference vs the
 * learner recording on one shared seconds axis (both aligned to speech onset).
 */
export function RhythmChart({
  native,
  nativeState,
  learner,
}: {
  native: Segment[] | null;
  nativeState: "none" | "loading" | "unavailable" | "ready";
  learner: Segment[];
}) {
  const [hover, setHover] = useState<{ lane: string; seg: Segment; x: number } | null>(null);
  const maxT = Math.max(1, ...(native ?? []).map((s) => s.end), ...learner.map((s) => s.end));
  const W = 640;
  const LEFT = 64;
  const plotW = W - LEFT - 8;
  const x = (t: number) => LEFT + (t / maxT) * plotW;
  const step = maxT > 6 ? 2 : maxT > 3 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let t = 0; t <= maxT + 1e-6; t += step) ticks.push(Number(t.toFixed(2)));

  const lanes = [
    { key: "Native", color: NATIVE, y: 8, segs: native ?? [] },
    { key: "You", color: LEARNER, y: 42, segs: learner },
  ];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} 96`} className="w-full" role="img" aria-label="Rhythm comparison between the native reference and your recording">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={4} y2={76} stroke="#13233f" strokeOpacity={0.08} strokeWidth={1} />
            <text x={x(t)} y={90} textAnchor="middle" fontSize={10} fill="#4b5b77" style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}s
            </text>
          </g>
        ))}
        {lanes.map((lane) => (
          <g key={lane.key}>
            <line x1={4} x2={18} y1={lane.y + 13} y2={lane.y + 13} stroke={lane.color} strokeWidth={3} strokeLinecap="round" />
            <text x={22} y={lane.y + 17} fontSize={11} fontWeight={700} fill="#13233f">
              {lane.key}
            </text>
            {lane.segs.length === 0 && (
              <text x={LEFT} y={lane.y + 17} fontSize={11} fill="#4b5b77">
                {lane.key === "You" ? "No speech detected" : nativeState === "loading" ? "Loading reference…" : nativeState === "none" ? "No model phrase for this reply" : "Reference audio unavailable"}
              </text>
            )}
            {lane.segs.map((s, i) => {
              const x0 = x(s.start);
              const w = Math.max(3, x(s.end) - x0 - 2);
              const lowConf = lane.key === "You" && s.confidence != null && s.confidence < 0.55;
              return (
                <g
                  key={i}
                  tabIndex={0}
                  onPointerEnter={() => setHover({ lane: lane.key, seg: s, x: x0 + w / 2 })}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover({ lane: lane.key, seg: s, x: x0 + w / 2 })}
                  onBlur={() => setHover(null)}
                  className="cursor-default outline-none"
                >
                  <rect x={x0 - 1} y={lane.y - 2} width={w + 2} height={30} fill="transparent" />
                  <rect
                    x={x0}
                    y={lane.y + 4}
                    width={w}
                    height={18}
                    rx={4}
                    fill={lane.color}
                    opacity={hover && hover.seg === s ? 1 : lowConf ? 0.45 : 0.85}
                  />
                  {lowConf && <rect x={x0} y={lane.y + 24} width={w} height={2} rx={1} fill="#d03b3b" />}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-cream shadow-lg"
          style={{ left: `${(hover.x / W) * 100}%` }}
        >
          <div className="font-jp text-sm font-bold">{hover.seg.text}</div>
          <div className="text-cream/75">
            {hover.lane} · {hover.seg.start.toFixed(2)}–{hover.seg.end.toFixed(2)}s
            {hover.seg.confidence != null && ` · recognised ${Math.round(hover.seg.confidence * 100)}%`}
          </div>
        </div>
      )}
    </div>
  );
}

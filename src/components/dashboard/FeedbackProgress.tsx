"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";

export interface FeedbackTask {
  id: string;
  label: string;
  /** Which ElevenLabs product is doing the work. */
  by: string;
  state: "working" | "done" | "slow" | "failed";
  /** Known progress (0 to 1) and its "3 of 8"; without one the bar sweeps. */
  value?: number;
  count?: string;
  /** When the wait started, for waits with no known length (shown as elapsed time). */
  since?: number;
  /** What the learner gets when it's done, or what to do if it's slow. */
  note?: string;
}

/** Seconds since `since`, ticking while `active`. */
export function useElapsed(since: number | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || since === undefined) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active, since]);
  return since === undefined ? 0 : Math.max(0, Math.round((now - since) / 1000));
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * "Preparing your feedback": what the results page is still waiting for, each with its own progress.
 * Only shows when there is a real wait (not for a session whose feedback is already all there), says
 * so when everything is ready, then gets out of the way.
 */
export function FeedbackProgress({ tasks }: { tasks: FeedbackTask[] }) {
  const working = tasks.some((t) => t.state === "working");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(working), working ? 600 : 5000);
    return () => clearTimeout(t);
  }, [working]);
  const done = tasks.filter((t) => t.state === "done").length;

  return (
    <AnimatePresence>
      {shown && tasks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          aria-label="Preparing your feedback"
          className="mt-6 rounded-2xl bg-paper p-5 shadow-sm ring-1 ring-ink/5"
        >
          <div className="flex items-center justify-between gap-3" role="status" aria-live="polite">
            <h2 className="font-display text-lg">
              {working ? "Preparing your feedback" : done === tasks.length ? "✓ Your feedback is ready" : "Almost everything is ready"}
            </h2>
            <span className="text-xs font-bold tabular-nums text-ink-soft">
              {done} of {tasks.length} ready
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function TaskRow({ task: t }: { task: FeedbackTask }) {
  const elapsed = useElapsed(t.since, t.state === "working" || t.state === "slow");
  const icon =
    t.state === "done" ? (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-teal text-[11px] font-black text-white">✓</span>
    ) : t.state === "working" ? (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    ) : (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] font-black text-ink">!</span>
    );
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid w-5 shrink-0 place-items-center" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className={`font-bold ${t.state === "done" ? "text-ink-soft" : "text-ink"}`}>
            {t.label} <span className="font-normal text-ink-soft">· {t.by}</span>
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {t.state === "done" ? "Done" : (t.count ?? (t.since !== undefined ? clock(elapsed) : ""))}
          </span>
        </div>
        {t.state === "working" && <ProgressBar value={t.value} label={t.label} className="mt-1.5" />}
        {t.note && t.state !== "done" && <p className="mt-1 text-xs leading-snug text-ink-soft">{t.note}</p>}
      </div>
    </li>
  );
}

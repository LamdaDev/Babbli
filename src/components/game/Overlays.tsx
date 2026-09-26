"use client";

import { Flag } from "@/components/ui/Flag";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DIFFICULTIES } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";

export function BriefingOverlay() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const inputMode = useGame((s) => s.inputMode);
  const { scenario, difficulty } = controller;
  const diff = DIFFICULTIES.find((d) => d.id === difficulty)!;

  return (
    <AnimatePresence>
      {phase === "briefing" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-night/40 p-4"
        >
          <motion.div
            initial={{ y: 30, rotate: -1.5, opacity: 0 }}
            animate={{ y: 0, rotate: -0.6, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
            className="paper-grain relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-paper text-ink shadow-[0_30px_80px_rgba(0,0,0,0.5)] md:flex-row"
          >
            <div className="flex flex-col justify-between gap-4 bg-tangerine p-6 text-white md:w-56">
              <div>
                <Flag code={scenario.language} className="h-10 w-16" />
                <div className="mt-3 text-[11px] font-black tracking-[0.2em] text-white/85">{scenario.locationLabel}</div>
                <div className="mt-1 font-display text-2xl leading-tight">{scenario.title}</div>
                <div className="mt-1 text-sm text-white/85">{scenario.venueName}</div>
              </div>
              <div className="rounded-xl bg-white/15 p-3 text-sm">
                <div className="font-bold">{diff.label}</div>
                <ul className="mt-1 space-y-0.5 text-xs text-white/90">
                  {diff.details.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex-1 space-y-4 p-6 md:p-7">
              <p className="text-sm leading-relaxed text-ink-soft">{scenario.blurb}</p>
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-tangerine">Your objective</div>
                <div className="font-display text-xl leading-snug">{scenario.objective}</div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-tangerine">{scenario.briefing.title}</div>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {scenario.briefing.lines.map((l) => (
                    <li key={l}>• {l}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-tangerine">How you&apos;ll talk</div>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {(
                    [
                      ["live", "🎙 Live conversation", `${scenario.npc.name} listens in real time — just talk, pause when you're done.`],
                      ["ptt", "✋ Push-to-talk", "Take your time. Tap the mic when you've finished your sentence."],
                    ] as const
                  ).map(([mode, title, desc]) => (
                    <button
                      key={mode}
                      role="radio"
                      aria-checked={inputMode === mode}
                      onClick={() => controller.setInputMode(mode)}
                      className={`rounded-xl border-2 p-3 text-left transition ${
                        inputMode === mode ? "border-tangerine bg-white shadow-md" : "border-ink/10 bg-white/40 hover:bg-white/70"
                      }`}
                    >
                      <div className="text-sm font-extrabold">{title}</div>
                      <div className="mt-0.5 text-xs leading-snug text-ink-soft">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] leading-snug text-ink-soft">
                  Uses your microphone · <b>1–3</b> choose · <b>Space</b> talk/done · <b>H</b> hint · <b>R</b> repeat · <b>S</b> slow · <b>C</b> subtitles
                </p>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void controller.enter()}
                  className="rounded-2xl bg-ink px-6 py-3 font-display text-lg text-cream shadow-xl"
                >
                  Step inside →
                </motion.button>
              </div>
              <p className="text-[11px] text-ink-soft/80">
                {scenario.npc.name} is an ElevenLabs agent with a designed native voice; ambience &amp; sound effects are generated with ElevenLabs.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EntryCurtain() {
  const phase = useGame((s) => s.phase);
  const busyLabel = useGame((s) => s.busyLabel);
  const connecting = phase === "connecting";
  return (
    <>
      <AnimatePresence>
        {(phase === "briefing" || connecting) && (
          <>
            <motion.div
              key="l"
              initial={false}
              animate={{ x: connecting ? "-100%" : "0%" }}
              exit={{ x: "-100%" }}
              transition={{ duration: 1.3, ease: [0.7, 0, 0.3, 1], delay: connecting ? 0.2 : 0 }}
              className="pointer-events-none absolute inset-y-0 left-0 z-40 w-1/2 bg-[#1f3a6b]"
              style={{ opacity: phase === "briefing" ? 0 : 1 }}
            />
            <motion.div
              key="r"
              initial={false}
              animate={{ x: connecting ? "100%" : "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 1.3, ease: [0.7, 0, 0.3, 1], delay: connecting ? 0.2 : 0 }}
              className="pointer-events-none absolute inset-y-0 right-0 z-40 w-1/2 bg-[#1f3a6b]"
              style={{ opacity: phase === "briefing" ? 0 : 1 }}
            />
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[40%] z-40 -translate-x-1/2 rounded-full bg-night/75 px-5 py-2 text-sm font-bold text-cream backdrop-blur"
          >
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-cream border-t-transparent align-[-1px]" />
            {busyLabel ?? "Stepping inside…"}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function TransitionOverlay() {
  const text = useGame((s) => s.transitionText);
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
          transition={{ duration: 0.9 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-night/90 p-8"
        >
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }}
            className="max-w-xl text-center font-display text-2xl leading-snug text-cream sm:text-3xl"
          >
            {text}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CompletionOverlay() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const completion = useGame((s) => s.completion);
  const busyLabel = useGame((s) => s.busyLabel);
  const sessionId = useGame((s) => s.sessionId);
  const { scenario } = controller;
  return (
    <AnimatePresence>
      {(phase === "ending" || phase === "done") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-night/60 p-4 backdrop-blur-sm">
          {phase === "ending" ? (
            <div className="rounded-full bg-night/80 px-5 py-2 text-sm font-bold text-cream">{busyLabel ?? "Wrapping up…"}</div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 14 }}
              className="paper-grain w-full max-w-md rounded-3xl bg-paper p-7 text-center text-ink shadow-2xl"
            >
              <div className="text-5xl">{completion?.objectiveComplete ? "🎉" : "🚪"}</div>
              {completion?.objectiveComplete ? (
                <>
                  <div className="mt-3 font-jp text-3xl font-black" lang={scenario.language}>
                    {scenario.successTitle}
                  </div>
                  <div className="mt-1 font-display text-lg text-teal">Objective complete</div>
                </>
              ) : (
                <div className="mt-3 font-display text-2xl">Scene ended</div>
              )}
              <p className="mt-2 text-sm text-ink-soft">Your recordings, transcripts and hints are saved. See how you did — comprehension, speaking, fluency, vocabulary and independence.</p>
              <div className="mt-5 flex flex-col gap-2">
                <Link href={`/session/${sessionId}`} className="rounded-2xl bg-ink px-5 py-3 font-display text-lg text-cream">
                  See your feedback →
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => window.location.reload()} className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold">
                    Play again
                  </button>
                  <Link href="/" className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold">
                    Home
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorOverlay() {
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);
  const missingKey = error?.includes("ELEVENLABS_API_KEY");
  if (phase !== "error") return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-paper p-7 text-ink shadow-2xl">
        <div className="text-4xl">😵‍💫</div>
        <div className="mt-2 font-display text-2xl">Couldn&apos;t start the scene</div>
        <p className="mt-2 break-words rounded-xl bg-ink/5 p-3 font-mono text-xs text-ink-soft">{error}</p>
        {missingKey && (
          <p className="mt-3 text-sm">
            Add <code className="rounded bg-ink/10 px-1">ELEVENLABS_API_KEY=…</code> to <code className="rounded bg-ink/10 px-1">.env.local</code> and restart the dev server.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={() => window.location.reload()} className="flex-1 rounded-2xl bg-ink py-2.5 font-bold text-cream">
            Try again
          </button>
          <Link href="/studio" className="flex-1 rounded-2xl border-2 border-ink/15 py-2.5 text-center font-bold">
            Open Studio
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [hiddenId, setHiddenId] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setHiddenId(toast.id), 3800);
    return () => clearTimeout(t);
  }, [toast]);
  const visible = toast && toast.id !== hiddenId ? toast : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-50 flex justify-center px-4 sm:top-6">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-xl ${
              visible.tone === "warn" ? "bg-gold text-ink" : visible.tone === "good" ? "bg-teal text-white" : "bg-night/85 text-cream"
            }`}
          >
            {visible.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

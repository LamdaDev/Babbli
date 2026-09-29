"use client";

import { Pin } from "@/components/profile/Pin";
import { Flag } from "@/components/ui/Flag";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/client/profileStore";
import { badgeDef } from "@/lib/profile/badges";
import { addressForm } from "@/lib/profile/profile";
import { inAddressForm } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";
import type { GameUI } from "./store";

/**
 * Scenes start by themselves. Only when the page was opened without any prior
 * click (e.g. a refresh) do browsers require one gesture before audio + mic.
 */
export function TapToEnter() {
  const controller = useController();
  const needsTap = useGame((s) => s.needsTap);
  const phase = useGame((s) => s.phase);
  const { scenario } = controller;
  return (
    <AnimatePresence>
      {needsTap && phase === "briefing" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => void controller.enter()}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-night/45 text-cream"
        >
          <Flag code={scenario.language} className="h-8 w-12" />
          <span className="font-display text-3xl">{scenario.title}</span>
          <span className="rounded-full bg-brand px-6 py-3 font-display text-xl text-white shadow-xl">Tap to step inside →</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function EntryCurtain() {
  const phase = useGame((s) => s.phase);
  const busyLabel = useGame((s) => s.busyLabel);
  const loadProgress = useGame((s) => s.loadProgress);
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
            role="status"
            aria-live="polite"
            className="absolute left-1/2 top-[40%] z-40 w-64 -translate-x-1/2 rounded-2xl bg-night/75 px-5 py-3 text-center text-sm font-bold text-cream backdrop-blur"
          >
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-cream border-t-transparent align-[-1px]" />
            {busyLabel ?? "Stepping inside…"}
            <ProgressBar value={loadProgress} label="Entering the scene" onDark className="mt-2.5" />
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
  const endReason = useGame((s) => s.endReason);
  const busyLabel = useGame((s) => s.busyLabel);
  const sessionId = useGame((s) => s.sessionId);
  const saveProgress = useGame((s) => s.saveProgress);
  const profile = useProfile();
  const { scenario } = controller;
  const badges = completion?.badges ?? [];
  // The card shows as soon as the scene ends; until the session is saved, the way on waits for it.
  const saving = phase === "ending";
  return (
    <AnimatePresence>
      {(phase === "ending" || phase === "done") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-night/60 p-4 backdrop-blur-sm">
          {saving && !completion ? (
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
                    {inAddressForm(scenario.successTitle, scenario.successTitleForms, addressForm(profile))}
                  </div>
                  <div className="mt-1 font-display text-lg text-teal">Objective complete</div>
                </>
              ) : (
                <>
                  <div className="mt-3 font-display text-2xl">Scene ended</div>
                  {endReason && (
                    <p className="mt-1 text-sm font-bold text-ink-soft">
                      {endReason === "hidden" ? "The tab was in the background for a minute, so the scene ended by itself." : "Nobody was there for a while, so the scene ended by itself."}
                    </p>
                  )}
                </>
              )}
              {badges.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 160, damping: 14 }}
                  className="mt-4 rounded-2xl bg-gold/15 px-4 py-3 ring-1 ring-gold/40"
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8a5a00]">New in your passport</div>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
                    {badges.map((id) => (
                      <div key={id} className="flex items-center gap-2 text-sm font-bold">
                        <Pin id={id} size={34} />
                        {badgeDef(id).name}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              {saving ? (
                <div className="mt-4 rounded-2xl bg-ink/5 px-4 py-3 text-left" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold">
                    <span>{saveProgress?.label ?? "Saving your session"}…</span>
                    <span className="tabular-nums text-ink-soft">{Math.round((saveProgress?.value ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={saveProgress?.value ?? 0} label="Saving your session" className="mt-2" />
                  <p className="mt-2 text-xs text-ink-soft">Your feedback unlocks as soon as this is done, usually within a few seconds.</p>
                </div>
              ) : completion?.saveFailed ? (
                <p className="mt-3 rounded-xl bg-gold/15 px-3 py-2 text-sm font-bold" role="alert">
                  Some of this session couldn&apos;t be saved, so your feedback may be incomplete. Check your connection.
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-bold text-teal">✓ Saved.</span> See how you did on comprehension, speaking, fluency, vocabulary and independence.
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2">
                {saving ? (
                  <button disabled className="cursor-wait rounded-2xl bg-brand/50 px-5 py-3 font-display text-lg text-white">
                    Saving…
                  </button>
                ) : (
                  <Link href={`/session/${sessionId}`} className="rounded-2xl bg-brand px-5 py-3 font-display text-lg text-white transition-colors hover:bg-brand-dark">
                    See your feedback →
                  </Link>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={saving}
                    onClick={() => window.location.reload()}
                    className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-50"
                  >
                    Play again
                  </button>
                  {saving ? (
                    <span className="flex-1 cursor-wait rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold opacity-50">Home</span>
                  ) : (
                    <Link href="/" className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold">
                      Home
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** "Still there?": shown after a while with nobody doing anything; the scene ends by itself when the countdown runs out. */
export function StillThere() {
  const controller = useController();
  const idle = useGame((s) => s.idle);
  const phase = useGame((s) => s.phase);
  const open = !!idle && phase !== "ending" && phase !== "done";
  return <AnimatePresence>{open && idle && <StillThereCard endsAt={idle.endsAt} onHere={controller.markActive} />}</AnimatePresence>;
}

const secondsUntil = (t: number) => Math.max(0, Math.ceil((t - Date.now()) / 1000));

function StillThereCard({ endsAt, onHere }: { endsAt: number; onHere: () => void }) {
  const [left, setLeft] = useState(() => secondsUntil(endsAt));
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntil(endsAt)), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-[55] flex items-center justify-center bg-night/50 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        role="alertdialog"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="paper-grain w-full max-w-sm rounded-3xl bg-paper p-6 text-center text-ink shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        <div className="text-4xl" aria-hidden>
          👋
        </div>
        <h2 id="idle-title" className="mt-2 font-display text-2xl">
          Still there?
        </h2>
        <p id="idle-desc" className="mt-1 text-sm leading-relaxed text-ink-soft">
          The scene ends by itself in <span className="font-bold tabular-nums text-ink">{left} s</span>. Your progress so far is saved.
        </p>
        <button
          autoFocus
          onClick={onHere}
          className="mt-5 w-full rounded-2xl bg-brand py-3 font-display text-lg text-white outline-none ring-brand/40 transition-colors hover:bg-brand-dark focus-visible:ring-4"
        >
          I&apos;m here
        </button>
      </motion.div>
    </motion.div>
  );
}

export function ErrorOverlay() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);
  const kind = useGame((s) => s.errorKind) ?? "busy";
  const action = useGame((s) => s.errorAction);
  if (phase !== "error") return null;
  const copy = ERROR_COPY[kind];
  // No microphone: switching to Text Mode is the way forward. Otherwise, trying again is.
  const actionFirst = kind === "mic";
  const actionLink = action && (
    // A full page load: the new mode needs a fresh session.
    <a
      href={action.href}
      className={`flex-1 rounded-2xl py-2.5 text-center font-bold ${actionFirst ? "bg-brand text-white transition-colors hover:bg-brand-dark" : "border-2 border-ink/15"}`}
    >
      {action.label}
    </a>
  );
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
      <div role="alertdialog" aria-labelledby="error-title" className="w-full max-w-lg rounded-3xl bg-paper p-7 text-ink shadow-2xl">
        <div className="text-4xl" aria-hidden>
          {copy.icon}
        </div>
        <h2 id="error-title" className="mt-2 font-display text-2xl">
          {copy.title}
        </h2>
        {kind === "setup" ? (
          <>
            <p className="mt-2 break-words rounded-xl bg-ink/5 p-3 font-mono text-xs text-ink-soft">{error}</p>
            <p className="mt-3 text-sm">
              Add <code className="rounded bg-ink/10 px-1">ELEVENLABS_API_KEY=…</code> to <code className="rounded bg-ink/10 px-1">.env.local</code> and restart the dev server.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{kind === "mic" ? error : copy.body}</p>
        )}
        <div className="mt-5 flex gap-2">
          {actionFirst && actionLink}
          <button
            onClick={() => controller.retry()}
            className={`flex-1 rounded-2xl py-2.5 font-bold ${actionFirst ? "border-2 border-ink/15" : "bg-brand text-white transition-colors hover:bg-brand-dark"}`}
          >
            {copy.retry}
          </button>
          {!actionFirst && actionLink}
          {!action && (
            <Link href="/" className="flex-1 rounded-2xl border-2 border-ink/15 py-2.5 text-center font-bold">
              Back home
            </Link>
          )}
        </div>
        {kind !== "setup" && kind !== "mic" && error && (
          <details className="mt-4 text-xs text-ink-soft">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <p className="mt-1 break-words font-mono">{error}</p>
          </details>
        )}
      </div>
    </div>
  );
}

const ERROR_COPY: Record<NonNullable<GameUI["errorKind"]>, { icon: string; title: string; body: string; retry: string }> = {
  busy: { icon: "☕", title: "Babbli is busy", body: "Lots of people are practicing right now. Try again in a minute.", retry: "Try again" },
  lost: { icon: "📡", title: "The connection dropped", body: "Sorry about that! Start the scene again, or switch to Text Mode.", retry: "Start again" },
  mic: { icon: "🎙️", title: "Microphone needed", body: "", retry: "Try again" },
  setup: { icon: "😵‍💫", title: "Couldn't start the scene", body: "", retry: "Try again" },
};

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

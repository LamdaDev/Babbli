"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useController, useGame } from "./GameContext";

function MicButton({ onClick, label }: { onClick: () => void; label: string }) {
  const controller = useController();
  const coreRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const l = controller.micLevel();
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + Math.min(0.35, l * 0.6)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controller]);
  return (
    <button onClick={onClick} aria-label={label} className="relative grid h-24 w-24 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-gold">
      <span className="mic-ring absolute inset-0 rounded-full bg-coral/60" />
      <span className="mic-ring absolute inset-0 rounded-full bg-coral/40" style={{ animationDelay: "0.9s" }} />
      <span ref={coreRef} className="absolute inset-2 rounded-full bg-gradient-to-b from-coral to-[#e24a3b] shadow-[0_8px_30px_rgba(255,107,90,0.6)] transition-transform duration-75" />
      <svg viewBox="0 0 24 24" className="relative h-10 w-10 fill-white">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
      </svg>
      <CountdownRing />
    </button>
  );
}

/**
 * Speaking time limit, shown as a red border that draws itself clockwise around
 * the mic from the top (no numbers). When it closes, the turn is sent.
 */
function CountdownRing() {
  const timer = useGame((s) => s.turnTimer);
  if (!timer) return null;
  return (
    <svg viewBox="0 0 120 120" className="pointer-events-none absolute -inset-3 h-[120px] w-[120px] -rotate-90" aria-hidden>
      <motion.circle
        key={timer.startedAt}
        cx={60}
        cy={60}
        r={56}
        fill="none"
        stroke="#e0342b"
        strokeWidth={4}
        strokeLinecap="round"
        initial={{ pathLength: 1 - timer.ms / timer.total }}
        animate={{ pathLength: 1 }}
        transition={{ duration: timer.ms / 1000, ease: "linear" }}
      />
    </svg>
  );
}

/** Voice Mode: the microphone (no typing — the learner chose to speak). */
function VoiceInput() {
  const controller = useController();
  const inputMode = useGame((s) => s.inputMode);
  const recording = useGame((s) => s.recording);
  const micAvailable = useGame((s) => s.micAvailable);
  const npcSpeaking = useGame((s) => s.npcSpeaking);
  const { scenario } = controller;
  if (!micAvailable || !recording)
    return <div className="rounded-2xl bg-night/70 px-4 py-2 text-sm text-cream">The microphone isn&apos;t available. Reload to try again, or choose Text Mode from the menu.</div>;
  const status = npcSpeaking
    ? `${scenario.npc.name} is talking…`
    : inputMode === "live"
      ? `${scenario.npc.name} is listening… speak in ${scenario.languageEnglish} and just pause when you're done`
      : `Recording… speak in ${scenario.languageEnglish}, then tap the mic`;
  return (
    <>
      <MicButton onClick={() => void controller.finishSpeaking()} label="Finish speaking" />
      <div className="flex items-center gap-2 rounded-full bg-night/70 px-4 py-1.5 text-sm font-bold text-cream backdrop-blur">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" />
        {status}
      </div>
    </>
  );
}

/** Text Mode: a composer in place of the microphone. Same card, same NPC, same engine. */
function TextComposer() {
  const controller = useController();
  const [text, setText] = useState("");
  const { scenario } = controller;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) controller.submitText(text);
      }}
      className="flex w-[min(92vw,520px)] gap-2 rounded-2xl bg-night/70 p-2 shadow-xl backdrop-blur"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        lang={scenario.language}
        aria-label={`Your reply in ${scenario.languageEnglish}`}
        placeholder={`Write your reply in ${scenario.languageEnglish}…`}
        className="min-w-0 flex-1 rounded-xl border-2 border-transparent bg-paper px-3 py-2.5 font-jp text-lg text-ink outline-none focus:border-brand"
      />
      <button disabled={!text.trim()} className="rounded-xl bg-brand px-5 font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
        Send
      </button>
    </form>
  );
}

/** The YOUR TURN panel — remounts for every turn, so its state resets naturally. */
function SpeakPanel() {
  const controller = useController();
  const card = useGame((s) => s.selectedCard);
  const responseMode = useGame((s) => s.responseMode);

  return (
    <>
      <div className="flex items-center gap-2 rounded-full bg-paper/95 py-1.5 pl-1.5 pr-4 text-sm font-bold text-ink shadow-lg">
        <span className="rounded-full bg-gold px-2.5 py-0.5 font-display text-[11px] uppercase tracking-[0.2em] text-ink">Your turn</span>
        {card ? (
          <span>
            <span className="mr-1.5">{card.icon}</span>
            You want to: {card.label}
          </span>
        ) : (
          <span>{responseMode === "text" ? "Write it your way" : "Say it your way"}</span>
        )}
      </div>
      {responseMode === "text" ? <TextComposer /> : <VoiceInput />}
      <div className="flex items-center gap-4 text-xs font-bold text-cream/75">
        <button onClick={() => controller.backToChoices()} className="hover:text-cream">
          ← choose again
        </button>
      </div>
    </>
  );
}

export function SpeakingInterface() {
  const phase = useGame((s) => s.phase);
  const busyLabel = useGame((s) => s.busyLabel);
  const { scenario } = useController();

  return (
    // Below lg the corner controls would reach the typing box, so the panel sits above their row.
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-4 lg:bottom-8">
      <AnimatePresence mode="wait">
        {phase === "speak" && (
          <motion.div
            key="speak"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-auto flex flex-col items-center gap-3 text-center"
          >
            <SpeakPanel />
          </motion.div>
        )}
        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-full bg-night/70 px-4 py-2 text-sm font-bold text-cream backdrop-blur"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cream" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {busyLabel ?? `${scenario.npc.name} is thinking…`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

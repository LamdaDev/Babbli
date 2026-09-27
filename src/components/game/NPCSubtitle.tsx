"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useProfile } from "@/lib/client/profileStore";
import { useController, useGame } from "./GameContext";
import type { Subtitle } from "./store";

function Karaoke({ subtitle }: { subtitle: Subtitle }) {
  const controller = useController();
  const [idx, setIdx] = useState(0);
  const k = subtitle.karaoke!;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = controller.audioNow() - k.t0;
      let i = 0;
      while (i < k.starts.length && k.starts[i] <= t) i++;
      setIdx(i);
      if (i < k.starts.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controller, k]);
  const text = k.chars.join("");
  return (
    <>
      <span className="text-gold">{text.slice(0, idx)}</span>
      <span>{text.slice(idx)}</span>
    </>
  );
}

/** Solid background per wrapped line — no blur, so multi-line captions stay crisp. */
const CAPTION_BASE = "rounded-md box-decoration-clone px-3 py-0.5 font-jp font-bold text-white";
const CAPTION = `${CAPTION_BASE} bg-black/65`;

/** Past this much speech in one turn, gently nudge the learner to keep it short. */
function isLong(text: string, lang: string) {
  if (lang === "ja") return [...text.replace(/[\s、。！？]/g, "")].length > 70;
  return text.split(/\s+/).filter(Boolean).length > 35;
}

function CaptionLabel({ children, color, avatar }: { children: React.ReactNode; color: string; avatar?: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-black/60 py-0.5 pr-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] ${avatar ? "pl-0.5" : "pl-2.5"} ${color}`}>
        {avatar}
        {children}
      </span>
    </div>
  );
}

/** The learner's caption label: their avatar and nickname from the Traveler Profile. */
function YouLabel() {
  const profile = useProfile();
  const name = profile.nickname.trim();
  return (
    <CaptionLabel color="text-[#5fe0c6]" avatar={<Avatar look={profile.avatar} size={20} label="" />}>
      {name ? `${name} (you)` : "You"}
    </CaptionLabel>
  );
}

const MAX_FONT = 32;
const MIN_FONT = 16;

/**
 * The learner's own words, anchored just above the mic panel and growing upward.
 * The font shrinks to fit as they say more; past the minimum size the oldest
 * words fade out at the top so the newest stay readable.
 */
function UserCaption({ text, final, lang, speaking }: { text: string; final: boolean; lang: string; speaking: boolean }) {
  // The nudge only shows while they're still talking; it disappears once they've answered.
  const long = speaking && isLong(text, lang);
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    const p = textRef.current;
    if (!box || !inner || !p) return;
    let size = MAX_FONT;
    p.style.fontSize = `${size}px`;
    while (size > MIN_FONT && inner.offsetHeight > box.clientHeight) {
      size -= 2;
      p.style.fontSize = `${size}px`;
    }
    const overflow = inner.offsetHeight > box.clientHeight;
    const mask = overflow ? "linear-gradient(to bottom, transparent, black 56px)" : "";
    box.style.maskImage = mask;
    box.style.webkitMaskImage = mask;
  }, [text, long]);

  return (
    <motion.div
      ref={boxRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center justify-end overflow-hidden px-4"
      style={{ top: "max(290px, 34%)", bottom: 270 }}
      aria-live="polite"
    >
      <div ref={innerRef} className="max-w-4xl shrink-0 text-center">
        <AnimatePresence>
          {long && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2">
              <span className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-ink shadow-lg">✂️ Keep it short: one thing at a time.</span>
            </motion.div>
          )}
        </AnimatePresence>
        <YouLabel />
        <p ref={textRef} lang={lang} className="leading-[1.55]" style={{ fontSize: MAX_FONT }}>
          <span className={`${CAPTION_BASE} transition-colors duration-500 ${long ? "bg-[#7a4512]/80" : "bg-black/65"} ${final ? "" : "text-white/90"}`}>
            {text ? (
              <>
                {text}
                {!final && <span className="ml-0.5 inline-block h-[0.9em] w-[3px] animate-pulse bg-[#5fe0c6] align-[-0.1em]" />}
              </>
            ) : (
              <span className="inline-flex gap-1.5 px-1 align-middle">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-white/70" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
          </span>
        </p>
      </div>
    </motion.div>
  );
}

/** Captions — styled as film subtitles, never chat bubbles. */
export function NPCSubtitle() {
  const subtitle = useGame((s) => s.subtitle);
  const userCaption = useGame((s) => s.userCaption);
  const show = useGame((s) => s.showSubtitles);
  const showTranslation = useGame((s) => s.showTranslation);
  const phase = useGame((s) => s.phase);
  const npcSpeaking = useGame((s) => s.npcSpeaking);
  const { scenario } = useController();
  const inScene = !["briefing", "transition", "done", "error"].includes(phase);
  const visible = show && subtitle && inScene;
  // The learner's own words are feedback on the mic, so they show even with CC off.
  const showUser = !!userCaption && (phase === "speak" || phase === "processing");
  // Once the NPC has finished and the answer cards are up, lift its line so a long reply never covers them.
  const lifted = showUser || (phase === "choose" && !npcSpeaking);
  // Very long monologues: keep the DOM light; the fit/fade logic handles the rest.
  const userText = userCaption ? (userCaption.text.length > 600 ? `…${userCaption.text.slice(-600)}` : userCaption.text) : "";

  return (
    <>
      {/* NPC line: its usual spot while speaking; lifted toward the top (and a little smaller) once the learner has to respond. */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 transition-[top] duration-300"
        style={{ top: lifted ? "max(88px, 10%)" : "min(51%, calc(100% - 440px))" }}
      >
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={subtitle.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl text-center"
            >
              <CaptionLabel color="text-gold">{subtitle.speaker}</CaptionLabel>
              <p lang={scenario.language} className={`leading-[1.55] transition-[font-size] duration-300 ${lifted ? "text-lg sm:text-[22px]" : "text-2xl sm:text-[32px]"}`}>
                <span className={CAPTION}>{subtitle.karaoke ? <Karaoke subtitle={subtitle} /> : subtitle.text}</span>
              </p>
              {showTranslation && subtitle.meaning && (
                <div className="mx-auto mt-2 w-fit rounded-lg bg-black/50 px-3 py-1 text-sm italic text-cream/90 sm:text-base">{subtitle.meaning}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showUser && <UserCaption key="you" text={userText} final={!!userCaption?.final} lang={scenario.language} speaking={phase === "speak"} />}
      </AnimatePresence>
    </>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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

/** Captions near the NPC — styled as film subtitles, never chat bubbles. */
export function NPCSubtitle() {
  const subtitle = useGame((s) => s.subtitle);
  const show = useGame((s) => s.showSubtitles);
  const showTranslation = useGame((s) => s.showTranslation);
  const phase = useGame((s) => s.phase);
  const { scenario } = useController();
  const visible = show && subtitle && !["briefing", "transition", "done", "error"].includes(phase);

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4" style={{ top: "min(51%, calc(100% - 440px))" }}>
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
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold/90 drop-shadow">{subtitle.speaker}</div>
            <div
              lang={scenario.language}
              className="inline rounded-xl bg-black/55 box-decoration-clone px-3 py-1 font-jp text-2xl font-bold leading-[1.6] text-white shadow-lg backdrop-blur-sm sm:text-[32px]"
            >
              {subtitle.karaoke ? <Karaoke subtitle={subtitle} /> : subtitle.text}
            </div>
            {showTranslation && subtitle.meaning && (
              <div className="mx-auto mt-2 w-fit rounded-lg bg-black/40 px-3 py-1 text-sm italic text-cream/90 backdrop-blur-sm sm:text-base">
                {subtitle.meaning}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

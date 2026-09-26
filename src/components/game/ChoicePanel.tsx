"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { IntentCard } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";

function IntentionCard({ card, index, onPick }: { card: IntentCard; index: number; onPick: () => void }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 30, rotate: (index - 1) * 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: (index - 1) * 1.2, transition: { delay: 0.08 * index, type: "spring", stiffness: 180, damping: 18 } }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.15 } }}
      whileHover={{ y: -6, rotate: 0, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPick}
      className="group relative flex w-full items-center gap-3 rounded-2xl border-2 border-[#e9d3ad] bg-paper px-4 py-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none ring-gold focus-visible:ring-4 sm:min-h-[92px] sm:flex-col sm:items-start sm:gap-1 sm:px-5 sm:py-4"
    >
      <span className="absolute right-3 top-2 hidden rounded-md bg-ink/10 px-1.5 text-[11px] font-black text-ink/50 sm:block">{index + 1}</span>
      <span className="text-3xl leading-none drop-shadow-sm">{card.icon}</span>
      <span className="font-display text-[17px] leading-snug text-ink sm:text-lg">{card.label}</span>
    </motion.button>
  );
}

/** Three intention cards: WHAT to communicate — never the target-language sentence. */
export function ChoicePanel() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const npcSpeaking = useGame((s) => s.npcSpeaking);
  const cards = useGame((s) => s.cards);
  const narration = useGame((s) => s.narration);
  const stageId = useGame((s) => s.stageId);
  const micAvailable = useGame((s) => s.micAvailable);
  const visible = phase === "choose" && !npcSpeaking;

  return (
    <div className="absolute inset-x-0 bottom-20 z-20 flex justify-center px-3 sm:bottom-24">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={stageId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl"
          >
            {narration && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mb-3 w-fit rounded-full bg-night/75 px-4 py-1.5 text-center text-sm font-semibold text-cream backdrop-blur"
              >
                {narration}
              </motion.p>
            )}
            <p className="mx-auto mb-2 w-fit rounded-full bg-night/55 px-3 py-1 text-center text-xs font-extrabold uppercase tracking-[0.25em] text-cream/90 backdrop-blur-sm">What do you want to say?</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
              {cards.map((card, i) => (
                <IntentionCard key={`${stageId}-${card.key ?? card.id}`} card={card} index={i} onPick={() => controller.chooseCard(card)} />
              ))}
            </div>
            {micAvailable && (
              <div className="mt-2 text-center">
                <button onClick={() => controller.speakFreely()} className="rounded-full bg-night/55 px-3 py-1 text-xs font-bold text-cream/85 backdrop-blur-sm hover:bg-night/75 hover:text-cream">
                  🎤 …or say something else
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

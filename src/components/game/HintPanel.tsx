"use client";

import { AnimatePresence, motion } from "framer-motion";
import { defaultHintCard, getStage } from "@/lib/engine/engine";
import { useController, useGame } from "./GameContext";

const LEVELS = [
  { n: 1, title: "What to get across", cost: 2 },
  { n: 2, title: "Key words", cost: 4 },
  { n: 3, title: "Sentence starter", cost: 6 },
  { n: 4, title: "Full sentence", cost: 10 },
  { n: 5, title: "Hear it spoken", cost: 12 },
];

/** Progressive hints: intent → vocabulary → starter → full sentence → native audio. */
export function HintPanel() {
  const controller = useController();
  const open = useGame((s) => s.hintOpen);
  const helpOpen = useGame((s) => s.helpOpen);
  const level = useGame((s) => s.hintLevel);
  const busy = useGame((s) => s.hintBusy);
  const stageId = useGame((s) => s.stageId);
  const selected = useGame((s) => s.selectedCard);
  const cards = useGame((s) => s.cards);
  const card = selected ?? defaultHintCard(cards);
  const stage = getStage(controller.scenario, stageId);
  const next = LEVELS[level];

  return (
    <AnimatePresence>
      {open && card && (
        <motion.aside
          initial={{ opacity: 0, y: 24, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: -0.8 }}
          exit={{ opacity: 0, y: 24 }}
          // With the "Need help?" column open (md+), keep its buttons reachable: stop above it, or on wide
          // screens (where there's room without covering the mic) sit beside it.
          className={`paper-grain absolute right-3 top-16 z-40 max-h-[calc(100dvh-150px)] w-[min(92vw,360px)] overflow-y-auto rounded-2xl bg-paper p-4 text-ink shadow-2xl transition-[right] duration-200 sm:right-5 ${
            helpOpen ? "md:max-xl:max-h-[calc(100dvh-350px)] xl:right-[164px]" : ""
          }`}
          aria-label="Hints"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="font-display text-lg">💡 Hints</div>
            <button onClick={() => controller.closeHints()} className="rounded-full px-2 text-sm font-bold text-ink/60 hover:bg-ink/10" aria-label="Close hints">
              ✕
            </button>
          </div>
          <div className="mb-3 rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink-soft">
            <span className="font-bold">{card.icon} For:</span> {card.label}
            {!selected && <span className="block pt-1 italic">(Pick a card to get hints for a different intention.)</span>}
          </div>
          <ol className="space-y-2.5">
            {level >= 1 && (
              <li>
                <div className="text-[11px] font-black uppercase tracking-widest text-brand">1 · {LEVELS[0].title}</div>
                <p className="text-sm">{stage.situation}</p>
                <p className="text-sm font-semibold">{card.hints.intent}</p>
              </li>
            )}
            {level >= 2 && (
              <li>
                <div className="text-[11px] font-black uppercase tracking-widest text-brand">2 · {LEVELS[1].title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {card.hints.vocab.map((v) => (
                    <span key={v.term} className="rounded-lg bg-white px-2 py-1 text-sm shadow-sm">
                      <span className="font-jp font-bold" lang={controller.scenario.language}>
                        {v.term}
                      </span>
                      {v.reading && <span className="ml-1 text-xs text-ink-soft">{v.reading}</span>}
                      <span className="text-xs text-ink-soft">: {v.meaning}</span>
                    </span>
                  ))}
                </div>
              </li>
            )}
            {level >= 3 && (
              <li>
                <div className="text-[11px] font-black uppercase tracking-widest text-brand">3 · {LEVELS[2].title}</div>
                <p className="font-jp text-xl font-bold" lang={controller.scenario.language}>
                  {card.hints.starter}
                </p>
              </li>
            )}
            {level >= 4 && (
              <li>
                <div className="text-[11px] font-black uppercase tracking-widest text-brand">4 · {LEVELS[3].title}</div>
                <p className="font-jp text-xl font-bold" lang={controller.scenario.language}>
                  {card.hints.full}
                </p>
                {card.hints.fullReading && <p className="text-sm text-ink-soft">{card.hints.fullReading}</p>}
                <p className="text-sm italic text-ink-soft">{card.hints.fullMeaning}</p>
              </li>
            )}
            {level >= 5 && (
              <li>
                <div className="text-[11px] font-black uppercase tracking-widest text-brand">5 · {LEVELS[4].title}</div>
                <button
                  onClick={() => void controller.playHintAudio()}
                  disabled={busy}
                  className="mt-1 rounded-full bg-teal px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Playing…" : "▶ Play native audio"}
                </button>
              </li>
            )}
          </ol>
          {next && (
            <button
              onClick={() => controller.nextHint()}
              className="mt-4 w-full rounded-xl border-2 border-dashed border-brand/50 py-2 text-sm font-bold text-brand hover:bg-brand/10"
            >
              Reveal: {next.title} <span className="font-normal text-ink-soft">(−{next.cost} independence)</span>
            </button>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

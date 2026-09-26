"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useController, useGame } from "./GameContext";

function Ctl({
  label,
  icon,
  onClick,
  active,
  disabled,
  kbd,
  children,
  alwaysLabel,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  kbd: string;
  children?: React.ReactNode;
  alwaysLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${kbd})`}
      aria-label={label}
      aria-pressed={active}
      className={`relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold shadow-lg backdrop-blur transition ${
        active ? "bg-brand text-white" : "bg-night/70 text-cream hover:bg-night/90"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className={alwaysLabel ? "whitespace-nowrap" : "hidden md:inline"}>{label}</span>
      {children}
    </button>
  );
}

/**
 * "Need help?" reveals the assistance controls, stacked upwards so they stay in the
 * corner and never run under the typing box / cards in the middle. Subtitles stay one tap away.
 */
export function UtilityControls() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const npcSpeaking = useGame((s) => s.npcSpeaking);
  const hintLevel = useGame((s) => s.hintLevel);
  const hintOpen = useGame((s) => s.hintOpen);
  const showSubtitles = useGame((s) => s.showSubtitles);
  const showTranslation = useGame((s) => s.showTranslation);
  const translationAllowed = useGame((s) => s.translationAllowed);
  const hasLine = useGame((s) => !!s.subtitle);
  const helpOpen = useGame((s) => s.helpOpen);
  const interactive = phase === "choose" || phase === "speak";
  if (["briefing", "done", "error"].includes(phase)) return null;

  return (
    // Phones: one icon row along the bottom (the typing box sits just above it). Wider: a column.
    <div className="absolute bottom-4 right-3 z-30 flex items-end gap-2 sm:bottom-5 sm:right-5 md:flex-col">
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="flex items-stretch gap-2 md:w-[132px] md:flex-col"
          >
            {translationAllowed && (
              // In the English scene the "translation" is a plain-English paraphrase instead.
              <Ctl
                label={controller.scenario.language === "en" ? "Simpler" : "English"}
                icon={controller.scenario.language === "en" ? "≈" : "EN"}
                kbd="T"
                onClick={() => controller.toggleTranslation()}
                active={showTranslation}
              />
            )}
            <Ctl label="Slow" icon="🐢" kbd="S" onClick={() => void controller.replay(true)} disabled={!interactive || npcSpeaking || !hasLine} />
            <Ctl label="Repeat" icon="🔁" kbd="R" onClick={() => void controller.replay(false)} disabled={!interactive || npcSpeaking || !hasLine} />
            {controller.difficulty !== "immersion" && (
            <Ctl label="Hint" icon="💡" kbd="H" onClick={() => controller.toggleHints()} active={hintOpen} disabled={!interactive}>
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((l) => (
                  <span key={l} className={`h-1.5 w-1.5 rounded-full ${l <= hintLevel ? "bg-coral" : "bg-current opacity-30"}`} />
                ))}
              </span>
            </Ctl>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2">
        <Ctl
          label={helpOpen ? "Close" : "Need help?"}
          icon={helpOpen ? "✕" : "🙋"}
          kbd="H / R / S"
          onClick={() => controller.toggleHelp()}
          active={helpOpen}
          alwaysLabel={!helpOpen}
        />
        {controller.difficulty === "beginner" && <Ctl label="Subtitles" icon="CC" kbd="C" onClick={() => controller.toggleSubtitles()} active={showSubtitles} />}
      </div>
    </div>
  );
}

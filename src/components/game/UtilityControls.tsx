"use client";

import { useController, useGame } from "./GameContext";

function Ctl({
  label,
  icon,
  onClick,
  active,
  disabled,
  kbd,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  kbd: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${kbd})`}
      aria-label={label}
      aria-pressed={active}
      className={`relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold shadow-lg backdrop-blur transition ${
        active ? "bg-gold text-ink" : "bg-night/70 text-cream hover:bg-night/90"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="hidden md:inline">{label}</span>
      {children}
    </button>
  );
}

/** Compact assistance controls — kept small so the scene stays the focus. */
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
  const interactive = phase === "choose" || phase === "speak";
  if (["briefing", "done", "error"].includes(phase)) return null;

  return (
    <div className="absolute bottom-4 right-3 z-30 flex flex-wrap items-center justify-end gap-2 sm:bottom-5 sm:right-5">
      <Ctl label="Hint" icon="💡" kbd="H" onClick={() => controller.toggleHints()} active={hintOpen} disabled={!interactive}>
        <span className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((l) => (
            <span key={l} className={`h-1.5 w-1.5 rounded-full ${l <= hintLevel ? "bg-coral" : "bg-current opacity-30"}`} />
          ))}
        </span>
      </Ctl>
      <Ctl label="Repeat" icon="🔁" kbd="R" onClick={() => void controller.replay(false)} disabled={!interactive || npcSpeaking || !hasLine} />
      <Ctl label="Slow" icon="🐢" kbd="S" onClick={() => void controller.replay(true)} disabled={!interactive || npcSpeaking || !hasLine} />
      <Ctl label="Subtitles" icon="CC" kbd="C" onClick={() => controller.toggleSubtitles()} active={showSubtitles} />
      {translationAllowed && (
        <Ctl label="English" icon="EN" kbd="T" onClick={() => controller.toggleTranslation()} active={showTranslation} />
      )}
    </div>
  );
}

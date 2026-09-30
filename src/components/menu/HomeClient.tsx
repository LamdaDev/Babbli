"use client";

import { Flag } from "@/components/ui/Flag";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ProfileChip, TravelerStrip } from "@/components/profile/TravelerStrip";
import { InAppNotice } from "@/components/ui/InAppNotice";
import { assetUrl } from "@/lib/client/api";
import { audioEngine } from "@/lib/client/audioEngine";
import { useInAppBrowser } from "@/lib/client/inAppBrowser";
import { useProfile, useProgress } from "@/lib/client/profileStore";
import { LANGUAGES, SCENARIOS, getScenario, scenariosForLanguage } from "@/lib/scenarios";
import { DIFFICULTIES, type Difficulty, type InputMode, type LanguageCode, type ResponseMode } from "@/lib/scenarios/types";
import { Intro, useIntroRevealed } from "./Intro";
import { Logo } from "./Logo";
import { ScenePreview } from "./ScenePreview";

/* Light, flat surfaces (see the palette rules in globals.css). */
const PILL = "rounded-full bg-paper px-3 py-1.5 font-bold text-ink shadow-sm ring-1 ring-ink/10 transition hover:ring-brand/40";
const LABEL = "text-xs font-black uppercase tracking-[0.3em] text-brand";
const CARD = "bg-paper text-ink shadow-[0_12px_32px_rgba(19,35,63,0.10)] ring-1 ring-ink/10";
const choice = (selected: boolean) => (selected ? "border-brand bg-brand/10" : "border-ink/10 bg-paper hover:border-brand/40");

/** The menu music preference: on unless the learner turned it off (remembered in this browser). */
const MUSIC_KEY = "babbli:music";
const musicListeners = new Set<() => void>();
function musicOn() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "off";
  } catch {
    return true;
  }
}
function subscribeMusic(listener: () => void) {
  musicListeners.add(listener);
  return () => void musicListeners.delete(listener);
}
function setMusicOn(on: boolean) {
  try {
    localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable: still applies for this visit */
  }
  musicListeners.forEach((l) => l());
}

/**
 * The menu theme, on by default. Browsers only allow sound once the visitor has tapped or pressed a key
 * on the site, so it starts right away when that's already happened (e.g. back home from a scene),
 * otherwise on the first tap or key press.
 */
function useMenuMusic() {
  const on = useSyncExternalStore(subscribeMusic, musicOn, () => true);
  const playing = useRef(false);
  const play = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    try {
      await audioEngine().unlock();
      await audioEngine().startMusic(assetUrl("menu-music"), 0.3);
    } catch {
      playing.current = false; // music not generated yet
    }
  }, []);
  useEffect(() => {
    if (!on) return;
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation?.hasBeenActive) {
      void play();
      return;
    }
    const start = () => void play();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [on, play]);
  // Leaving the home page (into a scene) fades it out.
  useEffect(
    () => () => {
      audioEngine().stopMusic(0.8);
      playing.current = false;
    },
    [],
  );
  const toggle = () => {
    if (on) {
      audioEngine().stopMusic(0.6);
      playing.current = false;
      setMusicOn(false);
    } else {
      setMusicOn(true);
      void play();
    }
  };
  return { on, toggle };
}

export function HomeClient() {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  // Until the learner picks here, difficulty and response mode follow their Traveler Profile defaults.
  const profile = useProfile();
  const [difficultyChoice, setDifficulty] = useState<Difficulty | null>(null);
  const difficulty = difficultyChoice ?? profile.difficulty;
  // How the learner responds (Voice or Text Mode); for voice, how they talk (push-to-talk or live).
  const [respondChoice, setRespond] = useState<ResponseMode | null>(null);
  const respond = respondChoice ?? profile.responseMode;
  // null = follow the difficulty's recommendation until the learner picks explicitly
  const [modeChoice, setModeChoice] = useState<InputMode | null>(null);
  const defaultMode: InputMode = difficulty === "beginner" ? "ptt" : "live";
  const mode = modeChoice ?? defaultMode;
  const music = useMenuMusic();
  const inApp = useInAppBrowser();
  // The page animates in as the intro lifts, rather than behind it.
  const revealed = useIntroRevealed();
  // Sessions played in this browser only (the passport keeps them), newest first.
  const progress = useProgress();
  const recent = useMemo(() => progress.stamps.filter((s) => s.replies !== 0).reverse().slice(0, 12), [progress.stamps]);

  const pickLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setScenarioId(scenariosForLanguage(code)[0]?.id ?? null);
  };
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-page text-ink">
      <Intro />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6">
        <Logo />
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <ProfileChip className={PILL} />
          <button onClick={() => void music.toggle()} className={PILL} title="Menu theme composed with Eleven Music">
            {music.on ? "♪ Music on" : "♪ Music off"}
          </button>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-10">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={revealed ? { opacity: 1, y: 0 } : undefined}
          className="font-display text-5xl leading-[1.05] lg:whitespace-nowrap lg:text-[56px]"
        >
          Walk in. <span className="text-brand">Figure out what to say.</span>
        </motion.h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          We simulate the situations you&apos;re actually going to encounter, before you encounter them. Real characters, real voices, a real goal, and no script to memorise.
        </p>
        {inApp && <InAppNotice info={inApp} variant="banner" onTextMode={() => setRespond("text")} textModeOn={respond === "text"} />}
        <TravelerStrip onGo={pickLanguage} />

        <AnimatePresence mode="wait">
          {!language || !scenario ? (
            <motion.div
              key="lang"
              initial={{ opacity: 0, y: 16 }}
              animate={revealed ? { opacity: 1, y: 0 } : undefined}
              exit={{ opacity: 0, y: -10 }}
              className="mt-10"
            >
              <div className={`mb-4 ${LABEL}`}>Where are you going?</div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {LANGUAGES.map((l, i) => {
                  const s = scenariosForLanguage(l.code)[0];
                  return (
                    <motion.button
                      key={l.code}
                      onClick={() => pickLanguage(l.code)}
                      initial={{ opacity: 0, y: 30, rotate: (i - 1.5) * 2 }}
                      animate={revealed ? { opacity: 1, y: 0, rotate: (i - 1.5) * 1.5, transition: { delay: 0.1 + i * 0.08 } } : undefined}
                      whileHover={{ y: -8, rotate: 0, scale: 1.02 }}
                      className={`group overflow-hidden rounded-3xl text-left outline-none focus-visible:ring-4 focus-visible:ring-brand/40 ${CARD}`}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <ScenePreview scenario={s} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute left-3 top-3 flex gap-1.5">
                          {s.demoRole === "hero" && (
                            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow">Featured</span>
                          )}
                          {profile.language === l.code && (
                            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink shadow">★ Your pick</span>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="whitespace-nowrap font-display text-2xl">
                            <Flag code={l.code} /> {l.name}
                          </div>
                          <div className="whitespace-nowrap font-jp text-lg font-bold text-ink/40">{l.native}</div>
                        </div>
                        <div className="truncate whitespace-nowrap text-sm text-ink-soft">
                          {s.title} · {l.city}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className={`overflow-hidden rounded-3xl ${CARD}`}>
                <div className="relative aspect-[16/9]">
                  <ScenePreview scenario={scenario} className="h-full w-full" />
                  <button onClick={() => setLanguage(null)} className="absolute left-3 top-3 rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream backdrop-blur">
                    ← Change destination
                  </button>
                </div>
                <div className="space-y-3 p-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">
                    <Flag code={scenario.language} /> {scenario.locationLabel}
                  </div>
                  {scenariosForLanguage(language).length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {scenariosForLanguage(language).map((s) => (
                        <button key={s.id} onClick={() => setScenarioId(s.id)} className={`rounded-full px-3 py-1 text-sm font-bold ${s.id === scenario.id ? "bg-brand text-white" : "bg-ink/5 hover:bg-brand/10"}`}>
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="font-display text-3xl">{scenario.title}</div>
                  <p className="text-ink-soft">{scenario.blurb}</p>
                  <div className="rounded-2xl bg-ink/5 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-brand">Objective</div>
                    <div className="font-display text-lg">{scenario.objective}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:self-center">
                <div className={LABEL}>Choose your difficulty</div>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${choice(difficulty === d.id)}`}
                    aria-pressed={difficulty === d.id}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-3">
                      <span className="font-display text-xl">{d.label}</span>
                      <span className="text-sm text-ink-soft">{d.summary}</span>
                    </div>
                  </button>
                ))}
                <div className={`mt-3 ${LABEL}`}>How do you want to respond?</div>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="How do you want to respond?">
                  {(
                    [
                      ["voice", "🎙 Voice", "Speak your replies aloud"],
                      ["text", "⌨ Text", "Type your replies"],
                    ] as const
                  ).map(([m, title, desc]) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={respond === m}
                      onClick={() => setRespond(m)}
                      className={`rounded-2xl border-2 p-3 text-left transition ${choice(respond === m)}`}
                    >
                      <div className="font-bold">{title}</div>
                      <div className="mt-0.5 text-sm leading-snug text-ink-soft">{desc}</div>
                    </button>
                  ))}
                </div>
                {respond === "voice" && (
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="How you'll talk">
                    {(
                      [
                        ["ptt", "✋ Push-to-talk", "Tap the mic when done"],
                        ["live", "🎙 Live", "Just talk, then pause"],
                      ] as const
                    ).map(([m, title, desc]) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setModeChoice(m)}
                        className={`rounded-xl border-2 px-3 py-2 text-left text-sm transition ${choice(mode === m)}`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="whitespace-nowrap font-bold">{title}</span>
                          {defaultMode === m && <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Recommended</span>}
                        </div>
                        <div className="text-xs text-ink-soft">{desc}</div>
                      </button>
                    ))}
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    router.push(
                      respond === "text"
                        ? `/play/${scenario.id}?difficulty=${difficulty}&respond=text`
                        : `/play/${scenario.id}?difficulty=${difficulty}&respond=voice&mode=${mode}`,
                    )
                  }
                  className="mt-2 rounded-2xl bg-brand px-6 py-4 font-display text-2xl text-white shadow-[0_10px_28px_rgba(27,87,203,0.3)] transition-colors hover:bg-brand-dark"
                >
                  Start →
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {recent.length > 0 && (
          <div className="mt-14">
            <div className={`mb-3 ${LABEL}`}>Your recent sessions</div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recent.map((r) => {
                const s = SCENARIOS.find((x) => x.id === r.scenarioId);
                return (
                  <Link key={r.sessionId} href={`/session/${r.sessionId}`} className="min-w-56 rounded-2xl bg-paper p-4 ring-1 ring-ink/10 transition hover:ring-brand/40">
                    <div className="text-sm font-bold">
                      {s && <Flag code={s.language} />} {s?.title}
                    </div>
                    <div className="text-xs text-ink-soft">
                      <span className="capitalize">{r.difficulty}</span> · {r.responseMode === "text" ? "Text" : "Voice"} · {new Date(r.at).toLocaleDateString()}
                      {r.replies !== undefined && ` · ${r.replies} ${r.replies === 1 ? "reply" : "replies"}`}
                    </div>
                    <div className={`mt-2 text-xs font-bold ${r.completed ? "text-[#0a7a0a]" : "text-ink-soft"}`}>
                      {r.completed ? "✓ Objective complete" : "○ Incomplete"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <footer className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-soft">
          <span>NPCs: ElevenLabs Agents</span>
          <span>Voices: ElevenLabs Voice Design</span>
          <span>Ambience &amp; SFX: ElevenLabs Sound Effects</span>
          <span>Theme: Eleven Music</span>
          <span>Speech analysis: ElevenLabs Scribe</span>
        </footer>
      </section>
    </main>
  );
}

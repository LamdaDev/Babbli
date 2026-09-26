"use client";

import { Flag } from "@/components/ui/Flag";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, assetUrl } from "@/lib/client/api";
import { audioEngine } from "@/lib/client/audioEngine";
import { LANGUAGES, SCENARIOS, getScenario, scenariosForLanguage } from "@/lib/scenarios";
import { DIFFICULTIES, type Difficulty, type InputMode, type LanguageCode } from "@/lib/scenarios/types";
import type { SessionSummary } from "@/lib/session/types";
import { Logo } from "./Logo";
import { ScenePreview } from "./ScenePreview";

function useMenuMusic() {
  const [on, setOn] = useState(false);
  const started = useRef(false);
  const muted = useRef(false);
  useEffect(() => {
    try {
      muted.current = localStorage.getItem("babbli:music") === "off";
    } catch {
      /* storage unavailable */
    }
    const start = async () => {
      if (started.current || muted.current) return;
      started.current = true;
      try {
        await audioEngine().unlock();
        await audioEngine().startMusic(assetUrl("menu-music"), 0.3);
        setOn(true);
      } catch {
        started.current = false;
      }
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      audioEngine().stopMusic(0.8);
    };
  }, []);
  const toggle = async () => {
    if (on) {
      audioEngine().stopMusic(0.6);
      setOn(false);
      muted.current = true;
      started.current = false;
      try {
        localStorage.setItem("babbli:music", "off");
      } catch {}
    } else {
      muted.current = false;
      try {
        localStorage.setItem("babbli:music", "on");
        await audioEngine().unlock();
        await audioEngine().startMusic(assetUrl("menu-music"), 0.3);
        started.current = true;
        setOn(true);
      } catch {
        /* music not generated yet */
      }
    }
  };
  return { on, toggle };
}

export function HomeClient() {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  // null = follow the difficulty's recommendation until the learner picks explicitly
  const [modeChoice, setModeChoice] = useState<InputMode | null>(null);
  const defaultMode: InputMode = difficulty === "beginner" ? "ptt" : "live";
  const mode = modeChoice ?? defaultMode;
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const music = useMenuMusic();

  useEffect(() => {
    api
      .sessions()
      .then((r) => setRecent(r.sessions))
      .catch(() => undefined);
  }, []);

  const pickLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setScenarioId(scenariosForLanguage(code)[0]?.id ?? null);
  };
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night text-cream">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-tangerine/30 blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[620px] rounded-full bg-plum/50 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => void music.toggle()} className="rounded-full bg-white/10 px-3 py-1.5 font-bold hover:bg-white/15" title="Menu theme composed with Eleven Music">
            {music.on ? "♪ Music on" : "♪ Music off"}
          </button>
          <Link href="/studio" className="rounded-full bg-white/10 px-3 py-1.5 font-bold hover:bg-white/15">
            ElevenLabs Studio
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-10">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl font-display text-5xl leading-[1.05] sm:text-6xl"
        >
          Walk in. <span className="text-tangerine">Figure out what to say.</span>
        </motion.h1>
        <p className="mt-4 max-w-2xl text-lg text-cream/75">
          We simulate the situations you&apos;re actually going to encounter — before you encounter them. Real characters, real voices, a real goal, and no script to memorise.
        </p>

        <AnimatePresence mode="wait">
          {!language || !scenario ? (
            <motion.div key="lang" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-10">
              <div className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-gold">Where are you going?</div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {LANGUAGES.map((l, i) => {
                  const s = scenariosForLanguage(l.code)[0];
                  return (
                    <motion.button
                      key={l.code}
                      onClick={() => pickLanguage(l.code)}
                      initial={{ opacity: 0, y: 30, rotate: (i - 1.5) * 2 }}
                      animate={{ opacity: 1, y: 0, rotate: (i - 1.5) * 1.5, transition: { delay: 0.1 + i * 0.08 } }}
                      whileHover={{ y: -8, rotate: 0, scale: 1.02 }}
                      className="group overflow-hidden rounded-3xl bg-paper text-left text-ink shadow-[0_20px_50px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-4 focus-visible:ring-gold"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <ScenePreview scenario={s} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
                        {s.demoRole === "hero" && (
                          <span className="absolute left-3 top-3 rounded-full bg-tangerine px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow">
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <div className="font-display text-2xl">
                            <Flag code={l.code} /> {l.name}
                          </div>
                          <div className="text-sm text-ink-soft">
                            {s.title} · {l.city}
                          </div>
                        </div>
                        <div className="font-jp text-lg font-bold text-ink/40">{l.native}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl">
                <div className="relative aspect-[16/9]">
                  <ScenePreview scenario={scenario} className="h-full w-full" />
                  <button onClick={() => setLanguage(null)} className="absolute left-3 top-3 rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream backdrop-blur">
                    ← Change destination
                  </button>
                </div>
                <div className="space-y-3 p-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-tangerine">
                    <Flag code={scenario.language} /> {scenario.locationLabel}
                  </div>
                  {scenariosForLanguage(language).length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {scenariosForLanguage(language).map((s) => (
                        <button key={s.id} onClick={() => setScenarioId(s.id)} className={`rounded-full px-3 py-1 text-sm font-bold ${s.id === scenario.id ? "bg-ink text-cream" : "bg-ink/10"}`}>
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="font-display text-3xl">{scenario.title}</div>
                  <p className="text-ink-soft">{scenario.blurb}</p>
                  <div className="rounded-2xl bg-ink/5 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-tangerine">Objective</div>
                    <div className="font-display text-lg">{scenario.objective}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold text-ink-soft">
                      {Array.from(new Set(scenario.stages.map((s) => s.group))).map((g, i, arr) => (
                        <span key={g}>
                          {g}
                          {i < arr.length - 1 ? " →" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-ink-soft">
                    You&apos;ll meet <b className="text-ink">{scenario.npc.name}</b>, the {scenario.npc.role.toLowerCase()}. Every visit is different — stock, mistakes and follow-up questions change each run.
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-gold">Choose your difficulty</div>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      difficulty === d.id ? "border-tangerine bg-tangerine/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    aria-pressed={difficulty === d.id}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-xl">{d.label}</span>
                      <span className="text-xs font-bold text-cream/60">{d.tagline}</span>
                    </div>
                    <ul className="mt-1 grid grid-cols-1 gap-x-4 text-sm text-cream/75 sm:grid-cols-2">
                      {d.details.map((x) => (
                        <li key={x}>· {x}</li>
                      ))}
                    </ul>
                  </button>
                ))}
                <div className="mt-3 text-xs font-black uppercase tracking-[0.3em] text-gold">How you&apos;ll talk</div>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="How you'll talk">
                  {(
                    [
                      ["live", "🎙 Live conversation", `${scenario.npc.name} listens in real time — just talk and pause when you're done.`],
                      ["ptt", "✋ Push-to-talk", "Take your time. Tap the mic when you've finished your sentence."],
                    ] as const
                  ).map(([m, title, desc]) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setModeChoice(m)}
                      className={`rounded-2xl border-2 p-3 text-left transition ${
                        mode === m ? "border-tangerine bg-tangerine/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="whitespace-nowrap font-bold">{title}</span>
                        {defaultMode === m && <span className="text-[10px] font-bold uppercase tracking-wider text-cream/50">Recommended</span>}
                      </div>
                      <div className="mt-0.5 text-sm leading-snug text-cream/70">{desc}</div>
                    </button>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/play/${scenario.id}?difficulty=${difficulty}&mode=${mode}`)}
                  className="mt-2 rounded-2xl bg-tangerine px-6 py-4 font-display text-2xl text-white shadow-[0_12px_40px_rgba(255,138,61,0.45)]"
                >
                  Enter the scene →
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {recent.length > 0 && (
          <div className="mt-14">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-cream/60">Your recent sessions</div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {recent.map((r) => {
                const s = SCENARIOS.find((x) => x.id === r.scenarioId);
                return (
                  <Link key={r.id} href={`/session/${r.id}`} className="min-w-56 rounded-2xl bg-white/5 p-4 hover:bg-white/10">
                    <div className="text-sm font-bold">
                      {s && <Flag code={s.language} />} {s?.title}
                    </div>
                    <div className="text-xs text-cream/60">
                      <span className="capitalize">{r.difficulty}</span> · {new Date(r.startedAt).toLocaleDateString()} · {r.turns} replies
                    </div>
                    <div className={`mt-2 text-xs font-bold ${r.objectiveComplete ? "text-teal" : "text-gold"}`}>
                      {r.objectiveComplete ? "✓ Objective complete" : "○ Incomplete"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <footer className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-cream/50">
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

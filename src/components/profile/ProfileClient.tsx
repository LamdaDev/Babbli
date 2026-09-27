"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlayButton } from "@/components/dashboard/PlayButton";
import { Logo } from "@/components/menu/Logo";
import { Flag } from "@/components/ui/Flag";
import { api } from "@/lib/client/api";
import { resetProfile, updateAvatar, updateProfile, useProfile, useProfileLoaded, useProgress } from "@/lib/client/profileStore";
import { BADGES, earnedBadges } from "@/lib/profile/badges";
import {
  ACCESSORIES,
  COACH_SAMPLES,
  COACH_VOICES,
  EXPRESSIONS,
  GLASSES,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  PRONOUN_OPTIONS,
  SKIN_TONES,
  cleanNickname,
  cleanPronouns,
  coachVoiceKey,
  NICKNAME_MAX,
  PRONOUNS_MAX,
  type AvatarLook,
  type CoachVoice,
  type Swatch,
} from "@/lib/profile/profile";
import { LANGUAGES } from "@/lib/scenarios";
import { DIFFICULTIES, type LanguageCode } from "@/lib/scenarios/types";
import { Avatar } from "./Avatar";
import { Passport } from "./Passport";
import { Pin } from "./Pin";

const PILL = "rounded-full bg-paper px-3 py-1.5 text-sm font-bold text-ink shadow-sm ring-1 ring-ink/10 transition hover:ring-brand/40";
const chip = (selected: boolean) =>
  `rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
    selected ? "border-brand bg-brand/10 text-ink" : "border-ink/10 bg-paper hover:border-brand/40"
  }`;
const INPUT = "w-full rounded-xl border-2 border-ink/10 bg-paper px-4 py-2.5 font-bold outline-none transition placeholder:font-normal placeholder:text-ink-soft/70 focus:border-brand";

function Card({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-paper p-5 shadow-[0_8px_24px_rgba(19,35,63,0.06)] ring-1 ring-ink/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{title}</h2>
          {hint && <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div role={id ? undefined : "group"} aria-label={id ? undefined : label}>
      {id ? (
        <label htmlFor={id} className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-brand">
          {label}
        </label>
      ) : (
        <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-brand">{label}</div>
      )}
      {children}
    </div>
  );
}

/** Single-choice chips (a radio group). */
function Choice<T extends string | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: React.ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.title}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={chip(value === o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ label, list, value, onChange }: { label: string; list: Swatch[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {list.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          aria-label={s.label}
          title={s.label}
          onClick={() => onChange(s.id)}
          className={`h-9 w-9 rounded-full shadow-inner ring-offset-2 ring-offset-paper transition ${value === s.id ? "ring-[3px] ring-brand" : "ring-1 ring-ink/15 hover:ring-2 hover:ring-brand/40"}`}
          style={{ background: s.color }}
        />
      ))}
    </div>
  );
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function surprise(current: AvatarLook): Partial<AvatarLook> {
  return {
    skin: pick(SKIN_TONES).id,
    hairStyle: pick(HAIR_STYLES).id,
    hair: pick(HAIR_COLORS).id,
    outfit: pick(OUTFIT_COLORS).id,
    expression: pick(EXPRESSIONS).id,
    freckles: Math.random() < 0.3,
    glasses: Math.random() < 0.6 ? "none" : pick(GLASSES.slice(1)).id,
    accessory: Math.random() < 0.5 ? "none" : pick(ACCESSORIES.slice(1)).id,
    pin: current.pin,
  };
}

export function ProfileClient() {
  const loaded = useProfileLoaded();
  const profile = useProfile();
  const progress = useProgress();
  const earned = useMemo(() => earnedBadges(progress.stamps), [progress.stamps]);
  const [previewLang, setPreviewLang] = useState<LanguageCode | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const a = profile.avatar;
  const voiceLang = previewLang ?? profile.language ?? "en";

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pt-6">
        <Link href="/" aria-label="Babbli home">
          <Logo />
        </Link>
        <Link href="/" className={PILL}>
          ← Back to destinations
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        <h1 className="font-display text-4xl sm:text-5xl">Your Traveler Profile</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Make Babbli yours. Everything here is saved in this browser only: no account, nothing to sign up for. Changes save as you go.
        </p>

        {loaded && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
            <div className="lg:sticky lg:top-6">
              <Passport profile={profile} progress={progress} />
            </div>

            <div className="space-y-5">
              <Card title="About you" hint="Your nickname stays on this device. Characters only ever learn your pronouns, so they can address you correctly.">
                <Field label="Nickname" id="nickname">
                  <input
                    id="nickname"
                    value={profile.nickname}
                    maxLength={NICKNAME_MAX}
                    placeholder="Traveler"
                    autoComplete="nickname"
                    onChange={(e) => updateProfile({ nickname: cleanNickname(e.target.value) })}
                    className={`${INPUT} text-lg sm:max-w-sm`}
                  />
                </Field>
                <Field label="Pronouns">
                  <Choice
                    label="Pronouns"
                    value={profile.pronouns}
                    options={[...PRONOUN_OPTIONS.map((o) => ({ id: o.id, label: o.label })), { id: null, label: "Prefer not to say" }]}
                    onChange={(pronouns) => updateProfile({ pronouns })}
                  />
                  {profile.pronouns === "custom" && (
                    <input
                      aria-label="Your pronouns"
                      value={profile.customPronouns}
                      maxLength={PRONOUNS_MAX}
                      placeholder="e.g. xe/xem"
                      onChange={(e) => updateProfile({ customPronouns: cleanPronouns(e.target.value) })}
                      className={`${INPUT} mt-3 sm:max-w-xs`}
                    />
                  )}
                  <p className="mt-2 text-sm text-ink-soft">
                    In French and Spanish scenes, characters use these for grammatical agreement: <span lang="es">bienvenida</span> ·{" "}
                    <span lang="es">bienvenido</span> · <span lang="es">le damos la bienvenida</span>.
                  </p>
                </Field>
              </Card>

              <Card
                title="Avatar"
                hint="Drawn in the same style as the characters you meet."
                action={
                  <button type="button" onClick={() => updateAvatar(surprise(a))} className={PILL}>
                    🎲 Surprise me
                  </button>
                }
              >
                <Field label="Skin tone">
                  <Swatches label="Skin tone" list={SKIN_TONES} value={a.skin} onChange={(skin) => updateAvatar({ skin })} />
                </Field>
                <Field label="Hair style">
                  <div role="radiogroup" aria-label="Hair style" className="flex flex-wrap gap-2.5">
                    {HAIR_STYLES.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        role="radio"
                        aria-checked={a.hairStyle === h.id}
                        onClick={() => updateAvatar({ hairStyle: h.id })}
                        className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-1.5 pb-1 text-xs font-bold transition ${
                          a.hairStyle === h.id ? "border-brand bg-brand/10" : "border-ink/10 hover:border-brand/40"
                        }`}
                      >
                        <Avatar look={{ ...a, hairStyle: h.id, accessory: a.accessory === "beanie" ? "none" : a.accessory, pin: "none" }} size={56} label="" />
                        {h.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Hair color">
                  <Swatches label="Hair color" list={HAIR_COLORS} value={a.hair} onChange={(hair) => updateAvatar({ hair })} />
                </Field>
                <Field label="Outfit color">
                  <Swatches label="Outfit color" list={OUTFIT_COLORS} value={a.outfit} onChange={(outfit) => updateAvatar({ outfit })} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Expression">
                    <Choice label="Expression" value={a.expression} options={EXPRESSIONS} onChange={(expression) => updateAvatar({ expression })} />
                  </Field>
                  <Field label="Freckles">
                    <Choice
                      label="Freckles"
                      value={a.freckles ? "on" : "off"}
                      options={[
                        { id: "off", label: "None" },
                        { id: "on", label: "Freckles" },
                      ]}
                      onChange={(v) => updateAvatar({ freckles: v === "on" })}
                    />
                  </Field>
                  <Field label="Glasses">
                    <Choice label="Glasses" value={a.glasses} options={GLASSES} onChange={(glasses) => updateAvatar({ glasses })} />
                  </Field>
                  <Field label="Accessory">
                    <Choice label="Accessory" value={a.accessory} options={ACCESSORIES} onChange={(accessory) => updateAvatar({ accessory })} />
                  </Field>
                </div>
                <Field label="Pin">
                  <div role="radiogroup" aria-label="Pin" className="flex flex-wrap gap-2">
                    <button type="button" role="radio" aria-checked={a.pin === "none"} onClick={() => updateAvatar({ pin: "none" })} className={chip(a.pin === "none")}>
                      None
                    </button>
                    {BADGES.map((b) => {
                      const have = earned.has(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          role="radio"
                          aria-checked={a.pin === b.id}
                          aria-label={have ? b.name : `${b.name} (locked: ${b.how.toLowerCase()})`}
                          title={have ? b.name : `Locked: ${b.how}`}
                          disabled={!have}
                          onClick={() => updateAvatar({ pin: b.id })}
                          className={`rounded-full border-2 p-0.5 transition disabled:cursor-not-allowed ${a.pin === b.id ? "border-brand bg-brand/10" : "border-transparent hover:border-brand/40"}`}
                        >
                          <Pin id={b.id} size={36} locked={!have} />
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">Earn pins by finishing scenes, then wear your favourite.</p>
                </Field>
              </Card>

              <Card title="Scene defaults" hint="Pre-selected when you start a scene. You can still change them before each one.">
                <Field label="Preferred destination">
                  <Choice
                    label="Preferred destination"
                    value={profile.language}
                    options={[
                      { id: null, label: "No preference" },
                      ...LANGUAGES.map((l) => ({
                        id: l.code,
                        label: (
                          <span className="inline-flex items-center gap-1.5">
                            <Flag code={l.code} /> {l.name}
                          </span>
                        ),
                      })),
                    ]}
                    onChange={(language) => updateProfile({ language })}
                  />
                </Field>
                <Field label="Difficulty">
                  <Choice
                    label="Difficulty"
                    value={profile.difficulty}
                    options={DIFFICULTIES.map((d) => ({ id: d.id, label: d.label, title: d.summary }))}
                    onChange={(difficulty) => updateProfile({ difficulty })}
                  />
                </Field>
                <Field label="Respond with">
                  <Choice
                    label="Respond with"
                    value={profile.responseMode}
                    options={[
                      { id: "voice", label: "🎙 Voice" },
                      { id: "text", label: "⌨ Text" },
                    ]}
                    onChange={(responseMode) => updateProfile({ responseMode })}
                  />
                </Field>
              </Card>

              <Card
                title="Coach voice"
                hint="The native voice for hints, “Hear” buttons and model phrases in your results. Scores always use the standard coach as their timing reference, so this never changes a score."
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-ink-soft">Preview in</span>
                  {LANGUAGES.map((l) => (
                    <button key={l.code} type="button" onClick={() => setPreviewLang(l.code)} aria-pressed={voiceLang === l.code} className={chip(voiceLang === l.code)}>
                      <span className="inline-flex items-center gap-1.5">
                        <Flag code={l.code} /> {l.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div role="radiogroup" aria-label="Coach voice" className="grid gap-3 sm:grid-cols-2">
                  {(["standard", "alternate"] as CoachVoice[]).map((v) => (
                    <div key={v} className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 transition ${profile.coachVoice === v ? "border-brand bg-brand/10" : "border-ink/10"}`}>
                      <button type="button" role="radio" aria-checked={profile.coachVoice === v} onClick={() => updateProfile({ coachVoice: v })} className="min-w-0 flex-1 text-left">
                        <div className="font-display text-lg">{v === "standard" ? "Coach 1" : "Coach 2"}</div>
                        <div className="text-sm text-ink-soft">{COACH_VOICES[voiceLang][v]}</div>
                      </button>
                      <PlayButton key={`${v}-${voiceLang}`} label="Preview" tone="native" getSrc={async () => (await api.tts(COACH_SAMPLES[voiceLang], coachVoiceKey(voiceLang, v), 1)).url} />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-ink-soft">Coach 2 is designed with ElevenLabs Voice Design the first time it plays, so its first preview can take a few seconds.</p>
              </Card>

              <Card title="Passport pins" hint="Collected by finishing scenes on this device. Purely cosmetic: pins never affect your scores.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {BADGES.map((b) => {
                    const have = earned.has(b.id);
                    const when = progress.unlocked.find((u) => u.id === b.id)?.at;
                    return (
                      <div key={b.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${have ? "bg-paper ring-ink/10" : "bg-ink/[0.03] ring-transparent"}`}>
                        <Pin id={b.id} size={48} locked={!have} />
                        <div className="min-w-0">
                          <div className={`font-bold ${have ? "" : "text-ink-soft"}`}>{b.name}</div>
                          <div className="text-sm text-ink-soft">{have ? (when ? `Earned ${new Date(when).toLocaleDateString()}` : "Earned") : `🔒 ${b.how}`}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="flex flex-wrap items-center gap-3 px-1 text-sm text-ink-soft">
                {confirmReset ? (
                  <>
                    <span className="font-bold text-ink">Clear your profile and pins on this device?</span>
                    <button
                      type="button"
                      onClick={() => {
                        resetProfile();
                        setConfirmReset(false);
                      }}
                      className="rounded-full bg-coral px-3 py-1.5 font-bold text-white"
                    >
                      Yes, reset
                    </button>
                    <button type="button" onClick={() => setConfirmReset(false)} className={PILL}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmReset(true)} className="font-bold underline-offset-2 hover:text-ink hover:underline">
                    Reset profile
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

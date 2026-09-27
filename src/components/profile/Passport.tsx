"use client";

import { Flag } from "@/components/ui/Flag";
import type { Progress } from "@/lib/client/profileStore";
import { BADGES, earnedBadges, type SceneStamp } from "@/lib/profile/badges";
import { displayName, pronounsOf, type Profile } from "@/lib/profile/profile";
import { LANGUAGES } from "@/lib/scenarios";
import { DIFFICULTIES } from "@/lib/scenarios/types";
import { Avatar } from "./Avatar";
import { Pin } from "./Pin";

/** A short third-person line about the learner, using their pronouns (they/them when unset). */
export function travelerBio(profile: Profile, stamps: SceneStamp[], pins: number) {
  const name = displayName(profile);
  const p = pronounsOf(profile);
  const They = p.subject.charAt(0).toUpperCase() + p.subject.slice(1);
  const done = stamps.filter((s) => s.completed);
  const lang = LANGUAGES.find((l) => l.code === profile.language)?.name;
  if (!done.length) {
    return `${name} is packed and ready to go. ${They} ${p.plural ? "haven't" : "hasn't"} finished a scene yet, so the first pin is one conversation away.`;
  }
  const cities = new Set(done.map((s) => s.scenarioId)).size;
  const scenes = `${done.length} ${done.length === 1 ? "scene" : "scenes"}`;
  const where = `${cities} ${cities === 1 ? "city" : "cities"}`;
  const focus = lang ? ` and ${p.plural ? "are" : "is"} focusing on ${lang}` : "";
  return `${name} has finished ${scenes} in ${where}. ${They} ${p.plural ? "have" : "has"} earned ${pins} of ${BADGES.length} pins${focus}.`;
}

/** The Traveler Profile card: avatar, name, pronouns, defaults and pins. */
export function Passport({ profile, progress }: { profile: Profile; progress: Progress }) {
  const name = displayName(profile);
  const earned = earnedBadges(progress.stamps);
  const lang = LANGUAGES.find((l) => l.code === profile.language);
  const diff = DIFFICULTIES.find((d) => d.id === profile.difficulty)!;
  const facts: [string, React.ReactNode][] = [
    [
      "Destination",
      lang ? (
        <span className="inline-flex items-center gap-1.5">
          <Flag code={lang.code} /> {lang.name}
        </span>
      ) : (
        "Anywhere"
      ),
    ],
    ["Difficulty", diff.label],
    ["Respond with", profile.responseMode === "text" ? "⌨ Text" : "🎙 Voice"],
    ["Coach", profile.coachVoice === "standard" ? "Coach 1" : "Coach 2"],
  ];

  return (
    <aside aria-label="Traveler profile card" className="overflow-hidden rounded-3xl bg-paper shadow-[0_12px_32px_rgba(19,35,63,0.10)] ring-1 ring-ink/10">
      <div className="flex items-center justify-between bg-navy px-5 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gold">Traveler Profile</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-cream/60">Babbli</span>
      </div>
      <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
        <Avatar look={profile.avatar} size={168} label={`${name}'s avatar`} />
        <div className="mt-3 max-w-full truncate font-display text-3xl">{name}</div>
        <div className="mt-1 rounded-full bg-brand/10 px-3 py-0.5 text-sm font-bold text-brand">{profile.pronouns ? pronounsOf(profile).label : "Pronouns not set"}</div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{travelerBio(profile, progress.stamps, earned.size)}</p>
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-ink/10 bg-ink/10 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-paper px-4 py-3">
            <dt className="text-[11px] font-black uppercase tracking-[0.15em] text-ink-soft">{k}</dt>
            <dd className="mt-0.5 font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-ink/10 px-5 py-4">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em] text-ink-soft">
          <span>Pins</span>
          <span>
            {earned.size} / {BADGES.length}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BADGES.map((b) => (
            <span key={b.id} title={earned.has(b.id) ? b.name : `Locked: ${b.how}`}>
              <Pin id={b.id} size={32} locked={!earned.has(b.id)} />
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

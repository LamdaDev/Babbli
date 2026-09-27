"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo } from "react";
import { Flag } from "@/components/ui/Flag";
import { useProfile, useProfileLoaded, useProgress } from "@/lib/client/profileStore";
import { BADGES, earnedBadges } from "@/lib/profile/badges";
import { displayName, isDefaultProfile, pronounsOf } from "@/lib/profile/profile";
import { LANGUAGES } from "@/lib/scenarios";
import { DIFFICULTIES, type LanguageCode } from "@/lib/scenarios/types";
import { Avatar } from "./Avatar";
import { Pin } from "./Pin";

/** Header link to the profile: the avatar and nickname. */
export function ProfileChip({ className = "" }: { className?: string }) {
  const loaded = useProfileLoaded();
  const profile = useProfile();
  return (
    <Link href="/profile" className={`flex items-center gap-2 py-1 pl-1 ${className}`} title="Your Traveler Profile">
      {loaded ? <Avatar look={profile.avatar} size={28} label="" /> : <span className="h-7 w-7 rounded-full bg-ink/10" />}
      <span className="max-w-[8rem] truncate">{loaded ? displayName(profile) : "Profile"}</span>
    </Link>
  );
}

/** The home screen's Traveler card: who's playing, their pins, and a shortcut to their language. */
export function TravelerStrip({ onGo }: { onGo: (code: LanguageCode) => void }) {
  const loaded = useProfileLoaded();
  const profile = useProfile();
  const progress = useProgress();
  const earned = useMemo(() => earnedBadges(progress.stamps), [progress.stamps]);
  if (!loaded) return <div className="mt-6 min-h-[80px]" aria-hidden />;

  const fresh = isDefaultProfile(profile);
  const lang = LANGUAGES.find((l) => l.code === profile.language);
  const summary = [
    profile.pronouns && pronounsOf(profile).label,
    `${earned.size} of ${BADGES.length} pins`,
    DIFFICULTIES.find((d) => d.id === profile.difficulty)?.label,
    profile.responseMode === "text" ? "Text" : "Voice",
  ]
    .filter(Boolean)
    .join(" · ");
  const pins = BADGES.filter((b) => earned.has(b.id)).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 flex min-h-[80px] max-w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-paper p-2.5 pr-4 shadow-sm ring-1 ring-ink/10 sm:w-fit"
    >
      <Link href="/profile" aria-label="Your Traveler Profile" className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand/40">
        <Avatar look={profile.avatar} size={60} label="" />
      </Link>
      <div className="min-w-0">
        <div className="font-display text-xl leading-tight">{fresh ? "Hi, Traveler!" : `Hi, ${displayName(profile)}!`}</div>
        <div className="text-sm text-ink-soft">{fresh ? "Make Babbli yours: a nickname, an avatar and your defaults." : summary}</div>
      </div>
      {pins.length > 0 && (
        <div className="flex -space-x-1.5" aria-label={`Pins: ${pins.map((b) => b.name).join(", ")}`}>
          {pins.map((b) => (
            <span key={b.id} title={b.name}>
              <Pin id={b.id} size={30} />
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {lang && (
          <button
            type="button"
            onClick={() => onGo(lang.code)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
          >
            Continue in <Flag code={lang.code} /> {lang.name} →
          </button>
        )}
        <Link
          href="/profile"
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${fresh ? "bg-brand text-white hover:bg-brand-dark" : "ring-1 ring-ink/10 hover:ring-brand/40"}`}
        >
          {fresh ? "Set up your profile →" : "Edit profile"}
        </Link>
      </div>
    </motion.div>
  );
}

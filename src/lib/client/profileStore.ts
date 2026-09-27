"use client";

import { useEffect } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { earnedBadges, type BadgeId, type SceneStamp } from "@/lib/profile/badges";
import { DEFAULT_PROFILE, sanitizeProfile, type AvatarLook, type Profile } from "@/lib/profile/profile";

/**
 * The Traveler Profile and passport progress, kept in this browser only (localStorage). The store
 * starts with defaults — which is also what the server renders — and loads the saved copy after
 * mount, so pages hydrate cleanly and still work when storage is blocked.
 */

export interface Unlock {
  id: BadgeId;
  at: number;
  sessionId: string;
}

export interface Progress {
  stamps: SceneStamp[];
  unlocked: Unlock[];
}

interface ProfileState {
  loaded: boolean;
  profile: Profile;
  progress: Progress;
}

const PROFILE_KEY = "babbli:profile";
const PROGRESS_KEY = "babbli:progress";
const MAX_STAMPS = 200;
const EMPTY_PROGRESS: Progress = { stamps: [], unlocked: [] };

export const profileStore = createStore<ProfileState>(() => ({ loaded: false, profile: DEFAULT_PROFILE, progress: EMPTY_PROGRESS }));

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full: the profile still works for this visit */
  }
}

function sanitizeProgress(raw: unknown): Progress {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Progress>;
  const stamps = Array.isArray(p.stamps) ? p.stamps.filter((s): s is SceneStamp => !!s && typeof s.sessionId === "string" && typeof s.scenarioId === "string") : [];
  const unlocked = Array.isArray(p.unlocked) ? p.unlocked.filter((u): u is Unlock => !!u && typeof u.id === "string" && typeof u.sessionId === "string") : [];
  return { stamps: stamps.slice(-MAX_STAMPS), unlocked };
}

function loadFromStorage() {
  profileStore.setState({ loaded: true, profile: sanitizeProfile(read(PROFILE_KEY)), progress: sanitizeProgress(read(PROGRESS_KEY)) });
}

export function loadProfile() {
  if (typeof window === "undefined" || profileStore.getState().loaded) return;
  loadFromStorage();
}

// Another tab edited the profile: follow it.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROFILE_KEY || e.key === PROGRESS_KEY || e.key === null) loadFromStorage();
  });
}

/** The current profile outside React (the game controller). */
export function getProfile(): Profile {
  loadProfile();
  return profileStore.getState().profile;
}

export function updateProfile(patch: Partial<Omit<Profile, "avatar" | "v">>) {
  loadProfile();
  const profile = sanitizeProfile({ ...profileStore.getState().profile, ...patch });
  profileStore.setState({ profile });
  write(PROFILE_KEY, profile);
}

export function updateAvatar(patch: Partial<AvatarLook>) {
  loadProfile();
  const current = profileStore.getState().profile;
  const profile = sanitizeProfile({ ...current, avatar: { ...current.avatar, ...patch } });
  profileStore.setState({ profile });
  write(PROFILE_KEY, profile);
}

export function resetProfile() {
  profileStore.setState({ profile: DEFAULT_PROFILE, progress: EMPTY_PROGRESS, loaded: true });
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* nothing stored */
  }
}

/** Remember a finished scene; returns the badges it unlocked. */
export function recordScene(stamp: SceneStamp): BadgeId[] {
  loadProfile();
  const { progress } = profileStore.getState();
  const before = earnedBadges(progress.stamps);
  const stamps = [...progress.stamps.filter((s) => s.sessionId !== stamp.sessionId), stamp].slice(-MAX_STAMPS);
  const fresh = [...earnedBadges(stamps)].filter((id) => !before.has(id));
  const next: Progress = { stamps, unlocked: [...progress.unlocked, ...fresh.map((id) => ({ id, at: stamp.at, sessionId: stamp.sessionId }))] };
  profileStore.setState({ progress: next });
  write(PROGRESS_KEY, next);
  return fresh;
}

/** Subscribe to the profile store (loads the saved profile after the first render). */
export function useProfileState<T>(selector: (s: ProfileState) => T): T {
  useEffect(() => loadProfile(), []);
  return useStore(profileStore, selector);
}

export const useProfile = () => useProfileState((s) => s.profile);
export const useProgress = () => useProfileState((s) => s.progress);
export const useProfileLoaded = () => useProfileState((s) => s.loaded);

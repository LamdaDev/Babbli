"use client";

import { useEffect, useState } from "react";

let current: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function stopCurrent() {
  current?.pause();
  current = null;
  listeners.forEach((l) => l());
}

/** One-at-a-time audio playback for recordings and ElevenLabs reference audio. */
export function PlayButton({
  src,
  getSrc,
  label,
  tone = "ink",
}: {
  src?: string;
  getSrc?: () => Promise<string>;
  label: string;
  tone?: "ink" | "native" | "learner";
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const l = () => setPlaying(false);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const toggle = async () => {
    if (playing) {
      stopCurrent();
      return;
    }
    stopCurrent();
    setError(false);
    try {
      setLoading(true);
      const url = src ?? (await getSrc?.());
      if (!url) throw new Error("no audio");
      const audio = new Audio(url);
      current = audio;
      audio.onended = () => {
        if (current === audio) current = null;
        setPlaying(false);
      };
      await audio.play();
      setPlaying(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const colors =
    tone === "native" ? "bg-[#2a78d6] text-white" : tone === "learner" ? "bg-[#eb6834] text-white" : "bg-ink text-cream";
  return (
    <button onClick={() => void toggle()} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${colors} disabled:opacity-50`} disabled={loading}>
      <span aria-hidden>{loading ? "…" : playing ? "■" : "▶"}</span>
      {error ? "Unavailable" : label}
    </button>
  );
}

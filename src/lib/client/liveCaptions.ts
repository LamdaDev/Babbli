"use client";

import { CommitStrategy, RealtimeEvents, Scribe, type RealtimeConnection } from "@elevenlabs/client";
import { cleanTranscript } from "@/lib/evaluation/text";
import { api } from "./api";

/**
 * Live captions of the learner's speech via ElevenLabs realtime Scribe
 * (used in push-to-talk, where the agent doesn't hear the mic until the turn ends).
 */
export class LiveCaptions {
  private conn: RealtimeConnection | null = null;
  private committed = "";
  private generation = 0;

  constructor(private onText: (text: string) => void) {}

  private join(a: string, b: string, language: string) {
    if (!a) return b.trim();
    if (!b.trim()) return a;
    return language === "ja" ? `${a}${b.trim()}` : `${a} ${b.trim()}`;
  }

  async start(language: string, keyterms: string[]) {
    this.stop();
    const gen = ++this.generation;
    this.committed = "";
    const { token } = await api.scribeToken();
    if (gen !== this.generation) return; // stopped while fetching the token
    const conn = Scribe.connect({
      token,
      modelId: "scribe_v2_realtime",
      languageCode: language,
      commitStrategy: CommitStrategy.VAD,
      // Ignore background chatter / ambient noise, and blips too short to be words (clicks, notifications).
      filterBackgroundAudio: true,
      minSpeechDurationMs: 250,
      keyterms: keyterms.filter((k) => k.length <= 20).slice(0, 50),
      microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    conn.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (d) => {
      if (gen === this.generation) this.onText(this.join(this.committed, cleanTranscript(d.text), language));
    });
    conn.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (d) => {
      if (gen !== this.generation) return;
      this.committed = this.join(this.committed, cleanTranscript(d.text), language);
      this.onText(this.committed);
    });
    conn.on(RealtimeEvents.ERROR, (e) => console.warn("[babbli] glive captions error", e));
    this.conn = conn;
  }

  stop() {
    this.generation++;
    const conn = this.conn;
    this.conn = null;
    try {
      conn?.close();
    } catch {
      /* already closed */
    }
  }
}

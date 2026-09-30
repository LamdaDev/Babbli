"use client";

import type { TtsResult } from "./api";

/** ElevenAgents streams the NPC's voice as raw 16-bit mono PCM (the agent default, pcm_16000). */
const SAMPLE_RATE = 16000;
/** Only the latest lines can be replayed; older audio is dropped. */
const KEEP = 4;

/** Character timings sent with each audio chunk, relative to the start of that chunk. */
export type ChunkAlignment = { chars: string[]; char_start_times_ms: number[]; char_durations_ms: number[] };

export interface AgentClip {
  url: string;
  alignment: TtsResult["alignment"];
}

interface Take {
  chunks: string[];
  bytes: number;
  chars: string[];
  starts: number[];
  ends: number[];
  clip?: AgentClip;
}

/** Decoded size of a base64 string, without decoding it. */
const byteLength = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/**
 * The audio ElevenAgents streamed for the NPC's latest lines, kept so Repeat and Slow can play a
 * line again exactly as it was spoken instead of generating it again with Text to Speech.
 * Chunks are grouped by the response's event id; each NPC line is linked to the response that voiced it.
 */
export class AgentAudioTape {
  private takes = new Map<number, Take>();
  private lines = new Map<string, number>();

  constructor(private onRelease: (url: string) => void = () => undefined) {}

  add(eventId: number, audio: string, alignment?: ChunkAlignment | null) {
    let take = this.takes.get(eventId);
    if (!take) {
      take = { chunks: [], bytes: 0, chars: [], starts: [], ends: [] };
      this.takes.set(eventId, take);
      this.prune();
    }
    if (alignment?.chars?.length) {
      const offset = (take.bytes / 2 / SAMPLE_RATE) * 1000;
      alignment.chars.forEach((c, i) => {
        const start = offset + (alignment.char_start_times_ms[i] ?? 0);
        take.chars.push(c);
        take.starts.push(start / 1000);
        take.ends.push((start + (alignment.char_durations_ms[i] ?? 0)) / 1000);
      });
    }
    take.chunks.push(audio);
    take.bytes += byteLength(audio);
    this.release(take);
  }

  /** Link an NPC line to the agent response that voiced it. */
  bind(lineId: string, eventId: number) {
    this.lines.set(lineId, eventId);
  }

  /** The line's original audio as a playable WAV (null when none was streamed, e.g. Text Mode). */
  clip(lineId: string): AgentClip | null {
    const eventId = this.lines.get(lineId);
    const take = eventId === undefined ? undefined : this.takes.get(eventId);
    if (!take?.bytes) return null;
    take.clip ??= {
      url: URL.createObjectURL(wav(take.chunks)),
      alignment: take.chars.length ? { characters: take.chars, character_start_times_seconds: take.starts, character_end_times_seconds: take.ends } : null,
    };
    return take.clip;
  }

  clear() {
    for (const take of this.takes.values()) this.release(take);
    this.takes.clear();
    this.lines.clear();
  }

  private prune() {
    for (const [eventId, take] of this.takes) {
      if (this.takes.size <= KEEP) break;
      this.release(take);
      this.takes.delete(eventId);
      for (const [lineId, id] of this.lines) if (id === eventId) this.lines.delete(lineId);
    }
  }

  private release(take: Take) {
    if (!take.clip) return;
    URL.revokeObjectURL(take.clip.url);
    this.onRelease(take.clip.url);
    take.clip = undefined;
  }
}

/** Wrap 16-bit mono PCM chunks (base64) in a WAV header so the browser can decode and time-stretch it. */
function wav(chunks: string[]): Blob {
  const parts = chunks.map((c) => Uint8Array.from(atob(c), (ch) => ch.charCodeAt(0)));
  const size = parts.reduce((n, p) => n + p.length, 0);
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => header.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, 36 + size, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, SAMPLE_RATE, true);
  header.setUint32(28, SAMPLE_RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  text(36, "data");
  header.setUint32(40, size, true);
  return new Blob([header.buffer, ...parts], { type: "audio/wav" });
}

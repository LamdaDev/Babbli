"use client";

import type { AgentAnalysis, SessionRecord, SessionSummary, SpeechCapture } from "@/lib/session/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, (body as { code?: string }).code);
  return body as T;
}

export interface AgentSession {
  signedUrl: string;
  agentId: string;
  toolName: string;
  llm?: string;
  ttsModel?: string;
}

export interface TtsResult {
  key: string;
  url: string;
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
  duration: number;
}

export const api = {
  agentSession: (scenarioId: string) => fetch(`/api/agent/session?scenario=${scenarioId}`).then((r) => json<AgentSession>(r)),

  tts: (text: string, voiceKey: string, speed = 1) =>
    fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voiceKey, speed }),
    }).then((r) => json<TtsResult>(r)),

  stt: (blob: Blob, language: string, keyterms: string[] = []) => {
    const form = new FormData();
    form.set("file", blob, "turn.webm");
    form.set("language", language);
    form.set("keyterms", JSON.stringify(keyterms));
    return fetch("/api/stt", { method: "POST", body: form }).then((r) => json<SpeechCapture>(r));
  },

  scribeToken: () => fetch("/api/scribe-token", { method: "POST" }).then((r) => json<{ token: string }>(r)),

  saveSession: (record: SessionRecord) =>
    fetch(`/api/sessions/${record.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      keepalive: JSON.stringify(record).length < 60000,
    }).then((r) => json<{ ok: true }>(r)),

  uploadTurnAudio: (sessionId: string, turnId: string, blob: Blob) =>
    fetch(`/api/sessions/${sessionId}/audio/${turnId}`, {
      method: "PUT",
      headers: { "content-type": blob.type || "audio/webm" },
      body: blob,
    }).then((r) => json<{ ok: true }>(r)),

  session: (id: string) => fetch(`/api/sessions/${id}`).then((r) => json<SessionRecord>(r)),
  sessions: () => fetch(`/api/sessions`).then((r) => json<{ sessions: SessionSummary[] }>(r)),
  analysis: (id: string) => fetch(`/api/sessions/${id}/analysis`).then((r) => json<AgentAnalysis>(r)),
};

export const assetUrl = (id: string) => `/api/assets/${id}`;
export const turnAudioUrl = (sessionId: string, turnId: string) => `/api/sessions/${sessionId}/audio/${turnId}`;

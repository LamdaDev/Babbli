import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionRecord } from "@/lib/session/types";
import { MAX_CONVERSATION_SECONDS } from "./agents";
import { env } from "./env";

const ID = /^[a-z0-9-]{6,64}$/i;
const dir = () => path.join(env.dataDir, "sessions");

export function validId(id: string) {
  return ID.test(id);
}

function sessionDir(id: string) {
  if (!validId(id)) throw new Error("Invalid id");
  return path.join(dir(), id);
}

export async function saveSession(record: SessionRecord) {
  const d = sessionDir(record.id);
  await fs.mkdir(d, { recursive: true });
  await fs.writeFile(path.join(d, "session.json"), JSON.stringify(record));
}

export async function loadSession(id: string): Promise<SessionRecord | null> {
  if (!validId(id)) return null;
  // A save may be rewriting the file at this very moment (the scene saves after every reply, and a
  // read mid-write sees half a file): read it again a moment later rather than report it missing.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return JSON.parse(await fs.readFile(path.join(sessionDir(id), "session.json"), "utf8")) as SessionRecord;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return null;
}

/**
 * A session being played right now: saved within the longest possible conversation (server clock)
 * and not finished. Only these may voice NPC lines or transcribe new recordings.
 */
export async function liveSession(id: unknown): Promise<SessionRecord | null> {
  if (typeof id !== "string" || !validId(id)) return null;
  const s = await loadSession(id);
  const age = Date.now() - (s?.firstSavedAt ?? 0);
  return s && s.status === "active" && age < (MAX_CONVERSATION_SECONDS + 300) * 1000 ? s : null;
}

export async function saveTurnAudio(id: string, turnId: string, bytes: Buffer, mime: string) {
  if (!validId(turnId)) throw new Error("Invalid turn id");
  const d = sessionDir(id);
  await fs.mkdir(d, { recursive: true });
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
  await fs.writeFile(path.join(d, `turn-${turnId}.${ext}`), bytes);
}

export async function loadTurnAudio(id: string, turnId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!validId(turnId)) return null;
  const d = sessionDir(id);
  for (const [ext, mime] of [
    ["webm", "audio/webm"],
    ["ogg", "audio/ogg"],
    ["m4a", "audio/mp4"],
  ] as const) {
    try {
      return { bytes: await fs.readFile(path.join(d, `turn-${turnId}.${ext}`)), mime };
    } catch {
      /* try next */
    }
  }
  return null;
}


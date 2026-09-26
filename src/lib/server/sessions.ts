import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionRecord, SessionSummary } from "@/lib/session/types";
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
  try {
    return JSON.parse(await fs.readFile(path.join(sessionDir(id), "session.json"), "utf8")) as SessionRecord;
  } catch {
    return null;
  }
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

export async function listSessions(limit = 12): Promise<SessionSummary[]> {
  let ids: string[] = [];
  try {
    ids = await fs.readdir(dir());
  } catch {
    return [];
  }
  const records = await Promise.all(ids.filter(validId).map((id) => loadSession(id)));
  return records
    .filter((r): r is SessionRecord => !!r && r.turns.length > 0)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      scenarioId: r.scenarioId,
      difficulty: r.difficulty,
      startedAt: r.startedAt,
      status: r.status,
      objectiveComplete: r.state.objectiveComplete,
      turns: r.turns.length,
    }));
}

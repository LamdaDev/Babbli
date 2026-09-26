import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";

/**
 * Local record of the ElevenLabs resources Babbli provisioned (designed voices,
 * client tools, agents) so they are created once and updated only when their
 * configuration changes.
 */
export interface Registry {
  voices: Record<string, { voiceId: string; name: string; designed: boolean; error?: string; updatedAt: string }>;
  tools: Record<string, { toolId: string; hash: string; updatedAt: string }>;
  agents: Record<
    string,
    { agentId: string; hash: string; voiceId: string; toolId: string; llm?: string; ttsModel?: string; degraded?: string; updatedAt: string }
  >;
}

const file = () => path.join(env.dataDir, "registry.json");
let cache: Registry | null = null;
let writing: Promise<void> = Promise.resolve();

export async function readRegistry(): Promise<Registry> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(file(), "utf8")) as Registry;
  } catch {
    cache = { voices: {}, tools: {}, agents: {} };
  }
  cache.voices ??= {};
  cache.tools ??= {};
  cache.agents ??= {};
  return cache;
}

export async function updateRegistry(mutate: (r: Registry) => void) {
  const reg = await readRegistry();
  mutate(reg);
  writing = writing.then(async () => {
    await fs.mkdir(env.dataDir, { recursive: true });
    await fs.writeFile(file(), JSON.stringify(reg, null, 2));
  });
  await writing;
}

export function hashOf(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

/** Deduplicate concurrent async work by key (e.g. two tabs provisioning at once). */
const inflight = new Map<string, Promise<unknown>>();
export function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

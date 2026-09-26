import { requireApiKey } from "./env";

const BASE = "https://api.elevenlabs.io";

export class ElevenLabsError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`ElevenLabs ${path} → ${status}: ${body.slice(0, 600)}`);
  }
}

type Init = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit; query?: Record<string, string | number | boolean | undefined> };

export async function xi(path: string, init: Init = {}): Promise<Response> {
  const key = requireApiKey();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const headers = new Headers(init.headers);
  headers.set("xi-api-key", key);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, headers, body, cache: "no-store" });
  if (!res.ok) {
    throw new ElevenLabsError(res.status, await res.text().catch(() => ""), path);
  }
  return res;
}

export async function xiJson<T>(path: string, init: Init = {}): Promise<T> {
  const res = await xi(path, init);
  return (await res.json()) as T;
}

export async function xiBytes(path: string, init: Init = {}): Promise<Buffer> {
  const res = await xi(path, init);
  return Buffer.from(await res.arrayBuffer());
}

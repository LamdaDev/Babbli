import { ElevenLabsError } from "./elevenlabs";
import { MissingKeyError } from "./env";

export function errorResponse(e: unknown) {
  if (e instanceof MissingKeyError) {
    return Response.json({ error: e.message, code: "missing_key" }, { status: 503 });
  }
  if (e instanceof ElevenLabsError) {
    console.error(`[babbli] ${e.message}`);
    return Response.json({ error: e.message, code: "elevenlabs", upstreamStatus: e.status }, { status: 502 });
  }
  console.error("[babbli]", e);
  return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export function audioResponse(bytes: Buffer, mime = "audio/mpeg", immutable = true) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-length": String(bytes.length),
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}

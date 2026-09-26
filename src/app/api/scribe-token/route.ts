import { xiJson } from "@/lib/server/elevenlabs";
import { errorResponse } from "@/lib/server/http";

/** Single-use token for ElevenLabs realtime Scribe (live captions) — the API key never reaches the browser. */
export async function POST() {
  try {
    const { token } = await xiJson<{ token: string }>("/v1/single-use-token/realtime_scribe", { method: "POST" });
    return Response.json({ token });
  } catch (e) {
    return errorResponse(e);
  }
}

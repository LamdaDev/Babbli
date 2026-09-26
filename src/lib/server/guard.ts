import { createHash, timingSafeEqual } from "node:crypto";

/*
 * Protection for the Studio, which creates and regenerates ElevenLabs resources. The learner
 * experience stays open (no login).
 */

/* ------------------------------------------------------------------ */
/* Studio admin password                                               */
/* ------------------------------------------------------------------ */

const STUDIO_PASSWORD = process.env.STUDIO_PASSWORD || "babbli";
const digest = (s: string) => createHash("sha256").update(s).digest();

/** The Studio needs the admin password in production (sent as the x-studio-password header). */
export function studioAuthError(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production") return null;
  const given = request.headers.get("x-studio-password") ?? "";
  if (timingSafeEqual(digest(given), digest(STUDIO_PASSWORD))) return null;
  return Response.json({ error: "Studio password required", code: "studio_locked" }, { status: 401 });
}

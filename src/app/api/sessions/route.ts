import { errorResponse } from "@/lib/server/http";
import { listSessions } from "@/lib/server/sessions";

export async function GET() {
  try {
    return Response.json({ sessions: await listSessions() });
  } catch (e) {
    return errorResponse(e);
  }
}

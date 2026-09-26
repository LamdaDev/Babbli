import type { Metadata } from "next";
import { StudioClient } from "@/components/studio/StudioClient";

export const metadata: Metadata = { title: "ElevenLabs Studio · Babbli" };

export default function StudioPage() {
  return <StudioClient />;
}

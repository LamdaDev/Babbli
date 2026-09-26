import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScenario } from "@/lib/scenarios";
import type { Difficulty, InputMode } from "@/lib/scenarios/types";
import { GameClient } from "./GameClient";

const DIFFS: Difficulty[] = ["beginner", "intermediate", "immersion"];

export async function generateMetadata(props: PageProps<"/play/[scenarioId]">): Promise<Metadata> {
  const { scenarioId } = await props.params;
  const s = getScenario(scenarioId);
  return { title: s ? `${s.title} · Babbli` : "Babbli" };
}

export default async function PlayPage(props: PageProps<"/play/[scenarioId]">) {
  const { scenarioId } = await props.params;
  const search = await props.searchParams;
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  const d = String(search.difficulty ?? "beginner") as Difficulty;
  const difficulty = DIFFS.includes(d) ? d : "beginner";
  const m = String(search.mode ?? "");
  const inputMode: InputMode = m === "live" || m === "ptt" ? m : difficulty === "beginner" ? "ptt" : "live";
  return <GameClient scenarioId={scenario.id} difficulty={difficulty} inputMode={inputMode} />;
}

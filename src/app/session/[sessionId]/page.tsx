import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Your session · Babbli" };

export default async function SessionPage(props: PageProps<"/session/[sessionId]">) {
  const { sessionId } = await props.params;
  return <Dashboard sessionId={sessionId} />;
}

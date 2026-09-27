import type { Metadata } from "next";
import { ProfileClient } from "@/components/profile/ProfileClient";

export const metadata: Metadata = { title: "Traveler Profile · Babbli" };

export default function ProfilePage() {
  return <ProfileClient />;
}

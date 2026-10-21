import { notFound } from "next/navigation";
import VoiceLab from "./VoiceLab";

export const metadata = { title: "Voice lab (development) — PrepSim", robots: { index: false, follow: false } };

// Development-only tool: in a production build this route does not exist (404), like its API.
export default function VoiceLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VoiceLab />;
}

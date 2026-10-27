import { createFileRoute } from "@tanstack/react-router";
import { JarvisApp } from "@/components/jarvis/jarvis-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <JarvisApp />;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { latestThread, newId } from "@/lib/threads";
import logo from "@/assets/clausurus-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clausurus — private multi-model AI chat" },
      { name: "description", content: "Pick any AI model and chat safely: names, card numbers and IDs are anonymized before they leave your browser." },
      { property: "og:title", content: "Clausurus — private multi-model AI chat" },
      { property: "og:description", content: "Pick any AI model and chat safely: personal data is anonymized before it is sent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = latestThread();
    navigate({ to: "/c/$threadId", params: { threadId: t?.id ?? newId() }, replace: true });
  }, [navigate]);
  return (
    <div className="flex h-screen items-center justify-center">
      <img src={logo} alt="Clausurus" width={48} height={48} className="animate-pulse" />
    </div>
  );
}

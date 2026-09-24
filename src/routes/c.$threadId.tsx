import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureThread, latestThread, useThreads } from "@/lib/threads";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const Route = createFileRoute("/c/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — Clausurus" },
      { name: "description", content: "A private conversation where personal data is anonymized before reaching the AI model." },
      { property: "og:title", content: "Chat — Clausurus" },
      { property: "og:description", content: "A private conversation where personal data is anonymized before reaching the AI model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const thread = threads.find((t) => t.id === threadId);

  useEffect(() => {
    const prev = latestThread();
    ensureThread(threadId, prev ? { model: prev.model, aiCheck: prev.aiCheck } : undefined);
  }, [threadId]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeId={threadId} threads={threads} />
      {thread ? <ChatWindow key={threadId} thread={thread} /> : <div className="flex-1" />}
    </div>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { deleteThread, latestThread, newId, type Thread } from "@/lib/threads";
import { cn } from "@/lib/utils";
import logo from "@/assets/clausurus-logo.png";

export function Sidebar({ activeId, threads }: { activeId: string; threads: Thread[] }) {
  const navigate = useNavigate();
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <img src={logo} alt="" width={28} height={28} />
        <div className="leading-none">
          <div className="font-display text-2xl italic">Clausurus</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            private by default
          </div>
        </div>
      </div>
      <div className="px-3">
        <button
          onClick={() => navigate({ to: "/c/$threadId", params: { threadId: newId() } })}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-foreground"
        >
          <Plus className="size-4" /> New chat
        </button>
      </div>
      <div className="mt-5 px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chats</div>
      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {sorted.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center rounded-md text-sm transition-colors",
              t.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
            )}
          >
            <Link
              to="/c/$threadId"
              params={{ threadId: t.id }}
              className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2"
            >
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
              {t.detections.length > 0 && (
                <span className="ml-auto shrink-0 rounded-sm bg-signal-soft px-1.5 font-mono text-[10px] text-signal">
                  {t.detections.length}
                </span>
              )}
            </Link>
            <button
              aria-label="Delete chat"
              onClick={() => {
                deleteThread(t.id);
                if (t.id === activeId) {
                  const next = latestThread();
                  navigate({ to: "/c/$threadId", params: { threadId: next?.id ?? newId() } });
                }
              }}
              className="mr-1 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-signal group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] leading-snug text-muted-foreground">
        Chats are stored only in this browser.
      </div>
    </aside>
  );
}

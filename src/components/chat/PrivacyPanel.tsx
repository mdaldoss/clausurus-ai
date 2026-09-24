import { useEffect, useState } from "react";
import { ArrowRight, Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Inspect, Pending } from "./ChatWindow";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PII_LABELS } from "@/lib/pii";
import { updateThread, type Thread } from "@/lib/threads";
import { cn } from "@/lib/utils";

function mask(v: string) {
  if (v.length <= 4) return "•".repeat(v.length);
  return v.slice(0, 2) + "•".repeat(Math.min(v.length - 4, 10)) + v.slice(-2);
}

function Placeholdered({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[A-Z_]+_\d+\])/g).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded-sm bg-primary px-1 text-primary-foreground">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function PrivacyPanel({
  thread,
  open,
  onClose,
  inspect,
  onCloseInspect,
  pending,
  onApprove,
  onCancel,
}: {
  thread: Thread;
  open: boolean;
  onClose: () => void;
  inspect: Inspect | null;
  onCloseInspect: () => void;
  pending: Pending | null;
  onApprove: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDraft(pending?.anon ?? "");
    setEditing(false);
  }, [pending]);
  const detections = [...thread.detections].reverse();
  const types = new Set(thread.detections.map((d) => d.type));

  return (
    <aside
      className={cn(
        "flex w-[340px] shrink-0 flex-col border-l bg-card",
        "fixed inset-y-0 right-0 z-40 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-start justify-between border-b px-5 pb-4 pt-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Privacy shield</div>
          <h2 className="mt-1 font-display text-3xl italic leading-none">
            {thread.detections.length === 0 ? "Nothing detected" : `${thread.detections.length} protected`}
          </h2>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground lg:hidden" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pending && (
          <div className="border-b bg-signal-soft/60 px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">Approval needed</div>
            <p className="mt-1 text-[13px] leading-snug">
              This is exactly what will be sent to the AI model.{" "}
              {pending.used.length
                ? `${pending.used.length} item${pending.used.length > 1 ? "s were" : " was"} replaced.`
                : "No personal data was detected."}
            </p>
            {editing ? (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-3 min-h-32 bg-background font-mono text-[12px]"
              />
            ) : (
              <div className="mt-3 whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-[12px] leading-relaxed">
                <Placeholdered text={draft} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => draft.trim() && onApprove(draft.trim())}>
                <Check className="size-3.5" /> Approve &amp; send
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>
                {editing ? "Preview" : "Edit"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {inspect && !pending && (
          <div className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Sent to the AI model
              </div>
              <button onClick={onCloseInspect} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-2 whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-[12px] leading-relaxed">
              <Placeholdered text={inspect.sent} />
            </div>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">You wrote</div>
            <div className="mt-2 whitespace-pre-wrap rounded-md border border-dashed p-3 text-[12px] leading-relaxed text-muted-foreground">
              {inspect.original}
            </div>
          </div>
        )}
        {thread.detections.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            <ShieldCheck className="mb-3 size-6 text-safe" />
            When you type personal data — names, emails, phone numbers, card numbers, IBANs, AHV or social security
            numbers, addresses — it will be listed here and replaced before being sent to the AI model.
          </div>
        ) : (
          <>
            <div className="flex gap-2 border-b bg-signal-soft/60 px-5 py-3 text-[13px] leading-snug">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-signal" />
              <span>
                Sensitive data was detected in your messages and <strong>anonymized before sending</strong> to the
                model. The AI only saw the placeholders on the right.
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-5 pt-4">
              {[...types].map((t) => (
                <span key={t} className="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                  {PII_LABELS[t]}
                </span>
              ))}
            </div>
            <ul className="space-y-2 px-5 py-4">
              {detections.map((d) => (
                <li key={d.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{PII_LABELS[d.type]}</span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {d.source === "ai" ? "Apertus" : "pattern"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[12px]">
                    <span className="truncate text-signal line-through decoration-signal/60" title={d.value}>
                      {mask(d.value)}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground">{d.placeholder}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-4 border-t px-5 py-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Apertus deep scan</span>
            <span className="block text-xs text-muted-foreground">Swiss AI model catches names, addresses & indirect identifiers</span>
          </span>
          <Switch checked={thread.aiCheck} onCheckedChange={(v) => updateThread(thread.id, { aiCheck: v })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Ask before sending</span>
            <span className="block text-xs text-muted-foreground">Review the anonymized message first</span>
          </span>
          <Switch checked={!!thread.approve} onCheckedChange={(v) => updateThread(thread.id, { approve: v })} />
        </label>
        <div>
          <div className="mb-1.5 text-sm font-medium">Custom instructions</div>
          <Textarea
            value={thread.systemPrompt}
            onChange={(e) => updateThread(thread.id, { systemPrompt: e.target.value })}
            placeholder="e.g. Answer in French, be concise…"
            className="min-h-20 resize-none bg-background text-sm"
          />
        </div>
      </div>
    </aside>
  );
}

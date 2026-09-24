import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, PanelRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { anonymize, deanonymize, detectWithRegex, mergeEntities, type Vault } from "@/lib/pii";
import { detectPiiWithAi } from "@/lib/pii.functions";
import { MODELS, findModel } from "@/lib/models";
import { getThread, newId, updateThread, type Thread } from "@/lib/threads";
import { PrivacyPanel } from "./PrivacyPanel";
import { cn } from "@/lib/utils";
import logo from "@/assets/clausurus-logo.png";

type Meta = { original?: string; count?: number };
export type Inspect = { original: string; sent: string };
export type Pending = {
  input: string;
  anon: string;
  vault: Vault;
  used: { type: import("@/lib/pii").PiiType; value: string; placeholder: string }[];
  sources: Record<string, "regex" | "ai">;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Highlighted({ text, vault }: { text: string; vault: Vault }) {
  const values = Object.values(vault).map((v) => v.value).sort((a, b) => b.length - a.length);
  if (!values.length) return <>{text}</>;
  const re = new RegExp(`(${values.map(escapeRe).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-signal px-1 text-signal-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function UserBubble({ message, vault, onInspect }: { message: UIMessage; vault: Vault; onInspect: (i: Inspect) => void }) {
  const [showSent, setShowSent] = useState(false);
  const meta = (message.metadata ?? {}) as Meta;
  const sent = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const original = meta.original ?? sent;
  const count = meta.count ?? 0;
  return (
    <Message from="user">
      <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground whitespace-pre-wrap">
        <p className="leading-relaxed">
          {showSent ? <span className="font-mono text-[13px]">{sent}</span> : <Highlighted text={original} vault={vault} />}
        </p>
      </MessageContent>
      {count > 0 && (
        <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <button
          onClick={() => onInspect({ original, sent })}
          className="flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline"
        >
          <ShieldCheck className="size-3.5 text-signal" />
          {count} item{count > 1 ? "s" : ""} anonymized
        </button>
        ·
        <button onClick={() => setShowSent((s) => !s)} className="flex items-center gap-1 hover:text-foreground">
          {showSent ? (
            <>
              <EyeOff className="size-3" /> show mine
            </>
          ) : (
            <>
              <Eye className="size-3" /> show what the AI saw
            </>
          )}
        </button>
        </div>
      )}
    </Message>
  );
}

export function ChatWindow({ thread }: { thread: Thread }) {
  const threadId = thread.id;
  const [scanning, setScanning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const detectAi = useServerFn(detectPiiWithAi);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const initial = useRef(thread.messages);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: thread.messages,
    transport,
    onError: (e) => toast.error(e.message || "The model returned an error"),
  });

  // persist once a turn settles
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    if (messages === initial.current) return;
    updateThread(threadId, { messages });
  }, [messages, status, threadId]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const busy = !!pending || scanning || status === "submitted" || status === "streaming";
  const model = findModel(thread.model);

  function commit(p: Pending, sentText: string) {
    const current = getThread(threadId) ?? thread;
    const at = Date.now();
    updateThread(threadId, (t) => ({
      vault: p.vault,
      detections: [
        ...t.detections,
        ...p.used.map((u) => ({
          id: newId(),
          messageId: "",
          type: u.type,
          value: u.value,
          placeholder: u.placeholder,
          source: p.sources[u.value] ?? "regex",
          at,
        })),
      ],
      title: t.messages.length || t.title !== "New chat" ? t.title : sentText.slice(0, 48),
    }));
    if (p.used.length) setPanelOpen(true);
    setPending(null);
    sendMessage(
      { text: sentText, metadata: { original: p.input, count: p.used.length } satisfies Meta },
      { body: { model: current.model, system: current.systemPrompt } },
    );
  }

  async function handleSubmit({ text }: PromptInputMessage) {
    const input = text.trim();
    if (!input || busy) return;
    setScanning(true);
    try {
      const regex = detectWithRegex(input);
      let ai: typeof regex = [];
      const current = getThread(threadId) ?? thread;
      if (current.aiCheck) {
        const res = await detectAi({ data: { text: input } });
        ai = res.entities;
        if (res.error) toast.warning(`AI check unavailable — only pattern matching was used. (${res.error})`);
      }
      const entities = mergeEntities(regex, ai);
      const { text: anon, vault, used } = anonymize(input, entities, current.vault);
      const sources: Pending["sources"] = {};
      for (const u of used)
        sources[u.value] = entities.find((e) => e.value.toLowerCase() === u.value.toLowerCase())?.source ?? "regex";
      const p: Pending = { input, anon, vault, used, sources };
      if (current.approve) {
        setInspect(null);
        setPending(p);
        setPanelOpen(true);
      } else commit(p, anon);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <Select value={thread.model} onValueChange={(v) => updateThread(threadId, { model: v })}>
            <SelectTrigger className="h-9 w-auto min-w-56 border-transparent bg-transparent font-medium shadow-none hover:bg-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["OpenAI", "Google", "Anthropic"] as const).map((vendor) => (
                <Fragment key={vendor}>
                  <div className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {vendor}
                  </div>
                  {MODELS.filter((m) => m.vendor === vendor).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.note}</span>
                    </SelectItem>
                  ))}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
          <span
            className={cn(
              "hidden rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider sm:inline",
              model.zeroRetention ? "bg-secondary text-safe" : "bg-signal-soft text-signal",
            )}
            title={model.zeroRetention ? "Provider keeps no copy of your prompts" : "Provider may retain prompts"}
          >
            {model.zeroRetention ? "zero retention" : "provider retains"}
          </span>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="ml-auto flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent lg:hidden"
          >
            <PanelRight className="size-4" />
            Privacy
            {thread.detections.length > 0 && (
              <span className="rounded-sm bg-signal px-1.5 font-mono text-[10px] text-signal-foreground">
                {thread.detections.length}
              </span>
            )}
          </button>
        </header>

        <Conversation className="flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-8">
            {messages.length === 0 && !scanning && !pending ? (
              <ConversationEmptyState>
                <img src={logo} alt="" width={56} height={56} />
                <h1 className="mt-4 font-display text-5xl italic leading-none">Say anything.</h1>
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  Names, card numbers, AHV / social security numbers, emails and addresses are detected and replaced
                  with placeholders <span className="font-mono text-foreground">before</span> your message reaches{" "}
                  {model.label}.
                </p>
                <div className="mt-6 grid w-full max-w-lg gap-2 text-left sm:grid-cols-2">
                  {[
                    "Write an email to Anna Keller (anna.keller@gmx.ch) asking her to resend the invoice for the plumbing repair",
                    "My card 4111 1111 1111 1111 was charged twice for the same Migros order — draft a complaint to my bank",
                    "Summarize this patient file for the referral: Luca Bernasconi, born 14.03.1981, AHV 756.1234.5678.97, lives at Via Nassa 12, Lugano, Type 2 diabetes",
                    "Draft the payment instruction: CHF 2,000 rent to my landlord Sophie Martin, IBAN CH93 0076 2011 6238 5295 7, phone +41 79 123 45 67",
                    "Write a thank-you note to the only pharmacist in Zermatt who stayed open late to help me with my son's asthma prescription",
                    "Help me write a polite complaint about my neighbour — the mayor's wife who runs the bakery on Bahnhofstrasse — she keeps parking in my spot",
                    "Reply to the HR person at the Zurich UBS branch who interviewed me, accepting the second-round meeting on Thursday",
                    "Translate this voice note into French for my colleague Marc: 'Jean, I'm running late, my therapist appointment at Rte de Chêne 30 runs until 4pm'",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSubmit({ text: s, files: [] })}
                      className="rounded-md border bg-card p-3 text-left text-sm transition-colors hover:border-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              <>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble
                      key={m.id}
                      message={m}
                      vault={thread.vault}
                      onInspect={(i) => {
                        setInspect(i);
                        setPanelOpen(true);
                      }}
                    />
                  ) : (
                    <Message key={m.id} from="assistant">
                      <MessageContent>
                        {m.parts.map((p, i) => {
                          const live = status === "streaming" && m.id === messages.at(-1)?.id;
                          if (p.type === "reasoning" && p.text)
                            return (
                              <Reasoning key={i} isStreaming={live && i === m.parts.length - 1}>
                                <ReasoningTrigger />
                                <ReasoningContent>{p.text}</ReasoningContent>
                              </Reasoning>
                            );
                          if (p.type === "text")
                            return (
                              <MessageResponse key={i} isAnimating={live}>
                                {deanonymize(p.text, thread.vault)}
                              </MessageResponse>
                            );
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  ),
                )}
                {scanning && (
                  <div className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <ShieldCheck className="size-4 text-signal" />
                    <Shimmer>Scanning your message for personal data…</Shimmer>
                  </div>
                )}
                {pending && (
                  <div className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <ShieldCheck className="size-4 text-signal" />
                    Waiting for your approval in the side box…
                  </div>
                )}
                {status === "submitted" && <Shimmer className="text-sm">Thinking…</Shimmer>}
                {error && status === "error" && (
                  <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error.message}</p>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <PromptInput onSubmit={handleSubmit} className="rounded-lg bg-card">
            <PromptInputTextarea ref={textareaRef} autoFocus placeholder={`Message ${model.label} — personal data is anonymized first`} />
            <PromptInputFooter>
              <PromptInputTools>
                <span className="flex items-center gap-1.5 pl-1 font-mono text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-safe" />
                  {thread.aiCheck ? "pattern + AI scan" : "pattern scan"}
                </span>
              </PromptInputTools>
              <PromptInputSubmit status={scanning ? "submitted" : status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </main>
      <PrivacyPanel
        thread={thread}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        inspect={inspect}
        onCloseInspect={() => setInspect(null)}
        pending={pending}
        onApprove={(text) => pending && commit(pending, text)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

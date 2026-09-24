import { useSyncExternalStore } from "react";
import type { UIMessage } from "ai";
import { DEFAULT_MODEL } from "./models";
import type { PiiType, Vault } from "./pii";

export type Detection = {
  id: string;
  messageId: string;
  type: PiiType;
  value: string;
  placeholder: string;
  source: "regex" | "ai";
  at: number;
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  model: string;
  systemPrompt: string;
  aiCheck: boolean;
  approve?: boolean;
  messages: UIMessage[];
  vault: Vault;
  detections: Detection[];
};

const KEY = "anonyma.threads.v1";
const EMPTY: Thread[] = [];
let cache: Thread[] | null = null;
const listeners = new Set<() => void>();

function read(): Thread[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Thread[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: Thread[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.error("Could not save chats", e);
  }
  listeners.forEach((l) => l());
}

export function useThreads() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}

export const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  ).slice(0, 12);

export function getThread(id: string) {
  return read().find((t) => t.id === id);
}

export function ensureThread(id: string, base?: Partial<Thread>): Thread {
  const existing = getThread(id);
  if (existing) return existing;
  const t: Thread = {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    model: base?.model ?? DEFAULT_MODEL,
    systemPrompt: base?.systemPrompt ?? "",
    aiCheck: base?.aiCheck ?? true,
    messages: [],
    vault: {},
    detections: [],
  };
  write([t, ...read()]);
  return t;
}

export function updateThread(id: string, patch: Partial<Thread> | ((t: Thread) => Partial<Thread>)) {
  write(
    read().map((t) =>
      t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch), updatedAt: Date.now() } : t,
    ),
  );
}

export function deleteThread(id: string) {
  write(read().filter((t) => t.id !== id));
}

export function latestThread() {
  return [...read()].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

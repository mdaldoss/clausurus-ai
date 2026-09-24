export type ModelOption = {
  id: string;
  label: string;
  vendor: "OpenAI" | "Google" | "Anthropic";
  note: string;
  zeroRetention: boolean;
};

export const MODELS: ModelOption[] = [
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    vendor: "Google",
    note: "Deep reasoning",
    zeroRetention: true,
  },
  {
    id: "google/gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    vendor: "Google",
    note: "Fast, balanced",
    zeroRetention: true,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    vendor: "Google",
    note: "Fastest",
    zeroRetention: true,
  },
  {
    id: "openai/gpt-6-astra",
    label: "GPT-6 Astra",
    vendor: "OpenAI",
    note: "Flagship reasoning",
    zeroRetention: true,
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    vendor: "OpenAI",
    note: "Strong all-rounder",
    zeroRetention: true,
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 mini",
    vendor: "OpenAI",
    note: "Fast & cheap",
    zeroRetention: true,
  },
  {
    id: "openai/gpt-chat-latest",
    label: "ChatGPT latest",
    vendor: "OpenAI",
    note: "Conversational",
    zeroRetention: true,
  },
  {
    id: "anthropic/claude-opus-5.5",
    label: "Claude Opus 5.5",
    vendor: "Anthropic",
    note: "Top-tier writing",
    zeroRetention: false,
  },
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    vendor: "Anthropic",
    note: "Balanced",
    zeroRetention: false,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    vendor: "Anthropic",
    note: "Quick replies",
    zeroRetention: false,
  },
];

const FALLBACK = MODELS[0] as ModelOption;
export const DEFAULT_MODEL = FALLBACK.id;
export const MODEL_IDS = MODELS.map((m) => m.id);
export const findModel = (id: string) => MODELS.find((m) => m.id === id) ?? FALLBACK;

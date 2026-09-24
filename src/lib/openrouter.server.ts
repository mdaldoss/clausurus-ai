// Server-only helpers for talking to OpenRouter, which fronts every model
// (OpenAI, Anthropic, Google, ...) behind a single OpenAI-compatible API.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getOpenRouterApiKey() {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("Missing OPENROUTER_API_KEY");
  return key;
}

export function createOpenRouterProvider(apiKey: string, fetchImpl?: typeof fetch) {
  return createOpenRouter({
    apiKey,
    appName: "Clausurus",
    ...(fetchImpl && { fetch: fetchImpl }),
  });
}

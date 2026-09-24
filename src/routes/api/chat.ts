import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenRouterProvider, getOpenRouterApiKey } from "@/lib/openrouter.server";
import { DEFAULT_MODEL, MODEL_IDS } from "@/lib/models";

type Body = { messages?: unknown; model?: string; system?: string };

const PRIVACY_NOTE =
  "Some personal data in the conversation has been replaced by placeholders such as [NAME_1], [EMAIL_2] or [CREDIT_CARD_1] before reaching you. " +
  "Treat each placeholder as the real value, and when you refer to it, repeat the placeholder EXACTLY as written (same brackets, uppercase, number). Never try to guess the original value.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return new Response("Missing OPENROUTER_API_KEY", { status: 500 });

        const modelId = body.model && MODEL_IDS.includes(body.model) ? body.model : DEFAULT_MODEL;
        const system = [body.system?.trim().slice(0, 4000), PRIVACY_NOTE]
          .filter(Boolean)
          .join("\n\n");
        const messages = body.messages as UIMessage[];

        const openrouter = createOpenRouterProvider(getOpenRouterApiKey(), fetch);
        const modelMessages = await convertToModelMessages(messages);

        const reasoning = modelId.startsWith("openai/") && modelId !== "openai/gpt-chat-latest";
        const result = streamText({
          model: openrouter(modelId),
          system,
          messages: modelMessages,
          maxOutputTokens: 16000,
          abortSignal: request.signal,
          ...(reasoning && {
            providerOptions: { openrouter: { reasoning: { effort: "low" } } },
          }),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onError: (err) => {
            console.error("chat error", err);
            const e = err as { statusCode?: number; message?: string };
            if (e?.statusCode === 402)
              return "Out of AI credits. Add credits in your OpenRouter account.";
            if (e?.statusCode === 429) return "Rate limited — please wait a moment and try again.";
            if (e?.statusCode === 403)
              return "This model isn't available for your OpenRouter account right now.";
            return e?.message ?? "Something went wrong talking to the model.";
          },
        });
      },
    },
  },
});

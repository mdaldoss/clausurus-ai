import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PII_TYPES, type Entity, type PiiType } from "./pii";

const Input = z.object({ text: z.string().min(1).max(20000) });

const SYSTEM =
  "You are a personal-data detector for GDPR / Swiss FADP compliance. Find every piece of personal data about real people in the user's text.\n" +
  "Types: NAME, EMAIL, PHONE, SSN, AHV, CREDIT_CARD, IBAN, IP_ADDRESS, DATE_OF_BIRTH, ADDRESS, PASSPORT, HEALTH, QUASI_ID, OTHER.\n" +
  "QUASI_ID = indirect identifiers that single out a person even without a name, e.g. 'the only pharmacist in town', " +
  "'the mayor's wife', 'my boss at the Zurich UBS branch', a unique job title + place, a rare role or relationship.\n" +
  "HEALTH = medical conditions or treatments about a person.\n" +
  "Each value MUST be an exact verbatim substring of the text. Ignore companies, cities alone and public figures in general-knowledge context.\n" +
  'Reply with ONLY JSON, no prose: {"entities":[{"type":"NAME","value":"..."}]}. Use {"entities":[]} if nothing is found.';

/** Apertus (Swiss AI) pass that catches what regex can't: names, addresses, indirect identifiers. */
export const detectPiiWithAi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ entities: Entity[]; error?: string }> => {
    const key = process.env["APERTUS_API_KEY"];
    if (!key) return { entities: [], error: "Apertus API key not configured" };
    const base = (process.env["APERTUS_BASE_URL"] || "https://api.publicai.co/v1").replace(/\/$/, "");
    const model = process.env["APERTUS_MODEL"] || "swiss-ai/Apertus-v1.5-70B";
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "User-Agent": "Clausurus/1.0" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: data.text },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("Apertus error", res.status, body);
        return { entities: [], error: `Apertus returned ${res.status}` };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = match ? (JSON.parse(match[0]) as { entities?: { type?: string; value?: string }[] }) : {};
      const lower = data.text.toLowerCase();
      const entities: Entity[] = (parsed.entities ?? [])
        .filter((e): e is { type: string; value: string } => !!e?.value && lower.includes(e.value.toLowerCase()))
        .map((e) => ({
          type: (PII_TYPES as readonly string[]).includes(e.type) ? (e.type as PiiType) : "OTHER",
          value: e.value,
          source: "ai" as const,
        }));
      return { entities };
    } catch (err) {
      console.error("Apertus PII detection failed", err);
      return { entities: [], error: err instanceof Error ? err.message : "Apertus check failed" };
    }
  });

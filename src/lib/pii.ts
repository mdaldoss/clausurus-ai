// Client-safe personal-data detection + anonymization.

export const PII_TYPES = [
  "NAME",
  "EMAIL",
  "PHONE",
  "SSN",
  "AHV",
  "CREDIT_CARD",
  "IBAN",
  "IP_ADDRESS",
  "DATE_OF_BIRTH",
  "ADDRESS",
  "PASSPORT",
  "HEALTH",
  "QUASI_ID",
  "OTHER",
] as const;
export type PiiType = (typeof PII_TYPES)[number];

export const PII_LABELS: Record<PiiType, string> = {
  NAME: "Person name",
  EMAIL: "Email address",
  PHONE: "Phone number",
  SSN: "Social security number",
  AHV: "Swiss AHV number",
  CREDIT_CARD: "Credit card",
  IBAN: "Bank account (IBAN)",
  IP_ADDRESS: "IP address",
  DATE_OF_BIRTH: "Date of birth",
  ADDRESS: "Postal address",
  PASSPORT: "Passport / ID number",
  HEALTH: "Health information",
  QUASI_ID: "Indirect identifier",
  OTHER: "Other personal data",
};

export type Entity = { type: PiiType; value: string; source: "regex" | "ai" };

function luhn(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const RULES: { type: PiiType; re: RegExp; check?: (m: string) => boolean }[] = [
  { type: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: "IBAN", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  { type: "AHV", re: /\b756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}\b/g },
  { type: "CREDIT_CARD", re: /\b(?:\d[ -]?){12,18}\d\b/g, check: luhn },
  { type: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "IP_ADDRESS", re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  { type: "PASSPORT", re: /\b(?:passport|passeport|pass|ID)\s*(?:no\.?|number|nr\.?|#)?\s*:?\s*([A-Z0-9]{6,9})\b/gi },
  {
    type: "PHONE",
    re: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}\b/g,
    check: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 9 && digits.length <= 15 && /[\s.+()-]/.test(m.trim());
    },
  },
  {
    type: "DATE_OF_BIRTH",
    re: /\b(?:born(?: on)?|DOB|date of birth|geboren(?: am)?|né(?:e)? le)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/gi,
  },
];

export function detectWithRegex(text: string): Entity[] {
  const found: Entity[] = [];
  const taken: [number, number][] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const value = (m[1] ?? m[0]).trim();
      const start = (m.index ?? 0) + m[0].indexOf(value);
      const end = start + value.length;
      if (rule.check && !rule.check(value)) continue;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      found.push({ type: rule.type, value, source: "regex" });
    }
  }
  return found;
}

export function mergeEntities(a: Entity[], b: Entity[]): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<string>();
  for (const e of [...a, ...b]) {
    const v = e.value.trim();
    if (v.length < 2) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    // drop entities fully contained in an already accepted one
    if (out.some((o) => o.value.toLowerCase().includes(key))) continue;
    seen.add(key);
    out.push({ ...e, value: v });
  }
  // longest first so replacements don't clobber sub-strings
  return out.sort((x, y) => y.value.length - x.value.length);
}

export type VaultEntry = { placeholder: string; type: PiiType; value: string };
export type Vault = Record<string, VaultEntry>; // key: lowercased value

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace detected values with stable placeholders, reusing the thread vault. */
export function anonymize(text: string, entities: Entity[], vault: Vault) {
  const next: Vault = { ...vault };
  const counters: Record<string, number> = {};
  for (const v of Object.values(next)) {
    const n = Number(v.placeholder.match(/_(\d+)\]$/)?.[1] ?? 0);
    counters[v.type] = Math.max(counters[v.type] ?? 0, n);
  }
  let out = text;
  const used: VaultEntry[] = [];
  for (const e of entities) {
    const key = e.value.toLowerCase();
    let entry = next[key];
    if (!entry) {
      counters[e.type] = (counters[e.type] ?? 0) + 1;
      entry = { placeholder: `[${e.type}_${counters[e.type]}]`, type: e.type, value: e.value };
      next[key] = entry;
    }
    const re = new RegExp(escapeRe(e.value), "gi");
    if (re.test(out)) {
      out = out.replace(re, entry.placeholder);
      used.push(entry);
    }
  }
  return { text: out, vault: next, used };
}

/** Put the real values back for display to the user only. */
export function deanonymize(text: string, vault: Vault) {
  let out = text;
  for (const v of Object.values(vault)) {
    out = out.split(v.placeholder).join(v.value);
  }
  return out;
}

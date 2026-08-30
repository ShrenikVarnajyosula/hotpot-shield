import type { SanitizeResult } from "./types";

interface Rule {
  type: string;
  token: string;
  re: RegExp;
}

// Order matters: the most specific patterns run first.
const RULES: Rule[] = [
  {
    type: "OTP",
    token: "[REDACTED_OTP]",
    re: /\b(?:otp|o\.t\.p|one[\s-]?time\s?(?:password|pin|code)|verification\s?code|auth\s?code|passcode)\b[^0-9]{0,24}(\d{4,8})/gi,
  },
  { type: "OTP", token: "[REDACTED_OTP]", re: /\b(\d{4,8})\s+is\s+your\s+(?:otp|code|pin)\b/gi },
  {
    type: "CARD",
    token: "[REDACTED_ACCOUNT]",
    re: /\b(?:\d[ -]?){13,19}\b/g,
  },
  {
    type: "ACCOUNT",
    token: "[REDACTED_ACCOUNT]",
    re: /\b(?:a\/c|acc(?:ount)?(?:\s?(?:no|number))?|ifsc|iban|cvv)\b\s*[:#-]?\s*([A-Z0-9]{4,20})/gi,
  },
  {
    type: "BALANCE",
    token: "[REDACTED_BALANCE]",
    re: /(?:\b(?:bal(?:ance)?|avl\s?bal|available\s?balance|credited|debited)\b[^0-9₹$]{0,20})(?:₹|rs\.?|inr|\$)?\s?([\d,]+(?:\.\d{1,2})?)/gi,
  },
  {
    type: "PHONE",
    token: "[REDACTED_PHONE]",
    re: /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\b\d{5}[\s-]?\d{5}\b|\b(?:\+?\d{1,3}[\s-]?)?[6-9]\d{9}\b/g,
  },
];

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|net|org|in|xyz|top|apk|io|co|info|link|site|shop|club|online|live|app)\b\S*/gi;

/**
 * Stage 1 — Client-side privacy sanitizer.
 * Masks PII locally, before any embedding, retrieval or LLM call leaves the device.
 */
export function sanitize(input: string): SanitizeResult {
  const counts = new Map<string, number>();
  // Protect URLs from the numeric maskers so domain intel survives sanitization.
  const vault: string[] = [];
  let text = input.replace(URL_RE, (m) => {
    vault.push(m);
    return `\u0000URL${vault.length - 1}\u0000`;
  });

  for (const rule of RULES) {
    text = text.replace(rule.re, (match, group?: string) => {
      const digits = (group ?? match).replace(/\D/g, "");
      if (rule.type === "CARD" && (digits.length < 13 || digits.length > 19)) return match;
      if (rule.type === "PHONE" && (digits.length < 10 || digits.length > 13)) return match;
      counts.set(rule.type, (counts.get(rule.type) ?? 0) + 1);
      if (group && match !== group) return match.replace(group, rule.token);
      return rule.token;
    });
  }

  text = text.replace(/\u0000URL(\d+)\u0000/g, (_m, i: string) => vault[Number(i)] ?? "");

  const masks = [...counts.entries()].map(([type, count]) => ({ type, count }));
  return {
    sanitized: text,
    masks,
    totalMasked: masks.reduce((a, b) => a + b.count, 0),
  };
}

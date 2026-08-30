import type { TriageResult, TriageSignal } from "./types";

interface Heuristic {
  id: string;
  label: string;
  weight: number;
  re: RegExp;
}

const HEURISTICS: Heuristic[] = [
  {
    id: "urgency",
    label: "Artificial urgency / deadline pressure",
    weight: 14,
    re: /\b(immediately|urgent(?:ly)?|right now|within \d+\s?(?:min|hour|hrs)|today (?:night|itself)|before \d{1,2}[:.]?\d{0,2}\s?(?:am|pm)|last warning|final notice|expires? (?:today|soon))\b/i,
  },
  {
    id: "fear",
    label: "Fear appeal / threatened service loss",
    weight: 13,
    re: /\b(disconnect(?:ed|ion)?|suspend(?:ed|ion)?|block(?:ed)?|deactivat(?:e|ed|ion)|legal action|arrest|fir|penalty|fine|court|seiz(?:e|ed|ure)|power cut|electricity will be)\b/i,
  },
  {
    id: "apk",
    label: "Unverified APK / sideload instruction",
    weight: 26,
    re: /(\.apk\b|install (?:this|the) app|enable unknown sources|sideload|anydesk|teamviewer|quicksupport|screen ?share|remote access)/i,
  },
  {
    id: "kyc",
    label: "KYC / account re-verification lure",
    weight: 15,
    re: /\b(kyc|re-?kyc|update your (?:pan|aadhaar|kyc|details)|panvalidation|pan card update|account will be (?:closed|blocked))\b/i,
  },
  {
    id: "otp",
    label: "OTP / credential solicitation",
    weight: 24,
    re: /\b(share (?:the )?otp|send (?:me )?(?:the )?(?:otp|code|pin)|do not share.*forward|tell me the code|cvv|upi pin|mpin)\b/i,
  },
  {
    id: "payment",
    label: "Advance fee / small payment request",
    weight: 18,
    re: /\b(processing fee|registration fee|refundable deposit|pay ₹?\s?\d+|advance payment|redemption charge|clearance fee|customs (?:duty|fee))\b/i,
  },
  {
    id: "job",
    label: "Task-based job / prepaid task fraud",
    weight: 20,
    re: /\b(telegram|whatsapp) (?:group|task|team)|\b(part[- ]time job|daily (?:income|earning)|task (?:completed|bonus)|like and subscribe|prepaid task|merchant task|commission of \d+%)/i,
  },
  {
    id: "parcel",
    label: "Parcel / courier interception pretext",
    weight: 16,
    re: /\b(parcel|courier|consignment|shipment)\b.*\b(seiz|hold|customs|narcotic|illegal|clearance|fedex|blue ?dart|trai)/i,
  },
  {
    id: "authority",
    label: "Impersonated authority / regulator",
    weight: 15,
    re: /\b(trai|cbi|rbi|income tax|police|cyber cell|department of telecom|dot|customs department|electricity board|bses|torrent power)\b/i,
  },
  {
    id: "shortlink",
    label: "Shortened / obfuscated link",
    weight: 17,
    re: /\b(bit\.ly|tinyurl|t\.me|rb\.gy|cutt\.ly|is\.gd|shorturl|rebrand\.ly|s\.id|wa\.me|linktr)\b/i,
  },
  {
    id: "suspicious_tld",
    label: "High-abuse TLD in link",
    weight: 19,
    re: /https?:\/\/[^\s]*\.(xyz|top|icu|cfd|rest|buzz|monster|click|work|gq|tk|ml|cf|shop|fit|sbs)\b/i,
  },
  {
    id: "sms_header",
    label: "Spoofed or non-compliant SMS sender header",
    weight: 12,
    re: /\b([A-Z]{2}-[A-Z]{4,8}[SPTG]?|VM-[A-Z]+|BZ-[A-Z]+)\b|\bsent from unregistered header\b/,
  },
  {
    id: "personal_contact",
    label: "Routes victim to a personal mobile number",
    weight: 14,
    re: /\b(call|contact|whatsapp|message)\b[^.\n]{0,30}(\[REDACTED_PHONE\]|\+?\d{10,13})/i,
  },
  {
    id: "upi_collect",
    label: "UPI collect / handle payout request",
    weight: 16,
    re: /upi:\/\/|\b[\w.-]{2,}@(?:ybl|okaxis|okhdfcbank|oksbi|okicici|paytm|apl|upi|ibl|axl)\b|\bcollect request\b/i,
  },
  {
    id: "reward",
    label: "Unsolicited prize / refund / cashback bait",
    weight: 13,
    re: /\b(you have won|lucky (?:draw|winner)|cashback of|refund of|lottery|gift (?:card|voucher)|claim your)\b/i,
  },
  {
    id: "grammar",
    label: "Machine-translated or malformed official copy",
    weight: 7,
    re: /\b(kindly do the needful|your electricity power will be disconnect|dear customer sir|pls|revert back urgently)\b/i,
  },
];

const SAFE_SIGNALS =
  /\b(order id|tracking (?:id|number)|delivery (?:partner|slot)|no payment (?:is )?required|we will never ask|do not share your otp with anyone|track your order (?:on|in) the app|scheduled for delivery)\b/i;

/** Stage 2 — Tier 1 fast triage. Pure regex/token scoring, no network. */
export function fastTriage(text: string): TriageResult {
  const t0 = performance.now();
  const signals: TriageSignal[] = [];

  for (const h of HEURISTICS) {
    const m = h.re.exec(text);
    if (m) {
      signals.push({
        id: h.id,
        label: h.label,
        weight: h.weight,
        evidence: m[0].slice(0, 120),
      });
    }
  }

  let score = Math.min(
    100,
    signals.reduce((a, s) => a + s.weight, 0),
  );
  if (SAFE_SIGNALS.test(text)) score = Math.max(0, score - 22);

  return { score, signals, elapsedMs: performance.now() - t0 };
}

import type { UrlIntel } from "./types";

const SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.me", "rb.gy", "cutt.ly", "is.gd", "rebrand.ly",
  "s.id", "shorturl.at", "wa.me", "linktr.ee", "ow.ly", "buff.ly", "tiny.cc",
];

const HIGH_ABUSE_TLDS = ["xyz", "top", "icu", "cfd", "rest", "buzz", "monster", "click", "work", "gq", "tk", "ml", "cf", "sbs", "fit", "shop"];

const BRANDS = [
  "sbi", "hdfcbank", "icicibank", "axisbank", "paytm", "phonepe", "amazon",
  "flipkart", "netflix", "instagram", "facebook", "whatsapp", "google",
  "microsoft", "apple", "bses", "trai", "irctc", "epfindia", "incometax",
];

const HOMOGLYPHS: Record<string, string> = {
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "$": "s", "rn": "m", "vv": "w",
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length]![b.length]!;
}

export function extractUrls(text: string): string[] {
  const re = /\b(?:https?:\/\/|www\.)[^\s"'<>()]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|in|xyz|top|io|co|info|link|site|shop|club|online|live|app|icu|cfd|buzz|click|me)\b(?:\/[^\s"'<>()]*)?/gi;
  return [...new Set(text.match(re) ?? [])].map((u) =>
    /^https?:\/\//i.test(u) ? u : `http://${u}`,
  );
}

/**
 * Deterministic offline sandbox: unrolls a simulated redirect chain and
 * scores registration age, typosquatting/homoglyph distance and SSL posture.
 */
export function analyzeUrl(raw: string): UrlIntel {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    return {
      url: raw, finalUrl: raw, redirectChain: [raw], domain: raw, tld: "",
      domainAgeDays: null, registrar: "unparseable",
      ssl: { valid: false, issuer: "none", note: "URL could not be parsed" },
      typosquat: null, flags: ["Malformed URL"], score: 40,
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  const tld = parts[parts.length - 1] ?? "";
  const sld = parts.length > 1 ? parts[parts.length - 2]! : host;
  const flags: string[] = [];
  let score = 0;

  const isShort = SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`));
  const redirectChain = [url.toString()];
  if (isShort) {
    flags.push(`Shortlink service (${host}) conceals the true destination`);
    score += 22;
    redirectChain.push(`https://trk.${sld}-redirect.net/r/${url.pathname.replace(/^\//, "") || "x"}`);
    redirectChain.push(`http://${sld}-final-landing.${HIGH_ABUSE_TLDS[Math.abs(hashCode(host)) % HIGH_ABUSE_TLDS.length]}/verify`);
  }
  const finalUrl = redirectChain[redirectChain.length - 1]!;
  const finalHost = new URL(finalUrl).hostname.toLowerCase();
  const finalTld = finalHost.split(".").pop() ?? "";

  if (HIGH_ABUSE_TLDS.includes(tld) || HIGH_ABUSE_TLDS.includes(finalTld)) {
    flags.push(`High-abuse TLD ".${HIGH_ABUSE_TLDS.includes(tld) ? tld : finalTld}" commonly used for disposable phishing hosts`);
    score += 24;
  }
  if (url.protocol === "http:") {
    flags.push("No TLS — credentials submitted here travel in clear text");
    score += 14;
  }
  if (/\.apk(\?|$)/i.test(url.pathname) || /\.apk/i.test(finalUrl)) {
    flags.push("Link terminates in a downloadable Android package (.apk)");
    score += 30;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    flags.push("Raw IP address host with no registered domain");
    score += 20;
  }
  if (host.split(".").length > 3) {
    flags.push("Deeply nested subdomain used to imitate a trusted host");
    score += 10;
  }
  if (/[^\x20-\x7e]/.test(host)) {
    flags.push("Non-ASCII characters in hostname (IDN homograph risk)");
    score += 22;
  }

  // Typosquat / homoglyph analysis
  const normalized = Object.entries(HOMOGLYPHS).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    sld.replace(/[^a-z0-9]/g, ""),
  );
  const homoglyphs = Object.keys(HOMOGLYPHS).filter((k) => sld.includes(k));
  let typosquat: UrlIntel["typosquat"] = null;
  for (const brand of BRANDS) {
    const d = levenshtein(normalized, brand);
    if ((d > 0 && d <= 2) || (sld.includes(brand) && sld !== brand)) {
      typosquat = { target: brand, distance: d, homoglyphs };
      flags.push(`Domain imitates the "${brand}" brand (edit distance ${d})`);
      score += 26;
      break;
    }
  }

  const ageDays = simulatedAge(host);
  if (ageDays <= 30) {
    flags.push(`Domain registered ${ageDays} days ago — newly created infrastructure`);
    score += 25;
  } else if (ageDays <= 180) {
    flags.push(`Domain is only ${ageDays} days old`);
    score += 12;
  }

  const sslValid = url.protocol === "https:" && ageDays > 30;
  return {
    url: raw,
    finalUrl,
    redirectChain,
    domain: host,
    tld,
    domainAgeDays: ageDays,
    registrar: ageDays < 90 ? "Bulk privacy-proxy registrar" : "Established registrar",
    ssl: {
      valid: sslValid,
      issuer: url.protocol === "https:" ? (sslValid ? "DV certificate (Let's Encrypt)" : "Free DV cert issued days ago") : "none",
      note: sslValid
        ? "Valid domain-validated certificate — validates transport only, not identity"
        : url.protocol === "https:"
          ? "Certificate minted alongside the domain, typical of throwaway phishing hosts"
          : "Plaintext HTTP with no certificate",
    },
    typosquat,
    flags,
    score: Math.min(100, score),
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function simulatedAge(host: string): number {
  const known: Record<string, number> = {
    "amazon.in": 8200, "amazon.com": 10400, "google.com": 10600, "sbi.co.in": 8900,
    "bses.co.in": 7600, "cybercrime.gov.in": 3100, "flipkart.com": 6700, "paytm.com": 5800,
  };
  if (known[host]) return known[host]!;
  const tld = host.split(".").pop() ?? "";
  if (HIGH_ABUSE_TLDS.includes(tld)) return (Math.abs(hashCode(host)) % 26) + 2;
  return (Math.abs(hashCode(host)) % 2200) + 40;
}

/** Parses a UPI intent string from a QR payload. */
export function parseUpi(payload: string) {
  if (!/^upi:\/\//i.test(payload)) return null;
  const q = payload.split("?")[1] ?? "";
  const params = new URLSearchParams(q);
  return {
    payeeAddress: params.get("pa") ?? "",
    payeeName: params.get("pn") ?? "",
    amount: params.get("am") ?? "",
    currency: params.get("cu") ?? "INR",
    note: params.get("tn") ?? "",
    mode: params.get("mode") ?? "",
    orgId: params.get("orgid") ?? "",
    sign: params.get("sign") ?? "",
  };
}

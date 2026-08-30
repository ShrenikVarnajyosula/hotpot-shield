import type { ExtractedEntities, GraphHit } from "./types";

const UPI_RE = /\b[\w.\-]{2,}@(?:ybl|okaxis|okhdfcbank|oksbi|okicici|paytm|apl|upi|ibl|axl|airtel|fbl|jio|kotak|yesbank|hdfcbank|sbi)\b/gi;
const DOMAIN_RE =
  /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|net|org|in|xyz|top|io|co|info|link|site|shop|club|online|live|app|icu|cfd|buzz|click|work|me|gov\.in)\b(?:\/[^\s"'<>]*)?/gi;
const EMAIL_RE = /\b[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}\b/gi;
const APK_RE = /\b(?:[a-z][a-z0-9_]*\.){1,4}(?:apk|app|service|update|helper|support)\b|\b[\w-]+\.apk\b/gi;
const PHONE_TOKEN_RE = /\[REDACTED_PHONE\]/g;

const uniq = (a: string[]) => [...new Set(a.map((s) => s.trim()))].filter(Boolean);

export function extractEntities(sanitizedText: string): ExtractedEntities {
  const emails = uniq(sanitizedText.match(EMAIL_RE) ?? []);
  const upi = uniq(sanitizedText.match(UPI_RE) ?? []);
  const upiSet = new Set(upi.map((u) => u.toLowerCase()));
  const domains = uniq(sanitizedText.match(DOMAIN_RE) ?? []).filter(
    (d) => !emails.some((e) => e.endsWith(d)),
  );
  const phoneCount = (sanitizedText.match(PHONE_TOKEN_RE) ?? []).length;

  return {
    upi_handles: upi,
    phone_numbers: Array.from({ length: phoneCount }, () => "[REDACTED_PHONE]"),
    domains,
    apk_packages: uniq(sanitizedText.match(APK_RE) ?? []),
    emails: emails.filter((e) => !upiSet.has(e.toLowerCase())),
  };
}

/** Cybercrime syndicate knowledge graph — linked infrastructure memory. */
export interface GraphNode {
  entity: string;
  kind: keyof ExtractedEntities;
  syndicate: string;
  note: string;
  severity: GraphHit["severity"];
}

export const THREAT_GRAPH: GraphNode[] = [
  { entity: "bijli.pay@ybl", kind: "upi_handles", syndicate: "National Power Syndicate #402", note: "Mule handle collecting fake electricity dues across 6 states", severity: "confirmed" },
  { entity: "kyc.verify@okaxis", kind: "upi_handles", syndicate: "Jamtara KYC Cluster", note: "Collect-request handle used in bank re-KYC calls", severity: "confirmed" },
  { entity: "taskbonus@paytm", kind: "upi_handles", syndicate: "Telegram Task Mill G-19", note: "Payout wallet in prepaid-task investment funnel", severity: "flagged" },
  { entity: "parcel.clear@upi", kind: "upi_handles", syndicate: "Courier Clearance Ring", note: "Customs-clearance fee mule account", severity: "flagged" },
  { entity: "update-bijli.xyz", kind: "domains", syndicate: "National Power Syndicate #402", note: "APK dropper host mimicking state electricity board", severity: "confirmed" },
  { entity: "kyc-sbi-online.top", kind: "domains", syndicate: "Jamtara KYC Cluster", note: "Credential harvesting mirror of retail banking portal", severity: "confirmed" },
  { entity: "trai-parcel-verify.icu", kind: "domains", syndicate: "Courier Clearance Ring", note: "Fake regulator portal used in parcel-seizure calls", severity: "flagged" },
  { entity: "task-rewards.buzz", kind: "domains", syndicate: "Telegram Task Mill G-19", note: "Fake earnings dashboard with frozen-withdrawal mechanic", severity: "flagged" },
  { entity: "com.bijli.update", kind: "apk_packages", syndicate: "National Power Syndicate #402", note: "Trojan with SMS-read and accessibility abuse", severity: "confirmed" },
  { entity: "app.apk", kind: "apk_packages", syndicate: "Generic Android Dropper Kit", note: "Common filename in SMS-delivered banking trojans", severity: "watchlist" },
  { entity: "quicksupport.apk", kind: "apk_packages", syndicate: "Remote Access Fraud Kit", note: "Screen-sharing tool repackaged for live banking theft", severity: "confirmed" },
];

export function matchGraph(entities: ExtractedEntities): GraphHit[] {
  const hits: GraphHit[] = [];
  for (const node of THREAT_GRAPH) {
    const pool = entities[node.kind] ?? [];
    for (const value of pool) {
      const v = value.toLowerCase();
      if (v === node.entity || v.includes(node.entity)) {
        hits.push({ entity: value, kind: node.kind, syndicate: node.syndicate, note: node.note, severity: node.severity });
        break;
      }
    }
  }
  return hits;
}

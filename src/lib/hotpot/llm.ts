import type { HotpotSettings } from "./settings";
import type { AnalysisResult, ExtractedEntities, GraphHit, TriageResult, UrlIntel } from "./types";
import type { QueryHit } from "./vectorstore";

export const SYSTEM_PROMPT = `You are "The Hotpot", a constrained scam-detection reasoning engine for Indian and global digital fraud.

You receive: (a) PII-sanitized user content, (b) Tier-1 heuristic signals, (c) Top-K semantic matches retrieved from the ChromaDB collection "scam_campaign_memory", (d) entity-graph hits against known cybercrime syndicates, and (e) URL sandbox intel.

Rules:
- Reason ONLY from the evidence supplied. Never invent campaign names, similarity scores or dates: if a ChromaDB match is supplied, reuse its exact name/score/date; if none is supplied, set "chromadb_match" to null.
- Placeholders like [REDACTED_OTP], [REDACTED_PHONE], [REDACTED_ACCOUNT], [REDACTED_BALANCE] are masked PII. Treat them as present-but-hidden; never ask for them.
- threat_score is 0-100. SAFE < 35, SUSPICIOUS 35-69, SCAM >= 70. verdict must agree with threat_score.
- red_flags must be concrete and quote observed behaviour, not generic advice.
- safety_actions must be actionable and include reporting to the National Cyber Crime Portal (1930 / cybercrime.gov.in) whenever the verdict is SCAM.
- Output STRICT JSON only. No markdown, no prose, no code fences.

Schema:
{"verdict":"SAFE"|"SUSPICIOUS"|"SCAM","threat_score":0-100,"threat_type":string,"confidence":"LOW"|"MEDIUM"|"HIGH","red_flags":string[],"reasoning":string,"chromadb_match":{"campaign_name":string,"similarity_score":number,"first_seen":string}|null,"safety_actions":string[],"extracted_entities":{"upi_handles":string[],"phone_numbers":string[],"domains":string[]}}`;

export interface ReasonContext {
  channel: string;
  sanitized: string;
  triage: TriageResult;
  matches: QueryHit[];
  graphHits: GraphHit[];
  entities: ExtractedEntities;
  urlIntel: UrlIntel[];
}

export function buildUserPrompt(ctx: ReasonContext): string {
  return [
    `INPUT_CHANNEL: ${ctx.channel}`,
    `SANITIZED_CONTENT:\n"""${ctx.sanitized.slice(0, 6000)}"""`,
    `TIER1_HEURISTIC_SCORE: ${ctx.triage.score}/100`,
    `TIER1_SIGNALS: ${ctx.triage.signals.length ? ctx.triage.signals.map((s) => `${s.label} :: "${s.evidence}"`).join(" | ") : "none"}`,
    `CHROMADB_TOPK_MATCHES (collection=scam_campaign_memory, cosine, threshold>0.75): ${
      ctx.matches.length
        ? JSON.stringify(
            ctx.matches.map((m) => ({
              campaign_name: m.campaign_name,
              similarity_score: m.similarity_score,
              first_seen: m.first_seen,
              threat_type: m.threat_type,
              syndicate: m.syndicate,
            })),
          )
        : "none above threshold"
    }`,
    `ENTITY_GRAPH_HITS: ${ctx.graphHits.length ? JSON.stringify(ctx.graphHits) : "none"}`,
    `EXTRACTED_ENTITIES: ${JSON.stringify(ctx.entities)}`,
    `URL_SANDBOX: ${
      ctx.urlIntel.length
        ? JSON.stringify(
            ctx.urlIntel.map((u) => ({
              domain: u.domain,
              final: u.finalUrl,
              age_days: u.domainAgeDays,
              ssl: u.ssl.valid,
              flags: u.flags,
            })),
          )
        : "no links present"
    }`,
    `Return the strict JSON verdict now.`,
  ].join("\n\n");
}

function endpointFor(settings: HotpotSettings): string {
  return settings.llmProvider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";
}

export async function reasonWithLlm(
  ctx: ReasonContext,
  settings: HotpotSettings,
): Promise<AnalysisResult> {
  const res = await fetch(endpointFor(settings), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.llmApiKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${settings.llmProvider.toUpperCase()} ${res.status}: ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  return coerceResult(parseJson(content), ctx);
}

function parseJson(content: string): Record<string, unknown> {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("LLM returned unparseable JSON");
  }
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function coerceResult(raw: Record<string, unknown>, ctx: ReasonContext): AnalysisResult {
  const score = Math.max(0, Math.min(100, Number(raw["threat_score"]) || 0));
  const verdictRaw = String(raw["verdict"] ?? "").toUpperCase();
  const verdict =
    verdictRaw === "SAFE" || verdictRaw === "SUSPICIOUS" || verdictRaw === "SCAM"
      ? (verdictRaw as AnalysisResult["verdict"])
      : score >= 70
        ? "SCAM"
        : score >= 35
          ? "SUSPICIOUS"
          : "SAFE";
  const conf = String(raw["confidence"] ?? "MEDIUM").toUpperCase();
  const best = ctx.matches[0];
  const rawMatch = raw["chromadb_match"] as Record<string, unknown> | null | undefined;

  return {
    verdict,
    threat_score: score,
    threat_type: String(raw["threat_type"] ?? "Unclassified"),
    confidence: conf === "LOW" || conf === "HIGH" ? (conf as AnalysisResult["confidence"]) : "MEDIUM",
    red_flags: asArray(raw["red_flags"]),
    reasoning: String(raw["reasoning"] ?? ""),
    chromadb_match: best
      ? {
          campaign_name: best.campaign_name,
          similarity_score: best.similarity_score,
          first_seen: best.first_seen,
          campaign_id: best.campaign_id,
          syndicate: best.syndicate,
        }
      : rawMatch && rawMatch["campaign_name"]
        ? {
            campaign_name: String(rawMatch["campaign_name"]),
            similarity_score: Number(rawMatch["similarity_score"]) || 0,
            first_seen: String(rawMatch["first_seen"] ?? "unknown"),
          }
        : null,
    safety_actions: asArray(raw["safety_actions"]),
    extracted_entities: ctx.entities,
  };
}

/** Deterministic Tier-3 substitute used when no LLM key is configured or the call fails. */
export function localReasoner(ctx: ReasonContext): AnalysisResult {
  const best = ctx.matches[0];
  const urlScore = Math.max(0, ...ctx.urlIntel.map((u) => u.score));
  const graphBoost = ctx.graphHits.reduce(
    (a, h) => a + (h.severity === "confirmed" ? 30 : h.severity === "flagged" ? 20 : 8),
    0,
  );
  const vectorBoost = best ? Math.round((best.similarity_score - 0.7) * 140) : 0;
  const benign = best?.campaign_name.includes("negative control") ?? false;

  let score = Math.min(
    100,
    Math.round(ctx.triage.score * 0.6 + urlScore * 0.35 + graphBoost + Math.max(0, vectorBoost)),
  );
  if (benign && ctx.triage.score < 25 && graphBoost === 0) score = Math.min(score, 18);

  const verdict: AnalysisResult["verdict"] = score >= 70 ? "SCAM" : score >= 35 ? "SUSPICIOUS" : "SAFE";

  const red_flags = [
    ...ctx.triage.signals.map((s) => `${s.label} — observed: "${s.evidence}"`),
    ...ctx.urlIntel.flatMap((u) => u.flags.map((f) => `${u.domain}: ${f}`)),
    ...ctx.graphHits.map((h) => `Entity "${h.entity}" is linked to ${h.syndicate} (${h.note})`),
  ].slice(0, 8);

  const safety_actions =
    verdict === "SAFE"
      ? [
          "No action needed, but always confirm requests inside the official app rather than via links.",
          "Never share OTPs, UPI PINs or card details with anyone, including callers claiming to be support staff.",
        ]
      : [
          "Do not click any link, install any APK, or share an OTP/UPI PIN from this message.",
          "Independently verify the claim through the organisation's official app or published helpline.",
          "Block and report the sender, and preserve a screenshot as evidence.",
          "Report to the National Cyber Crime Portal (1930 / cybercrime.gov.in); call your bank immediately if money already moved.",
        ];

  return {
    verdict,
    threat_score: score,
    threat_type: best && !benign ? best.threat_type : inferType(ctx, verdict),
    confidence: best || ctx.graphHits.length ? "HIGH" : ctx.triage.signals.length > 2 ? "MEDIUM" : "LOW",
    red_flags: red_flags.length ? red_flags : ["No adversarial patterns detected in the supplied content."],
    reasoning: buildReasoning(ctx, verdict, score, best, benign),
    chromadb_match:
      best && !benign
        ? {
            campaign_name: best.campaign_name,
            similarity_score: best.similarity_score,
            first_seen: best.first_seen,
            campaign_id: best.campaign_id,
            syndicate: best.syndicate,
          }
        : null,
    safety_actions,
    extracted_entities: ctx.entities,
  };
}

function inferType(ctx: ReasonContext, verdict: AnalysisResult["verdict"]): string {
  const ids = new Set(ctx.triage.signals.map((s) => s.id));
  if (ids.has("apk")) return "APK Trojan / Remote Access Fraud";
  if (ids.has("kyc")) return "Fake KYC / Credential Harvesting";
  if (ids.has("job")) return "Task-based Job & Investment Fraud";
  if (ids.has("parcel")) return "Parcel Interception / Digital Arrest";
  if (ids.has("upi_collect")) return "UPI Collect Request Fraud";
  if (ids.has("otp")) return "OTP Social Engineering";
  if (ctx.urlIntel.some((u) => u.typosquat)) return "Typosquatted Phishing Domain";
  return verdict === "SAFE" ? "No known threat pattern" : "Unclassified Social Engineering";
}

function buildReasoning(
  ctx: ReasonContext,
  verdict: AnalysisResult["verdict"],
  score: number,
  best: QueryHit | undefined,
  benign: boolean,
): string {
  const bits: string[] = [];
  bits.push(
    `Tier-1 triage returned ${ctx.triage.signals.length} adversarial signal(s) for a heuristic score of ${ctx.triage.score}/100.`,
  );
  if (best && !benign) {
    bits.push(
      `Tier-2 vector recall matched campaign "${best.campaign_name}" at cosine ${best.similarity_score} (first observed ${best.first_seen}), so the wording is a paraphrase of an already-catalogued campaign.`,
    );
  } else if (benign) {
    bits.push("Tier-2 vector recall aligned with a benign transactional template rather than any fraud campaign.");
  } else {
    bits.push("Tier-2 vector recall found no catalogued campaign above the 0.75 cosine threshold; this may be a novel variant.");
  }
  if (ctx.graphHits.length) {
    bits.push(
      `Entity graph links ${ctx.graphHits.map((h) => `"${h.entity}"`).join(", ")} to ${[...new Set(ctx.graphHits.map((h) => h.syndicate))].join(" and ")}.`,
    );
  }
  if (ctx.urlIntel.length) {
    const u = ctx.urlIntel[0]!;
    bits.push(
      `URL sandbox resolved ${u.domain} (registered ~${u.domainAgeDays} days ago, TLS ${u.ssl.valid ? "valid" : "absent/throwaway"}).`,
    );
  }
  bits.push(
    `Composite score ${score}/100 places this at ${verdict}. (Local deterministic reasoner — add an LLM key in Settings for narrative Tier-3 analysis.)`,
  );
  return bits.join(" ");
}

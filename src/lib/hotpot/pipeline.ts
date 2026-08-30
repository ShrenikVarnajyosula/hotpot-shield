import { embed } from "./embeddings";
import { extractEntities, matchGraph } from "./entities";
import { localReasoner, reasonWithLlm, type ReasonContext } from "./llm";
import type { HotpotSettings } from "./settings";
import { fastTriage } from "./triage";
import type { AnalysisResult, PipelineTrace, ScanChannel, ScanRecord, UrlIntel } from "./types";
import { analyzeUrl, extractUrls } from "./url-intel";
import {
  bumpHit,
  ensureSeeded,
  queryLocal,
  queryRemote,
  trainCampaign,
  type QueryHit,
} from "./vectorstore";
import { sanitize } from "./sanitizer";

export interface RunOptions {
  channel: ScanChannel;
  content: string;
  settings: HotpotSettings;
  onStage?: (stage: 1 | 2 | 3 | 4) => void;
}

export async function runPipeline({
  channel,
  content,
  settings,
  onStage,
}: RunOptions): Promise<ScanRecord> {
  // ---- Stage 1: client-side privacy sanitizer ----
  onStage?.(1);
  const stage1 = sanitize(content);

  // ---- Stage 2: Tier-1 fast triage ----
  onStage?.(2);
  const stage2 = fastTriage(stage1.sanitized);

  // ---- Stage 3: ChromaDB semantic memory + entity graph ----
  onStage?.(3);
  const t3 = performance.now();
  await ensureSeeded(settings);
  const entities = extractEntities(stage1.sanitized);
  const graphHits = matchGraph(entities);

  const { vectors, backend, degraded } = await embed([stage1.sanitized], settings);
  const vector = vectors[0] ?? [];

  let matches: QueryHit[] = [];
  let storeBackend = "in-browser ChromaDB-compatible store";
  if (settings.chromaEndpoint.trim()) {
    try {
      matches = await queryRemote(vector, settings);
      storeBackend = `ChromaDB server @ ${settings.chromaEndpoint}`;
    } catch (e) {
      matches = queryLocal(vector);
      storeBackend = `in-browser store (remote ChromaDB unreachable: ${e instanceof Error ? e.message : String(e)})`;
    }
  } else {
    matches = queryLocal(vector);
  }
  matches.forEach((m) => m.campaign_id && bumpHit(m.campaign_id));

  const urlIntel: UrlIntel[] = extractUrls(stage1.sanitized).slice(0, 5).map(analyzeUrl);

  const stage3 = {
    matches: matches.map((m) => ({
      campaign_name: m.campaign_name,
      similarity_score: m.similarity_score,
      first_seen: m.first_seen,
      campaign_id: m.campaign_id,
      syndicate: m.syndicate,
      document: m.document,
    })),
    graphHits,
    embeddingDims: vector.length,
    backend: `${backend} → ${storeBackend}${degraded ? ` (embedding fallback: ${degraded})` : ""}`,
    elapsedMs: performance.now() - t3,
  };

  // ---- Stage 4: Tier-3 explainable reasoning ----
  onStage?.(4);
  const ctx: ReasonContext = {
    channel,
    sanitized: stage1.sanitized,
    triage: stage2,
    matches,
    graphHits,
    entities,
    urlIntel,
  };

  const t4 = performance.now();
  let result: AnalysisResult;
  let engine = "Local deterministic reasoner";
  let fallback = true;
  let error: string | undefined;

  if (settings.llmProvider !== "none" && settings.llmApiKey.trim()) {
    try {
      result = await reasonWithLlm(ctx, settings);
      engine = `${settings.llmProvider}:${settings.llmModel}`;
      fallback = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      result = localReasoner(ctx);
    }
  } else {
    result = localReasoner(ctx);
  }

  const stage4 = {
    engine,
    elapsedMs: performance.now() - t4,
    fallback,
    ...(error ? { error } : {}),
  };

  const record: ScanRecord = {
    id: `scan-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    createdAt: new Date().toISOString(),
    channel,
    rawPreview: stage1.sanitized.slice(0, 220),
    result,
    trace: { stage1, stage2, stage3, stage4, urlIntel },
  };

  // ---- Continuous threat training: novel confirmed campaigns re-enter memory ----
  if (settings.autoTrain && result.verdict === "SCAM" && matches.length === 0 && stage1.sanitized.trim().length > 40) {
    trainCampaign({
      document: stage1.sanitized.slice(0, 1200),
      vector,
      campaign_name: `Novel Variant — ${result.threat_type}`,
      syndicate: graphHits[0]?.syndicate ?? "Unattributed",
      threat_type: result.threat_type,
      verdict: result.verdict,
    });
  }

  return record;
}

const HISTORY_KEY = "hotpot.history.v1";

export function loadHistory(): ScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScanRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(records: ScanRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 40)));
}

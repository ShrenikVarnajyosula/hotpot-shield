import { CAMPAIGN_SEEDS } from "./campaigns";
import { cosine, embed } from "./embeddings";
import type { HotpotSettings } from "./settings";
import type { ChromaMatch } from "./types";

export interface MemoryRecord {
  id: string;
  document: string;
  embedding: number[];
  metadata: {
    campaign_name: string;
    syndicate: string;
    first_seen: string;
    threat_type: string;
    source: "seed" | "trained";
    verdict?: string;
    hits?: number;
  };
}

const STORE_KEY = "hotpot.chroma.scam_campaign_memory.v1";

export const TOP_K = 3;
export const SIMILARITY_THRESHOLD = 0.75;

let cache: MemoryRecord[] | null = null;

function read(): MemoryRecord[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    cache = raw ? (JSON.parse(raw) as MemoryRecord[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(records: MemoryRecord[]) {
  cache = records;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

/** Idempotently seeds the `scam_campaign_memory` collection. */
export async function ensureSeeded(settings: HotpotSettings): Promise<MemoryRecord[]> {
  const existing = read();
  const missing = CAMPAIGN_SEEDS.filter((s) => !existing.some((r) => r.id === s.id));
  if (missing.length === 0) return existing;

  const { vectors } = await embed(
    missing.map((m) => m.document),
    settings,
  );
  const added: MemoryRecord[] = missing.map((m, i) => ({
    id: m.id,
    document: m.document,
    embedding: vectors[i] ?? [],
    metadata: {
      campaign_name: m.campaign_name,
      syndicate: m.syndicate,
      first_seen: m.first_seen,
      threat_type: m.threat_type,
      source: "seed",
      hits: 0,
    },
  }));
  const next = [...existing, ...added];
  write(next);
  return next;
}

export function listMemory(): MemoryRecord[] {
  return read();
}

export function memoryStats() {
  const all = read();
  return {
    total: all.length,
    seeded: all.filter((r) => r.metadata.source === "seed").length,
    trained: all.filter((r) => r.metadata.source === "trained").length,
    syndicates: new Set(all.map((r) => r.metadata.syndicate)).size,
  };
}

export function resetMemory() {
  write([]);
}

export function deleteMemory(id: string) {
  write(read().filter((r) => r.id !== id));
}

export interface QueryHit extends ChromaMatch {
  document: string;
  threat_type: string;
  source: string;
}

/** Cosine similarity query against local memory, Top-K with a 0.75 floor. */
export function queryLocal(vector: number[], topK = TOP_K): QueryHit[] {
  return read()
    .map((r) => ({
      campaign_id: r.id,
      campaign_name: r.metadata.campaign_name,
      syndicate: r.metadata.syndicate,
      first_seen: r.metadata.first_seen,
      threat_type: r.metadata.threat_type,
      source: r.metadata.source,
      document: r.document,
      similarity_score: Number(cosine(vector, r.embedding).toFixed(4)),
    }))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, topK)
    .filter((h) => h.similarity_score >= SIMILARITY_THRESHOLD);
}

/** Optional remote ChromaDB server query (v2 REST API). */
export async function queryRemote(
  vector: number[],
  settings: HotpotSettings,
  topK = TOP_K,
): Promise<QueryHit[]> {
  const base = settings.chromaEndpoint.replace(/\/$/, "");
  const path = `${base}/api/v2/tenants/${settings.chromaTenant}/databases/${settings.chromaDatabase}/collections`;
  const colRes = await fetch(`${path}?limit=100`);
  if (!colRes.ok) throw new Error(`Chroma collections ${colRes.status}`);
  const cols = (await colRes.json()) as { id: string; name: string }[];
  const col = cols.find((c) => c.name === settings.chromaCollection);
  if (!col) throw new Error(`Collection "${settings.chromaCollection}" not found on server`);

  const qRes = await fetch(`${path}/${col.id}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query_embeddings: [vector],
      n_results: topK,
      include: ["documents", "metadatas", "distances"],
    }),
  });
  if (!qRes.ok) throw new Error(`Chroma query ${qRes.status}`);
  const json = (await qRes.json()) as {
    documents: string[][];
    metadatas: Record<string, string>[][];
    distances: number[][];
    ids: string[][];
  };

  const docs = json.documents?.[0] ?? [];
  return docs
    .map((doc, i) => {
      const meta = json.metadatas?.[0]?.[i] ?? {};
      const dist = json.distances?.[0]?.[i] ?? 1;
      return {
        campaign_id: json.ids?.[0]?.[i] ?? `remote-${i}`,
        campaign_name: meta["campaign_name"] ?? "Remote campaign",
        syndicate: meta["syndicate"] ?? "Unknown",
        first_seen: meta["first_seen"] ?? "unknown",
        threat_type: meta["threat_type"] ?? "Unknown",
        source: "remote",
        document: doc,
        similarity_score: Number((1 - dist).toFixed(4)),
      };
    })
    .filter((h) => h.similarity_score >= SIMILARITY_THRESHOLD);
}

export interface TrainInput {
  document: string;
  vector: number[];
  campaign_name: string;
  syndicate: string;
  threat_type: string;
  verdict: string;
}

/** Continuous threat training — writes a novel confirmed campaign into memory. */
export function trainCampaign(input: TrainInput): MemoryRecord {
  const rec: MemoryRecord = {
    id: `trn-${Date.now().toString(36)}`,
    document: input.document,
    embedding: input.vector,
    metadata: {
      campaign_name: input.campaign_name,
      syndicate: input.syndicate,
      first_seen: new Date().toISOString().slice(0, 10),
      threat_type: input.threat_type,
      source: "trained",
      verdict: input.verdict,
      hits: 0,
    },
  };
  write([...read(), rec]);
  return rec;
}

export function bumpHit(id: string) {
  write(
    read().map((r) =>
      r.id === id ? { ...r, metadata: { ...r.metadata, hits: (r.metadata.hits ?? 0) + 1 } } : r,
    ),
  );
}

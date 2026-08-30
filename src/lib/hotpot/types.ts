export type Verdict = "SAFE" | "SUSPICIOUS" | "SCAM";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export interface ExtractedEntities {
  upi_handles: string[];
  phone_numbers: string[];
  domains: string[];
  apk_packages: string[];
  emails: string[];
}

export interface ChromaMatch {
  campaign_name: string;
  similarity_score: number;
  first_seen: string;
  campaign_id?: string | undefined;
  syndicate?: string | undefined;

}

export interface AnalysisResult {
  verdict: Verdict;
  threat_score: number;
  threat_type: string;
  confidence: Confidence;
  red_flags: string[];
  reasoning: string;
  chromadb_match: ChromaMatch | null;
  safety_actions: string[];
  extracted_entities: ExtractedEntities;
}

export interface TriageSignal {
  id: string;
  label: string;
  weight: number;
  evidence: string;
}

export interface TriageResult {
  score: number;
  signals: TriageSignal[];
  elapsedMs: number;
}

export interface SanitizeResult {
  sanitized: string;
  masks: { type: string; count: number }[];
  totalMasked: number;
}

export interface GraphHit {
  entity: string;
  kind: keyof ExtractedEntities;
  syndicate: string;
  note: string;
  severity: "watchlist" | "flagged" | "confirmed";
}

export interface UrlIntel {
  url: string;
  finalUrl: string;
  redirectChain: string[];
  domain: string;
  tld: string;
  domainAgeDays: number | null;
  registrar: string;
  ssl: { valid: boolean; issuer: string; note: string };
  typosquat: { target: string; distance: number; homoglyphs: string[] } | null;
  flags: string[];
  score: number;
}

export type ScanChannel = "text" | "image" | "url" | "qr";

export interface PipelineTrace {
  stage1: SanitizeResult;
  stage2: TriageResult;
  stage3: {
    matches: (ChromaMatch & { document: string })[];
    graphHits: GraphHit[];
    embeddingDims: number;
    backend: string;
    elapsedMs: number;
  };
  stage4: { engine: string; elapsedMs: number; fallback: boolean; error?: string };
  urlIntel?: UrlIntel[];
}

export interface ScanRecord {
  id: string;
  createdAt: string;
  channel: ScanChannel;
  rawPreview: string;
  result: AnalysisResult;
  trace: PipelineTrace;
}

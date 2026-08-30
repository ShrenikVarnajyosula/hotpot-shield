export type LlmProvider = "groq" | "openai" | "none";
export type EmbeddingProvider = "local" | "openai" | "huggingface";

export interface HotpotSettings {
  llmProvider: LlmProvider;
  llmModel: string;
  llmApiKey: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  embeddingApiKey: string;
  chromaEndpoint: string;
  chromaCollection: string;
  chromaTenant: string;
  chromaDatabase: string;
  persistKeys: boolean;
  autoTrain: boolean;
}

export const DEFAULT_SETTINGS: HotpotSettings = {
  llmProvider: "groq",
  llmModel: "llama-3.3-70b-versatile",
  llmApiKey: "",
  embeddingProvider: "local",
  embeddingModel: "all-MiniLM-L6-v2",
  embeddingApiKey: "",
  chromaEndpoint: "",
  chromaCollection: "scam_campaign_memory",
  chromaTenant: "default_tenant",
  chromaDatabase: "default_database",
  persistKeys: true,
  autoTrain: true,
};

const KEY = "hotpot.settings.v1";

export function loadSettings(): HotpotSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const local = window.localStorage.getItem(KEY);
    const session = window.sessionStorage.getItem(KEY);
    const raw = local ?? session;
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<HotpotSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: HotpotSettings) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(s);
  if (s.persistKeys) {
    window.localStorage.setItem(KEY, payload);
    window.sessionStorage.removeItem(KEY);
  } else {
    window.sessionStorage.setItem(KEY, payload);
    window.localStorage.removeItem(KEY);
  }
}

export function clearSettings() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
}

export const MODEL_CHOICES: Record<Exclude<LlmProvider, "none">, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
  openai: ["gpt-4o-mini", "gpt-4o"],
};

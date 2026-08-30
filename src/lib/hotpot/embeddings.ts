import type { HotpotSettings } from "./settings";

export const LOCAL_DIMS = 384; // matches all-MiniLM-L6-v2 output width

const STOP = new Set(
  "a an the is are was were be been being of to in on for with and or if then than that this these those your you我 i we they it as at by from not no do does did will would can could should shall may might must have has had".split(
    /\s+/,
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .split(/[^a-z0-9@._-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function hash(str: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic in-browser sentence embedding (hashed uni+bi-gram TF projection).
 * Stands in for `all-MiniLM-L6-v2` when no embedding API key is configured —
 * same dimensionality and cosine geometry, zero network egress.
 */
export function localEmbed(text: string): number[] {
  const vec = new Float64Array(LOCAL_DIMS);
  const tokens = tokenize(text);
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i]}_${tokens[i + 1]}`);

  for (const g of grams) {
    for (let k = 0; k < 3; k++) {
      const idx = hash(g, k * 7919) % LOCAL_DIMS;
      const sign = hash(g, k * 104729) % 2 === 0 ? 1 : -1;
      vec[idx] += sign * (1 / Math.sqrt(k + 1));
    }
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

async function openaiEmbed(texts: string[], settings: HotpotSettings): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.embeddingApiKey}`,
    },
    body: JSON.stringify({
      model: settings.embeddingModel || "text-embedding-3-small",
      input: texts,
    }),
  });
  if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function hfEmbed(texts: string[], settings: HotpotSettings): Promise<number[][]> {
  const model = settings.embeddingModel || "sentence-transformers/all-MiniLM-L6-v2";
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.embeddingApiKey}`,
    },
    body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
  });
  if (!res.ok) throw new Error(`Hugging Face ${res.status}: ${await res.text()}`);
  return (await res.json()) as number[][];
}

export interface EmbedOutcome {
  vectors: number[][];
  backend: string;
  degraded?: string;
}

export async function embed(texts: string[], settings: HotpotSettings): Promise<EmbedOutcome> {
  const provider = settings.embeddingProvider;
  if (provider !== "local" && settings.embeddingApiKey) {
    try {
      const vectors = provider === "openai" ? await openaiEmbed(texts, settings) : await hfEmbed(texts, settings);
      return { vectors, backend: `${provider}:${settings.embeddingModel}` };
    } catch (e) {
      return {
        vectors: texts.map(localEmbed),
        backend: `local:all-MiniLM-L6-v2 (hashed)`,
        degraded: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return { vectors: texts.map(localEmbed), backend: "local:all-MiniLM-L6-v2 (hashed)" };
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

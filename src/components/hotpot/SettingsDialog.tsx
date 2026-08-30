import { useEffect, useState } from "react";
import { KeyRound, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  clearSettings,
  DEFAULT_SETTINGS,
  MODEL_CHOICES,
  saveSettings,
  type EmbeddingProvider,
  type HotpotSettings,
  type LlmProvider,
} from "@/lib/hotpot/settings";

interface Props {
  settings: HotpotSettings;
  onChange: (s: HotpotSettings) => void;
}

export function SettingsDialog({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HotpotSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const set = <K extends keyof HotpotSettings>(k: K, v: HotpotSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const configured = settings.llmApiKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
          <KeyRound className="size-3.5" />
          API CONFIG
          <span
            className={`ml-1 size-2 rounded-full ${configured ? "bg-safe live-dot" : "bg-suspicious"}`}
            aria-hidden
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-tight">Engine Configuration</DialogTitle>
          <DialogDescription>
            Credentials never leave this browser — they are stored in{" "}
            {draft.persistKeys ? "localStorage" : "sessionStorage"} and sent only to the provider
            you select.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Tier 3 — Reasoning LLM
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select
                  value={draft.llmProvider}
                  onValueChange={(v) => {
                    const p = v as LlmProvider;
                    setDraft((d) => ({
                      ...d,
                      llmProvider: p,
                      llmModel: p === "none" ? "" : (MODEL_CHOICES[p][0] ?? ""),
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="none">None (local reasoner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Select
                  value={draft.llmModel}
                  onValueChange={(v) => set("llmModel", v)}
                  disabled={draft.llmProvider === "none"}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(draft.llmProvider === "none" ? [] : MODEL_CHOICES[draft.llmProvider]).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llm-key">LLM API Key</Label>
              <Input
                id="llm-key"
                type="password"
                autoComplete="off"
                placeholder={draft.llmProvider === "openai" ? "sk-..." : "gsk_..."}
                value={draft.llmApiKey}
                onChange={(e) => set("llmApiKey", e.target.value)}
                className="font-mono"
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Tier 2 — Embeddings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Embedding backend</Label>
                <Select
                  value={draft.embeddingProvider}
                  onValueChange={(v) => {
                    const p = v as EmbeddingProvider;
                    setDraft((d) => ({
                      ...d,
                      embeddingProvider: p,
                      embeddingModel:
                        p === "openai"
                          ? "text-embedding-3-small"
                          : p === "huggingface"
                            ? "sentence-transformers/all-MiniLM-L6-v2"
                            : "all-MiniLM-L6-v2",
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">In-browser all-MiniLM-L6-v2 (no key)</SelectItem>
                    <SelectItem value="openai">OpenAI text-embedding</SelectItem>
                    <SelectItem value="huggingface">Hugging Face Inference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emb-model">Embedding model</Label>
                <Input
                  id="emb-model"
                  value={draft.embeddingModel}
                  onChange={(e) => set("embeddingModel", e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emb-key">Embedding API Key</Label>
              <Input
                id="emb-key"
                type="password"
                autoComplete="off"
                disabled={draft.embeddingProvider === "local"}
                placeholder={draft.embeddingProvider === "local" ? "Not required for in-browser embeddings" : "sk-... / hf_..."}
                value={draft.embeddingApiKey}
                onChange={(e) => set("embeddingApiKey", e.target.value)}
                className="font-mono"
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Vector Memory — ChromaDB
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="chroma">ChromaDB endpoint</Label>
              <Input
                id="chroma"
                placeholder="http://localhost:8000 (blank = in-browser vector store)"
                value={draft.chromaEndpoint}
                onChange={(e) => set("chromaEndpoint", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="col">Collection</Label>
                <Input id="col" value={draft.chromaCollection} onChange={(e) => set("chromaCollection", e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ten">Tenant</Label>
                <Input id="ten" value={draft.chromaTenant} onChange={(e) => set("chromaTenant", e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="db">Database</Label>
                <Input id="db" value={draft.chromaDatabase} onChange={(e) => set("chromaDatabase", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </section>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Persist credentials across sessions</p>
                <p className="text-xs text-muted-foreground">Off = session-only storage, wiped on tab close.</p>
              </div>
              <Switch checked={draft.persistKeys} onCheckedChange={(v) => set("persistKeys", v)} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Continuous threat training</p>
                <p className="text-xs text-muted-foreground">Write novel confirmed scams back into vector memory.</p>
              </div>
              <Switch checked={draft.autoTrain} onCheckedChange={(v) => set("autoTrain", v)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => {
              clearSettings();
              onChange(DEFAULT_SETTINGS);
              setDraft(DEFAULT_SETTINGS);
              toast.success("Stored credentials wiped");
            }}
          >
            <Trash2 className="size-3.5" /> Wipe credentials
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              saveSettings(draft);
              onChange(draft);
              setOpen(false);
              toast.success("Configuration saved locally", {
                description: draft.llmApiKey ? "Tier-3 LLM reasoning enabled." : "Running on the local deterministic reasoner.",
              });
            }}
          >
            <Save className="size-3.5" /> Save configuration
          </Button>
        </DialogFooter>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-safe" /> All analysis input is PII-sanitized before
          any key is used.
        </p>
      </DialogContent>
    </Dialog>
  );
}

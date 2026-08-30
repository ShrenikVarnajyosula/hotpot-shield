import {
  AlertTriangle,
  Braces,
  Database,
  Fingerprint,
  Gauge,
  Globe,
  Lock,
  Network,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import type { ScanRecord } from "@/lib/hotpot/types";
import { VERDICT_STYLE } from "./verdict-ui";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

export function ResultPanel({ record }: { record: ScanRecord }) {
  const { result, trace } = record;
  const s = VERDICT_STYLE[result.verdict];
  const e = result.extracted_entities;
  const entityGroups: [string, string[]][] = [
    ["UPI handles", e.upi_handles],
    ["Phone numbers", e.phone_numbers],
    ["Domains", e.domains],
    ["APK packages", e.apk_packages],
    ["Emails", e.emails],
  ];

  return (
    <div className="space-y-4">
      {/* Verdict header */}
      <div className={`panel overflow-hidden ${s.ring}`}>
        <div className={`${s.bg} px-5 py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Verdict
              </p>
              <h2 className={`font-mono text-4xl font-bold tracking-tight ${s.text}`}>
                {result.verdict}
              </h2>
              <p className="mt-1 text-sm text-foreground/90">{result.threat_type}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Threat score
              </p>
              <p className={`font-mono text-4xl font-bold ${s.text}`}>{result.threat_score}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                confidence {result.confidence}
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
            <div
              className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
              style={{ width: `${result.threat_score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Lock className="size-3" />} label="PII masked" value={`${trace.stage1.totalMasked} item(s)`} />
        <Stat icon={<Zap className="size-3" />} label="Tier-1 triage" value={`${trace.stage2.score}/100 · ${trace.stage2.elapsedMs.toFixed(1)}ms`} />
        <Stat icon={<Database className="size-3" />} label="Vector recall" value={trace.stage3.matches.length ? `${trace.stage3.matches.length} match · ${(trace.stage3.matches[0]?.similarity_score ?? 0).toFixed(2)}` : "no match >0.75"} />
        <Stat icon={<Braces className="size-3" />} label="Tier-3 engine" value={trace.stage4.engine} />
      </div>

      {/* ChromaDB match */}
      {result.chromadb_match && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Database className="size-3.5" /> ChromaDB campaign memory hit
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <p className="text-base font-semibold">{result.chromadb_match.campaign_name}</p>
            <Badge variant="secondary" className="font-mono text-[11px]">
              cosine {result.chromadb_match.similarity_score}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              first seen {result.chromadb_match.first_seen}
            </span>
            {result.chromadb_match.syndicate && (
              <span className="font-mono text-xs text-muted-foreground">
                syndicate: {result.chromadb_match.syndicate}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Red flags */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <AlertTriangle className="size-3.5" /> Red flags
        </div>
        <ul className="mt-3 space-y-2">
          {result.red_flags.map((f, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${s.bar}`} />
              <span className="text-foreground/90">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Reasoning */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Gauge className="size-3.5" /> Explainable reasoning
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{result.reasoning}</p>
      </div>

      {/* Safety actions */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="size-3.5 text-safe" /> Recommended safety actions
        </div>
        <ol className="mt-3 space-y-2">
          {result.safety_actions.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="font-mono text-xs text-safe">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-foreground/90">{a}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Entities */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Fingerprint className="size-3.5" /> Extracted entities
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {entityGroups.map(([label, items]) => (
            <div key={label}>
              <p className="font-mono text-[11px] text-muted-foreground">{label}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {items.length ? (
                  items.map((v, i) => {
                    const hit = trace.stage3.graphHits.find((g) => g.entity === v);
                    return (
                      <Badge
                        key={`${v}-${i}`}
                        variant="outline"
                        className={`max-w-full truncate font-mono text-[11px] ${hit ? "border-scam/50 text-scam" : ""}`}
                        title={hit ? `${hit.syndicate} — ${hit.note}` : v}
                      >
                        {v}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground/60">none</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Graph hits */}
      {trace.stage3.graphHits.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Network className="size-3.5" /> Syndicate graph links
          </div>
          <div className="mt-3 space-y-2">
            {trace.stage3.graphHits.map((h, i) => (
              <div key={i} className="rounded-md border border-scam/30 bg-scam-soft p-3">
                <p className="font-mono text-xs text-scam">
                  {h.entity} → {h.syndicate}
                </p>
                <p className="mt-1 text-xs text-foreground/80">{h.note}</p>
                <Badge variant="outline" className="mt-2 font-mono text-[10px] uppercase">
                  {h.severity}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL sandbox */}
      {trace.urlIntel && trace.urlIntel.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Globe className="size-3.5" /> URL sandbox
          </div>
          <div className="mt-3 space-y-3">
            {trace.urlIntel.map((u, i) => (
              <div key={i} className="rounded-md border border-border/60 bg-background/40 p-3">
                <p className="break-all font-mono text-xs">{u.url}</p>
                <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-3">
                  <span className="text-muted-foreground">
                    age: <span className="text-foreground">{u.domainAgeDays ?? "?"}d</span>
                  </span>
                  <span className="text-muted-foreground">
                    TLS:{" "}
                    <span className={u.ssl.valid ? "text-safe" : "text-scam"}>
                      {u.ssl.valid ? "valid" : "weak/none"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    risk: <span className="text-foreground">{u.score}/100</span>
                  </span>
                </div>
                {u.redirectChain.length > 1 && (
                  <p className="mt-2 break-all font-mono text-[11px] text-suspicious">
                    chain: {u.redirectChain.join("  →  ")}
                  </p>
                )}
                {u.typosquat && (
                  <p className="mt-1 font-mono text-[11px] text-scam">
                    typosquat of “{u.typosquat.target}” (distance {u.typosquat.distance})
                  </p>
                )}
                <ul className="mt-2 space-y-1">
                  {u.flags.map((f, j) => (
                    <li key={j} className="text-[11px] text-foreground/80">
                      • {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace + raw JSON */}
      <Accordion type="single" collapsible className="panel px-4">
        <AccordionItem value="trace" className="border-b-0">
          <AccordionTrigger className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-2">
              <Timer className="size-3.5" /> Pipeline trace
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 font-mono text-[11px]">
            <p>
              <span className="text-safe">stage 1</span> sanitizer · masked{" "}
              {trace.stage1.masks.map((m) => `${m.type}×${m.count}`).join(", ") || "nothing"}
            </p>
            <p>
              <span className="text-safe">stage 2</span> tier-1 triage ·{" "}
              {trace.stage2.elapsedMs.toFixed(2)}ms · {trace.stage2.signals.length} signal(s)
            </p>
            <p>
              <span className="text-safe">stage 3</span> {trace.stage3.backend} · dims{" "}
              {trace.stage3.embeddingDims} · {trace.stage3.elapsedMs.toFixed(1)}ms
            </p>
            <p>
              <span className="text-safe">stage 4</span> {trace.stage4.engine} ·{" "}
              {trace.stage4.elapsedMs.toFixed(1)}ms
              {trace.stage4.fallback ? " · fallback" : ""}
            </p>
            {trace.stage4.error && <p className="text-scam">llm error: {trace.stage4.error}</p>}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="json" className="border-b-0">
          <AccordionTrigger className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-2">
              <Braces className="size-3.5" /> Structured JSON output
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 font-mono text-[11px]"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                toast.success("JSON copied");
              }}
            >
              Copy JSON
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

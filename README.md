# Hotpot Shield

You are a Principal Full-Stack AI & Cybersecurity Engineer. Build a production-ready, full-stack scam prevention application named "The Hotpot - Personal Digital Safety & Scam Prevention Assistant" implementing the complete end-to-end architecture, detection pipeline, ChromaDB vector memory layer, and continuous threat training engine.

---

### 1. SYSTEM OVERVIEW & API CONFIGURATION
- **App Name:** The Hotpot
- **UI Theme:** Modern dark cybersecurity operations center (Deep slate/zinc background, Emerald green for SAFE, Amber for SUSPICIOUS, Bright Crimson for SCAM).
- **API Settings Modal:** A persistent configuration panel in the top navigation allowing users to input:
  - LLM API Key (Groq `llama-3.3-70b-versatile` or OpenAI `gpt-4o-mini`).
  - Embedding API Key or use client/in-memory embeddings (`all-MiniLM-L6-v2` / Hugging Face).
  - ChromaDB connection endpoint URL (defaulting to an in-memory/browser-compatible vector store or local ChromaDB server endpoint).
  - Store credentials securely in `localStorage`/session.

---

### 2. MULTI-MODAL INPUT CHANNELS
Provide 4 functional input tabs:
1. **Text & Email Analyzer:** Multi-line text field with preset test scenario chips (Electricity Disconnection, Telegram Job Task, Fake KYC, Trai Parcel Scam, Legitimate Delivery).
2. **Screenshot & Slip OCR Analyzer:** File uploader (drag-and-drop PNG/JPG) running OCR / Multimodal Vision to extract text from chat logs, APK installation screens, and fake UPI payment receipts.
3. **URL & Shortlink Sandbox:** Input field inspecting unrolled redirect chains, domain registration age, typosquatting/homoglyph risks, and SSL integrity.
4. **Live QR Code Scanner:** Camera/file scanner reading QR codes and inspecting raw URLs or UPI payment strings (`upi://pay?pa=...`) before interaction.

---

### 3. THE 4-STAGE PIPELINE & CHROMADB MEMORY ARCHITECTURE

Implement the full multi-tier detection pipeline on every scan:

#### Stage 1: Client-Side Privacy Sanitizer (Zero-Leakage)
- Mask sensitive PII before any external API or vector retrieval call:
  - OTPs / Verification Codes: `[REDACTED_OTP]`
  - Bank Accounts / Cards: `[REDACTED_ACCOUNT]`
  - Phone Numbers: `[REDACTED_PHONE]`
  - Account Balances: `[REDACTED_BALANCE]`
- Display an active "🔒 Client-Side Privacy Shield: PII Masked" indicator.

#### Stage 2: Tier 1 Fast Triage (Sub-30ms Heuristics)
- Run instant regex and token scoring for urgency triggers, fear appeals, APK download flags, and suspicious SMS headers.

#### Stage 3: Tier 2 ChromaDB Semantic Memory & Knowledge Graph
- **ChromaDB Vector Store Collection:** `scam_campaign_memory`
  - Compute embeddings for the incoming sanitized input using `all-MiniLM-L6-v2` / OpenAI text-embedding.
  - Query ChromaDB via cosine similarity ($Top\text{--}K = 3$, similarity threshold $> 0.75$) to find semantically matching known fraud campaigns, even if vocabulary or syntax has changed.
- **Graph & Entity Matcher:**
  - Extract entities (UPI IDs, phone numbers, domain names, APK package names).
  - Match extracted entities against a linked graph memory of known cybercrime syndicates and flagged handles.

#### Stage 4: Tier 3 Explainable AI Reasoning (Constrained LLM)
- Inject the input text + matched ChromaDB campaign vectors + extracted entity flags into the LLM system prompt.
- Enforce strict JSON output parsing:
```json
{
  "verdict": "SAFE" | "SUSPICIOUS" | "SCAM",
  "threat_score": 88,
  "threat_type": "Fake Utility Disconnection / APK Trojan Fraud",
  "confidence": "HIGH",
  "red_flags": [
    "Artificial urgency claiming power cutoff tonight at 9:30 PM",
    "Directs user to contact a personal 10-digit number instead of utility desk",
    "Instructs download of an unverified remote-access APK"
  ],
  "reasoning": "The message mimics official electricity board communications but routes the victim to a personal contact and malicious file to gain unauthorized device access.",
  "chromadb_match": {
    "campaign_name": "National Power Syndicate #402",
    "similarity_score": 0.89,
    "first_seen": "2026-02-14"
  },
  "safety_actions": [
    "Do not click the link or install the downloaded APK.",
    "Verify bill status directly on the official board website.",
    "Report to National Cyber Crime Portal (1930 / cybercrime.gov.in)."
  ],
  "extracted_entities": {
    "upi_handles": ["bijli.pay@ybl"],
    "phone_numbers": ["[REDACTED_PHONE]"],
    "domains": ["[http://update-bijli.xyz/app.apk](http://update-bijli.xyz/app.apk)"]
  }
}

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7b6d51d5-d12a-4178-8d8b-b2bca0c2a116).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# `/server` — Backend Intelligence, Retrieval & Persistence Services

This directory contains the modular Node.js / TypeScript backend services imported by the root Express server (`/server.ts`). Together, they power SAIL's RAG pipeline, Zilliz Cloud vector operations, MLflow/Databricks tracing, live RSS aggregation, and persistent chat/shortcut storage.

---

## Module Inventory

| Module | Purpose & Key Responsibilities |
| :--- | :--- |
| `agent_service.ts` | **Core SAIL Agentic Workflow Engine.** Generates 3072-dimensional query embeddings (`gemini-embedding-001` via `v1beta`), triggers parallel hybrid search across all 4 Zilliz collections, streams analytical synthesis chunks via `gemini-3.8-flash` (with fallback chain `gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3.8-flash`), records MLflow spans, and exposes `runDeepDiagnostics()` for `POST /api/diagnostics`. |
| `retrieval_zilliz.ts` | **Zilliz Cloud Multi-Collection Hybrid Search.** Queries `News`, `AIS`, `Seaport`, and `Filling` collections concurrently over Zilliz REST API v2, combining 3072-dim dense vector search with metadata keyword filters. Also exports `createFastPseudoEmbedding()`, `getZillizStatus()`, and `testZillizDiagnostic()`. |
| `ais_intent.ts` | **AIS Telemetry Intent Extractor.** Uses `gemini-3.1-flash-lite` (with regex fallback) to extract 9-digit vessel `MMSI` integers and uppercase `vessel_name` strings from user queries, then builds exact Zilliz boolean filter expressions via `buildAisFilter()` prioritizing MMSI matches. |
| `chat_store.ts` | **Chat Session Persistence Engine.** Persists conversation threads locally in `/data/chat_history.json` and syncs them asynchronously to the Zilliz Cloud `ChatHistory` collection. Automatically splits large `messagesJson` payloads across chunked entities to stay safely below Milvus's 65,536-byte dynamic field (`$meta`) limit, reassembles multi-chunk chats on restore, and auto-summarizes first user prompts into concise titles. |
| `shortcut_store.ts` | **Quick Prompt Persistence Engine.** Manages CRUD operations for user Quick Prompts stored locally in `/data/shortcuts.json` and synced to a dedicated Zilliz Cloud `QuickPrompt` collection (`ZILLIZ_2_URI` / `ZILLIZ_2_KEY`), with automatic fallback to a `__quickprompt__:` partition in `ChatHistory` if the secondary cluster is unavailable. |
| `rss_service.ts` | **Maritime RSS Feed Aggregator.** Reads/writes feed URLs from `/data/rss.sub`, parses XML feeds using `fast-xml-parser`, caches responses for 30 minutes (1800s TTL), and provides graceful fallback entries if upstream feeds are temporarily unreachable. |
| `mlflow_tracer.ts` | **MLflow Tracing & Databricks Sync.** Tracks execution traces and child spans (`CHAIN`, `EMBEDDING`, `RETRIEVER`, `LLM`) in an in-memory 50-trace ring buffer (`GET /api/traces`) and optionally forwards OTel-compatible spans to a remote Databricks MLflow Tracking Server when `DATABRICKS_HOST` and `DATABRICKS_TOKEN` are configured. |
| `zilliz_tracer.ts` | **Zilliz HTTP Observability & Round-Trip Diagnostics.** Wraps Zilliz REST v2 calls via `tracedZillizFetch()`, normalizes REST URLs (stripping `:19530` gRPC ports) and tokens, keeps a 100-call sanitized HTTP ring buffer (`GET /api/zilliz/traces`), and provides full end-to-end diagnostic tests (`runZillizChatDiagnostic()`, `runZillizQuickPromptDiagnostic()`). |
| `test_databricks_trace.ts` | **Databricks Trace Diagnostic Utility.** Runs step-by-step verification of Databricks MLflow connectivity and trace ingestion. Triggered via `POST /api/traces/test-sync` or directly from the CLI. |

---

## How to Use

### Server Integration
All modules are imported and mounted onto Express routes in `/server.ts`:
- `POST /api/chat/stream` → `agent_service.runSailWorkflowStream`
- `POST /api/diagnostics` → `agent_service.runDeepDiagnostics`
- `GET/POST /api/rss*` → `rss_service`
- `GET/POST/PATCH/DELETE /api/chats*` → `chat_store`
- `GET/POST/PUT/DELETE /api/shortcuts*` → `shortcut_store`
- `GET/POST /api/traces*` → `mlflow_tracer`, `test_databricks_trace`
- `GET/POST /api/zilliz/*` → `zilliz_tracer`

### Running Standalone Diagnostics from CLI
To test Databricks MLflow trace synchronization directly from the terminal:
```bash
npx tsx server/test_databricks_trace.ts
```

### Development Guidelines
- Always import sibling modules using `.js` extensions (e.g., `import { getZillizStatus } from './retrieval_zilliz.js';`) so `tsx` and TypeScript ESM resolution stay consistent.
- Never hardcode API keys in `/server`; always read credentials from `process.env` (loaded via `dotenv.config()` in `server.ts`).

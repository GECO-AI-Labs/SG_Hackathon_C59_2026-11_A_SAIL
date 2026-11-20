# SAIL — Maritime Intelligence & Scenario Planning Platform

**SAIL (Scenario & Intelligence for Liners)** is a full-stack maritime intelligence copilot and deterministic strategic fleet scenario planning application designed for Southeast Asian and intra-Asian container shipping.

It combines:
- **SAIL Copilot (React SPA + Express SSE Backend):** Real-time multi-collection RAG over Zilliz Cloud (`News`, `AIS`, `Seaport`, `Filling`), Gemini 3.8 Flash streaming synthesis, MLflow/Databricks execution tracing, live maritime RSS feeds, AIS vessel monitoring, and shipping lane intelligence.
- **SAIL Scenario Planning (Standalone 8-Factor Deterministic Web App):** An interactive fleet capacity, vessel selection, three-layer commitment (`Locked`, `Flexible`, `Watch Zone`), cost/revenue sensitivity, Gantt roadmap, and executive brief workspace with direct cross-tab relay (`Ask SAIL`) back to the main SAIL Copilot.

---

## Project Directory Map

Every directory contains its own detailed `README.md`:

| Directory | Purpose |
| :--- | :--- |
| `/` | Root configuration, Express + Vite server entry point (`server.ts`), HTML entry (`index.html`), and build tooling. |
| `/src` | React 19 + TypeScript + Tailwind CSS v4 frontend application source code (`App.tsx`, `main.tsx`, `types.ts`, `index.css`). |
| `/src/components` | Modular UI components for the chat workspace, collapsible/resizable sidebar, header, breaking news ticker, diagnostics, and MLflow/Zilliz observability modals. |
| `/src/data` | Static TypeScript domain datasets for Southeast Asian shipping corridors and scenario baseline definitions. |
| `/server` | Backend TypeScript modules for Gemini RAG workflows, Zilliz Cloud hybrid search, AIS intent extraction, MLflow/Databricks tracing, RSS aggregation, and chat/shortcut persistence. |
| `/data` | Local runtime datasets and persistence caches (`Sample_AIS_dataset_200Rows_AsiaPacific.json`, `rss.sub`, `chat_history.json`, `shortcuts.json`). |
| `/public` | Static files served directly by Express and Vite. |
| `/public/assets` | Versioned static web application assets served with `no-store` cache headers. |
| `/public/assets/aistudio` | Standalone **SAIL Scenario Planning** 8-Factor Deterministic Fleet Planning web application (HTML, CSS, JS). |

---

## Root Files Overview

| File | Description |
| :--- | :--- |
| `server.ts` | Main Express server (port `3000`). Exposes all `/api/*` routes (chat SSE streaming, RSS, AIS vessels, shipping lanes, chat history, quick-prompt shortcuts, MLflow/Zilliz tracing, diagnostics, and `/api/copilot/brief*` cross-tab relay), serves `/assets/aistudio` with `no-store` headers, and mounts Vite dev middleware (or static `dist/` in production). |
| `index.html` | HTML entry point for the React SPA with Google Fonts (`Plus Jakarta Sans`, `JetBrains Mono`) and metadata. |
| `package.json` | NPM scripts and runtime/dev dependencies. |
| `vite.config.ts` | Vite bundler configuration with React and Tailwind CSS v4 plugins. |
| `tsconfig.json` | TypeScript compiler configuration. |
| `.env.example` | Template listing required environment variables (never commit real secrets). |
| `metadata.json` | Application identity, description, and platform capabilities. |

---

## Environment Setup

Copy `.env.example` to `.env` (or configure secrets in your hosting environment):

```env
GEMINI_API_KEY=           # Required for Gemini LLM synthesis & 3072-dim embeddings
ZILLIZ_URI=               # Primary Zilliz Cloud REST endpoint (News, AIS, Seaport, Filling, ChatHistory)
ZILLIZ_API_KEY=           # Primary Zilliz Cloud API key
ZILLIZ_2_URI=             # Optional dedicated Zilliz Cloud cluster for QuickPrompt shortcuts
ZILLIZ_2_KEY=             # Optional API key for ZILLIZ_2_URI
DATABRICKS_HOST=          # Optional Databricks workspace URL for remote MLflow trace syncing
DATABRICKS_TOKEN=         # Optional Databricks personal access token
MLFLOW_EXPERIMENT_NAME=   # Optional MLflow experiment path (e.g., /Users/you@domain.com/SAIL_Traces)
```

---

## How to Run & Use

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode (Port 3000)
Runs `server.ts` via `tsx` with Vite middleware mounted for the frontend:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Type Check & Production Build
```bash
npm run lint   # Runs tsc --noEmit
npm run build  # Compiles production frontend bundle into /dist
```

### 4. Production Start
```bash
NODE_ENV=production npm start
```

### 5. Key Keyboard Shortcuts & Workflows
- **Ask SAIL:** Type any maritime question in the main chat box, click a Quick Prompt card, click a breaking news headline in the top ticker, or click **Ask SAIL** inside the Scenario Planning tab to relay a full Strategic Fleet Planning Brief directly into the chat.
- **Observability & Tracing (`Ctrl+X` / `Cmd+X`):** Opens the Execution Tracing & Observability modal showing MLflow spans, Databricks sync status, and Zilliz Cloud HTTP trace logs.
- **System Diagnostics:** Click **Diagnostic** in the top-right header to run a live 3-phase check across Gemini LLM, 3072-dim Embeddings, and Zilliz Cloud collections.
- **Scenario Planning:** Open the **Scenario Planning** tab in the sidebar to launch the standalone 8-slider planning engine in a new tab (or preview it inline).
- **Ref Fleet:** Open the **Ref Fleet** tab in the sidebar to launch external reference Streamlit dashboards (`Fleet Management Dashboard` and `SAIL Reference Dashboard`) in new tabs.

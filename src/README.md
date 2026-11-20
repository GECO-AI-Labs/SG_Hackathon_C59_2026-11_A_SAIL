# `/src` — Frontend React Application Source

This directory contains the client-side React 19 + TypeScript + Tailwind CSS v4 Single-Page Application (SPA) for the **SAIL Maritime Intelligence** workspace.

---

## What It Is Used For

`/src` manages the primary interactive user interface:
- Real-time streaming chat with the SAIL Maritime Copilot (`/api/chat/stream` via Server-Sent Events).
- Multi-tab collapsible and resizable left sidebar (Chat History, Maritime RSS Feeds, 199 AIS Vessels, Southeast Asia Shipping Lanes, Fleet Dashboard, Scenario Planning launcher, and Ref Fleet external links).
- Cross-tab / cross-iframe strategy brief relay listener so clicking **Ask SAIL** in the standalone Scenario Planning page immediately submits the brief into the active Copilot conversation.
- Live breaking maritime news ticker, 4-phase diagnostics modal, and MLflow/Zilliz observability modal.

---

## Files & Subdirectories

| Path | Description |
| :--- | :--- |
| `main.tsx` | React root entry point that mounts `<App />` inside `#root` in `index.html` and imports `index.css`. |
| `App.tsx` | Root application container managing global state: chat messages, session IDs, SSE streaming parser, Zilliz chat history persistence, Quick Prompt CRUD, RSS/AIS/Lane data fetching, sidebar width/minimization, `Ctrl+X` observability shortcut, and the 1-second polling + SSE/BroadcastChannel listener for incoming Strategy Briefs from Scenario Planning. |
| `types.ts` | Centralized TypeScript interfaces for messages, RSS feeds, MLflow traces & spans, Zilliz HTTP traces, system status, diagnostics, AIS vessels, shipping lanes, saved chats, quick-prompt shortcuts, and scenario planning models. |
| `index.css` | Global Tailwind CSS v4 stylesheet (`@import "tailwindcss";`) and custom typography/scrollbar/surface theme utilities (`Plus Jakarta Sans` and `JetBrains Mono`). |
| `components/` | Reusable React UI components (see `/src/components/README.md`). |
| `data/` | Frontend static domain data modules (see `/src/data/README.md`). |

---

## How to Use & Extend

### Adding a New UI Feature or Sidebar Tab
1. Define any new data models or API payload types in `src/types.ts`.
2. Add or update components inside `src/components/`.
3. Wire state, API fetches, and callbacks in `src/App.tsx`.
4. Verify TypeScript types and Vite bundling from the project root:
   ```bash
   npm run lint
   npm run build
   ```

### Cross-Tab Brief Relay Protocol (`App.tsx`)
When the user clicks **Ask SAIL** in `/public/assets/aistudio/index_23d044a4.html`:
1. The Scenario Planning page POSTs the full Strategy Brief to `/api/copilot/brief`.
2. `App.tsx` receives it via 1-second polling (`GET /api/copilot/brief-pending`), SSE (`/api/copilot/brief-events`), `BroadcastChannel`, or `postMessage`.
3. `App.tsx` deduplicates by `requestId`, sends an acknowledgment to `POST /api/copilot/brief-ack`, switches to the active Copilot view, and automatically invokes `handleSendMessage(payload.prompt)`.

### Environment Variable Rule
All client-accessible environment variables exposed to code in `/src` must be prefixed with `VITE_`. Never expose private API keys (`GEMINI_API_KEY`, `ZILLIZ_API_KEY`, `DATABRICKS_TOKEN`) in `/src`; always proxy through `/api/*` routes in `server.ts`.

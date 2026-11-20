# `/src/components` — React UI Components

This directory contains all modular, functional React components used to build the **SAIL Maritime Intelligence** user interface. Every component uses TypeScript, `lucide-react` icons, and Tailwind CSS utility classes following the Contemporary Fintech & Logistics Tech aesthetic (`#FAFAFA` canvas, `#FFFFFF` cards, `#E4E4E7` borders, `#4338CA` Royal Indigo primary accent).

---

## Component Inventory

| Component | Purpose & Key Capabilities |
| :--- | :--- |
| `Header.tsx` | Sticky top navigation bar (`h-14`). Displays the sidebar minimize/expand toggle, SAIL v2.0 brand lockup, live system online indicator, and the **Diagnostic** trigger button. |
| `NewsTicker.tsx` | Live dark-bar breaking maritime news reader below the header. Auto-rotates headlines from subscribed RSS feeds every 6 seconds with Pause/Play, Previous/Next controls, direct external article links, and one-click **Analyze** (sends the headline directly to SAIL Copilot). |
| `Sidebar.tsx` | Collapsible & drag-resizable left navigation panel (minimizes to a `56px` icon rail or expands up to `50vw` half-screen). Houses 7 workspace tabs: <br>• **Chats (`history`)**: Search, open, create, rename, and delete Zilliz-persisted chat sessions.<br>• **RSS (`rss`)**: Subscribe/unsubscribe to maritime RSS feeds, refresh feeds, and send articles to SAIL.<br>• **Fleet (`vessels`)**: Search and speed-filter all 199 monitored AIS vessels, upload custom fleet CSVs, and trigger vessel analysis.<br>• **Lanes (`lanes`)**: Browse, filter, and inspect Southeast Asian shipping corridors, draft limits, hazards, and feeder loops.<br>• **Dashboard (`fleet-planning`)**: Launches `fleetplanning.ai.studio` in a new tab or toggleable inline console with quick analytical prompts.<br>• **Scenario Planning (`scenario-strategy`)**: Launches the standalone SAIL Scenario Planning web app (`/assets/aistudio/index_23d044a4.html`) in a new tab (or inline sidebar preview) and lists the 4 baseline strategic scenarios.<br>• **Ref Fleet (`ref-fleet`)**: External new-tab launch cards for the **Fleet Management Dashboard** (`fleetmgmtdashboardv2.streamlit.app`) and **SAIL Reference Dashboard** (`planningenginedashboard.streamlit.app`). |
| `ChatArea.tsx` | Main center conversational workspace. Renders the scrollable message thread, empty-state Quick Prompt shortcut cards (with full Create/Edit/Delete modal CRUD synced to Zilliz), Thinking Level selector (`Low`, `Medium`, `High`), auto-resizing prompt composer, and New/Clear chat actions. |
| `ChatMessage.tsx` | Renders individual user and assistant chat bubbles. Formats markdown headings, bold citations, and bullet lists; displays live retrieval stage indicators (`News`, `AIS`, `Seaport`, `Filling` hit counts), confidence score badges, copy-to-clipboard, thumbs up/down feedback, and a direct **Inspect Trace** button linking to `MLflowModal`. |
| `DiagnosticsModal.tsx` | Interactive modal triggered from the top bar **Diagnostic** button. Executes `POST /api/diagnostics` and renders pass/fail status and latency for Phase 1 (Gemini LLM), Phase 2 (3072-dim Embeddings), and Phase 3 (Zilliz Cloud Collections). |
| `MLflowModal.tsx` | Full observability console toggled via `Ctrl+X` / `Cmd+X` or by clicking a message's trace badge. Displays MLflow workflow trace spans (`CHAIN`, `RETRIEVER`, `EMBEDDING`, `LLM`), Databricks remote sync diagnostics (`POST /api/traces/test-sync`), Zilliz Cloud HTTP trace logs (`/api/zilliz/traces`), and Zilliz round-trip diagnostic tools. |

---

## How to Use

Components are composed in `src/App.tsx` via unidirectional props and callback handlers:

```tsx
import { Header } from './components/Header.js';
import { NewsTicker } from './components/NewsTicker.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatArea } from './components/ChatArea.js';
import { DiagnosticsModal } from './components/DiagnosticsModal.js';
import { MLflowModal } from './components/MLflowModal.js';
```

### Conventions
- **ESM TypeScript Imports:** Always use `.js` extensions on relative imports (e.g., `../types.js`) to remain compatible with the project's ESM `NodeNext`/`tsx` configuration.
- **No Direct API Keys:** Components communicate exclusively with local `/api/*` endpoints via callbacks passed from `App.tsx` (or `fetch('/api/...')` inside self-contained diagnostic modals).
- **Responsive Layout:** The sidebar supports mouse drag-resizing and double-click half-screen toggling; ensure any new sidebar tabs use `overflow-y-auto` and `min-w-0` / `truncate` to prevent horizontal clipping.

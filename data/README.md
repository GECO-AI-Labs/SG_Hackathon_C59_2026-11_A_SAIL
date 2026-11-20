# `/data` — Local Runtime Datasets & Persistence Cache

This directory stores local JSON datasets and file-backed runtime caches read and written by `/server.ts` and the backend services in `/server/`.

---

## Files Overview

| File | Managed By | Purpose |
| :--- | :--- | :--- |
| `Sample_AIS_dataset_200Rows_AsiaPacific.json` | `server.ts` (`GET /api/vessels`) | Baseline Asia-Pacific AIS telemetry dataset containing ~199 monitored vessels (MMSI, VesselName, LAT/LON, SOG, COG, Heading, Status, Speed_Category, Length, Width, Draft, Cargo, destination cluster, ETA). Rendered in the Sidebar **Fleet** tab. |
| `rss.sub` | `server/rss_service.ts` | Plain-text newline-delimited list of subscribed maritime RSS feed URLs (defaults to Hellenic Shipping News top stories, international shipping news, dry/tanker charter estimates, and container reports). Automatically created if missing and updated whenever users subscribe/unsubscribe in the UI. |
| `chat_history.json` | `server/chat_store.ts` | Local disk cache of saved SAIL Copilot conversation threads (`SavedChat[]`). Loaded on server startup and synchronized bidirectionally with the remote Zilliz Cloud `ChatHistory` collection. |
| `shortcuts.json` | `server/shortcut_store.ts` | Local disk cache of Quick Prompt shortcuts (`{ seeded, shortcuts }`). Seeded with 4 default maritime prompts on first run and synchronized with the Zilliz Cloud `QuickPrompt` collection (or `ChatHistory` fallback partition). |

---

## How to Use

### Updating Monitored AIS Vessels
- **Via UI:** Open the **Fleet** tab in the sidebar and upload a custom `.csv` file with columns such as `MMSI`, `VesselName`, `LAT`, `LON`, `SOG`, `Status`, `Length`, `Width`, `Draft`, and `Cargo`.
- **Via File:** Replace or update `Sample_AIS_dataset_200Rows_AsiaPacific.json` with a valid JSON array of vessel objects matching `AISVessel` in `/src/types.ts`. Changes take effect immediately on the next `GET /api/vessels` call.

### Managing RSS Feeds
- **Via UI:** Open the **RSS** tab in the sidebar to add or remove feed URLs (`POST /api/rss/subscribe` and `POST /api/rss/unsubscribe`).
- **Via File:** Edit `rss.sub` with one RSS/Atom URL per line and click refresh in the UI (or wait for the 30-minute server cache TTL to expire).

### Resetting Local Caches
- Deleting `chat_history.json` or `shortcuts.json` clears the local disk cache; on next startup (or via sync endpoints `/api/chats/sync-zilliz` and `/api/shortcuts/sync-zilliz`), the backend will restore persisted records from Zilliz Cloud if configured.

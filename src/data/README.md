# `/src/data` — Frontend Domain Datasets & Reference Models

This directory holds typed TypeScript reference datasets and helper utilities shared across the frontend (and selected backend routes).

---

## Files Overview

| File | Description |
| :--- | :--- |
| `shippingLanes.ts` | Exports `SOUTHEAST_ASIA_LANES: ShippingLane[]` — a curated catalog of Southeast Asian trunk lanes, strait chokepoints, feeder corridors, and archipelagic routes (e.g., Straits of Malacca & Singapore, South China Sea Intra-ASEAN Trunk, Java Sea & Sunda Strait). Includes primary port codes, transit distance (nm), average transit days, congestion status, draft limits, dominant vessel classes, daily vessel density, navigational hazards, indicative freight rates, and active feeder loops. Served both in the Sidebar **Lanes** tab and via `GET /api/lanes` in `server.ts`. |
| `seedScenarios.ts` | Exports `SEED_SCENARIOS`, `SLIDER_SPECS`, `calculateScenario()`, `parseScenarioCSV()`, `generateStrategyBrief()`, and numeric/currency formatters (`num`, `formatNumber`, `formatMoney`). Provides shared TypeScript reference scenario definitions and the 8-slider specification (`Demand growth`, `Freight rate level`, `Fuel / bunker price`, `Charter rate`, `Disruption severity`, `Competitor capacity`, `Growth ambition`, `Budget ceiling`). |

---

## How to Use

### Importing Shipping Lanes
```ts
import { SOUTHEAST_ASIA_LANES } from './shippingLanes.js';

// Used on the backend (server.ts -> GET /api/lanes) and as initial state in App.tsx / Sidebar.tsx
const malaccaLane = SOUTHEAST_ASIA_LANES.find(l => l.code === 'SEA-MAL-01');
```

### Importing Seed Scenario Reference Data
```ts
import { SEED_SCENARIOS, SLIDER_SPECS, calculateScenario } from './seedScenarios.js';

const baseResult = calculateScenario(SEED_SCENARIOS[0]);
```

> **Note:** The active interactive **Scenario Planning** web application launched from the sidebar runs as a standalone deterministic engine inside `/public/assets/aistudio/` (`data-scenarios_56bb1f29.js` and `calc-engine_7dfee841.js`). Updates to the Scenario Planning tab UI or model formulas should be made in `/public/assets/aistudio/`.

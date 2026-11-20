# `/public/assets/aistudio` — SAIL Scenario Planning Web Application

This directory contains the standalone, zero-build **SAIL Scenario Planning** 8-Factor Deterministic Fleet Planning web application. It is launched in a new browser tab (or inline sidebar preview) from the **Scenario Planning** tab in the main SAIL Copilot sidebar, and is also accessible directly at `/assets/aistudio/index_23d044a4.html` or `/fleet-strategy`.

---

## What It Is Used For

SAIL Scenario Planning enables liner executives and network planners to stress-test fleet capacity decisions in real time using an interactive 8-slider deterministic model, producing:
1. **Recommended Strategic Posture** (`Aggressive Growth`, `Defensive Growth`, `Flexible Expansion`, or `Capacity Preservation`) with multi-signal rationale.
2. **Capacity Requirements & Gap Analysis** across Low, Base, and High demand sensitivity cases.
3. **Disruption- & Bunker-Adjusted Vessel Specifications** comparing standard container classes (`Feedermax`, `Panamax`, `Post-Panamax`, `Neo-Panamax`).
4. **Three-Layer Capacity Commitment Strategy** (`Locked`, `Flexible`, `Watch Zone`) with 100% mathematical reconciliation and Budget Ceiling governance.
5. **Phased Quarterly Investment & Deployment Roadmap** (Gantt-style schedule).
6. **Cost, Revenue & Return Sensitivity Analysis** (`-10%`, `Base`, `+15%` bands including Net Fleet Contribution and Break-Even Freight Index).
7. **Executive Strategy Brief** with Copy, Download `.TXT`, Print/PDF, and **Ask SAIL** direct relay back to the main SAIL Copilot webapp.

---

## File Inventory

| File | Role |
| :--- | :--- |
| `index_23d044a4.html` | Application HTML layout: top executive navbar, 7-step decision pipeline breadcrumbs, left sidebar with Scenario Management + the 8 sliders + Vessel Class Benchmark selector, right dashboard outputs, Save Custom Scenario modal, and the 8-Factor **Model Methodology** modal. |
| `style_d7ff6143.css` | Contemporary Fintech & Logistics Tech design tokens (`#FAFAFA` canvas, `#FFFFFF` cards, `#E4E4E7` hairline borders, `#4338CA` Royal Indigo primary accent, `#6366F1` Electric Lapis secondary accent, `#18181B` jet-black type, `#059669` / `#E11D48` semantic status colors, `Plus Jakarta Sans` + `JetBrains Mono`). |
| `data-scenarios_56bb1f29.js` | Defines `PREDEFINED_SCENARIOS` (Scenarios A–D: *Grow Ahead of the Market*, *Defend Market Position*, *Preserve Flexibility*, *Protect Cash and Capacity*) and `VESSEL_CLASSES` benchmark specs. |
| `calc-engine_7dfee841.js` | Exposes `SailCalcEngine`: runs `calculateModel(inputs)`, `evaluateStrategicPosture(...)`, `generateRoadmapSchedule(...)`, and `generateStrategyBrief(model, scenarioName)`. |
| `app_b04b6371.js` | UI controller managing two-way binding for all 8 sliders/number inputs, `localStorage` custom scenario persistence (`SAIL_USER_SAVED_SCENARIOS_V2`), DOM rendering for all dashboard sections, markdown-to-HTML brief formatting, and the **Ask SAIL** cross-tab relay. |

---

## The 8 Core Planning Sliders & Model Methodology

| # | Slider | Input Key | Range | Model Impact |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Demand growth** | `marketDemandGrowth` | `-10%` to `+25%` p.a. | Anchors baseline market cargo growth and Low/High demand bands. |
| 2 | **Freight rate level** | `freightRateLevel` | `50%` to `150%` of base | Scales revenue per TEU (`$950 × F_idx/100`), Net Contribution, Break-Even spread, and Locked risk gates. |
| 3 | **Fuel / bunker price** | `bunkerPrice` | `$300` to `$1,000` / t | Adjusts dynamic unit vessel operating cost across `330` operating days/year (`P_bunker × Daily_Fuel_Tonnes × 330`). |
| 4 | **Charter rate** | `charterRate` | `$10k` to `$35k` / day | Adjusts dynamic unit vessel operating cost (`60%` charter weight over `330` operating days/year). |
| 5 | **Disruption severity** | `disruptionSeverity` | `0%` to `100%` | Extends voyage turnaround by `1 + 0.30 × D` (reducing effective vessel TEU productivity), adds `+0.08 × D` schedule absorption demand, and tightens Locked risk gates above `45%`. |
| 6 | **Competitor capacity** | `competitorCapacityGrowth` | `-20%` to `+30%` p.a. | Pressures Low-case demand retention and triggers `Defensive Growth` posture when rival expansion outpaces market demand. |
| 7 | **Growth ambition** | `businessAmbitionGrowth` | `0%` to `+35%` p.a. | Blends with Demand growth (`g_base = g_mkt + 0.65 × (g_amb - g_mkt)`) to determine target cargo expansion. |
| 8 | **Budget ceiling** | `budgetCeiling` | `$5M` to `$120M` | Caps affordable Locked + Flexible incremental capacity; any excess Base requirement is deferred into the `Watch Zone` so 100% reconciliation is preserved. |

---

## How to Use

1. **Open the Workspace:** Click **Scenario Planning (Open in New Tab)** inside the main SAIL sidebar, or navigate directly to `/fleet-strategy`.
2. **Select or Customize a Scenario:** Choose one of the 4 predefined scenarios from the dropdown, adjust any of the 8 sliders or vessel class benchmarks, and click **Save As...** to store custom scenarios in your browser.
3. **Inspect Formulas:** Click **Model Methodology** in the top bar to view the full mathematical specification.
4. **Relay to SAIL Copilot (`Ask SAIL`):** Click **Ask SAIL** in the top bar or Strategy Brief card. This dispatches the entire `SAIL STRATEGIC FLEET PLANNING BRIEF` to `POST /api/copilot/brief` (plus `BroadcastChannel`/`postMessage`) so the original SAIL Copilot tab immediately inserts and analyzes the brief—while keeping your Scenario Planning tab open for further adjustments.

### Editing & Cache Busting
Because these files are plain browser HTML/CSS/JS served directly by Express with `no-store` headers, edits take effect on browser refresh. When making breaking JS/CSS updates, bump the `?v=...` query string in `index_23d044a4.html` and in `src/components/Sidebar.tsx`.

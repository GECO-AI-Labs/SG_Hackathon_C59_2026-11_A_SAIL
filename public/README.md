# `/public` — Static Public Assets

This directory holds static files served directly over HTTP by Vite (in development) and Express (`/server.ts`).

---

## What It Is Used For

Files inside `/public` are exposed at the root URL path `/` without passing through Vite's JavaScript bundler. In SAIL, this directory hosts the standalone **SAIL Scenario Planning** web application under `/public/assets/aistudio/`.

---

## Directory Structure

```text
public/
├── README.md
└── assets/
    ├── README.md
    └── aistudio/          # Standalone SAIL Scenario Planning 8-Factor Deterministic Web App
        ├── README.md
        ├── index_23d044a4.html
        ├── style_d7ff6143.css
        ├── app_b04b6371.js
        ├── calc-engine_7dfee841.js
        └── data-scenarios_56bb1f29.js
```

---

## How to Use

- Place any unbundled static assets (standalone HTML apps, downloadable templates, favicons, or static documents) inside `/public`.
- Files placed at `/public/<path>` are accessible at `http://localhost:3000/<path>`.
- Note that `/assets/aistudio` is explicitly mounted in `/server.ts` with `Cache-Control: no-store` headers so edits to the Scenario Planning web app take effect immediately without browser caching issues.

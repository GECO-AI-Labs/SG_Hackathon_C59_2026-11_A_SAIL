# `/public/assets` — Versioned Static Web Assets

This directory organizes static application assets served under the `/assets/*` URL prefix.

---

## What It Is Used For

Currently, `/public/assets` houses the `aistudio/` bundle containing the standalone **SAIL Scenario Planning** web application.

---

## Express Routing & Cache Policy

In `/server.ts`, `/public/assets/aistudio` is served through a dedicated `express.static` middleware with aggressive no-cache headers:

```ts
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

It is also aliased to the convenience routes `/fleet-strategy` and `/fleet-strategy/`, which serve `aistudio/index_23d044a4.html`.

---

## How to Use

- Refer to `/public/assets/aistudio/README.md` for detailed documentation on modifying or extending the SAIL Scenario Planning engine, sliders, styling, and Strategy Brief relay.
- When adding new static asset subdirectories under `/public/assets/`, reference them using root-relative URLs (e.g., `/assets/<subdir>/<filename>`).

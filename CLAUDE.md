# CLAUDE.md

## What this repo is

Two things live here:

1. **Prompt collections** at the root (`Cursor Prompts/`, `Devin AI/`, `Lovable/`, `Manus Agent Tools & Prompt/`, `Replit/`, `RooCode/`, `Windsurf/`, `v0 Prompts and Tools/`). Reference material only. Do not edit unless asked.
2. **`todays-lists/`**: the Today's Lists web app. All engineering work happens here.

Today's Lists is a shopping and to-do list that works out the exact part a list entry needs (laces today: model + size + eyelets → inches), finds it nearby or online, and plans the shortest trip out and back home. The claude.ai artifact at https://claude.ai/artifact/2vpRHGw68JBcwCwbXxWuTK is the preview we iterate on; it is rebuilt from this repo, never edited by hand.

## Stack

- Vite 8, React 18, TypeScript (strict), plain CSS in `src/styles.css`.
- Vitest for tests, ESLint (typescript-eslint + react-hooks) and Prettier.
- npm. Node 20.19+ or 22.13+ (Vite 8's range). Developed on Arch Linux and in Termux; nothing may depend on a desktop-only tool.
- No backend. Persistence is cookie + localStorage; on claude.ai the optional `window.claude` runtime adds account sync and Claude lookups.

## Commands (run inside `todays-lists/`)

```bash
npm install
npm run dev            # dev server, add -- --host to reach it from a phone
npm run check          # typecheck + lint + prettier --check + tests (run before every commit)
npm test               # vitest run
npm run lint           # eslint src
npm run format         # prettier --write
npm run build          # dist/ for GitHub Pages or any static host
npm run build:single   # dist-single/index.html for the artifact preview
```

## Layout

```
todays-lists/src/
  calc/            part calculators: text → what exactly to buy
    types.ts       PartCalculator interface (parse, calc, missing, complete, summary, search)
    registry.ts    category id → calculator; add new calculators here
    laces/         data.ts (models + sources), index.ts (parse/calc), calculator.ts, laces.test.ts
  data/catalog.ts  categories, chains, STORE_ROWS seed stores, towns, default home bases
  lib/             geo, links, stores (odds), plan (routing + re-routing), importers, storage, state
  ui/              React components; App.tsx owns state, persistence and the claude runtime
  types.ts         shared domain types
  claude.d.ts      window.claude typing
```

## Conventions

- Strict TypeScript. No `any`; use `unknown` and narrow. Keep `npm run check` green.
- Conventional commits: `feat(laces): …`, `fix(plan): …`, `docs: …`, `chore: …`.
- Never hand-edit `dist/` or `dist-single/`; they are build output and git-ignored.
- Never commit API keys, tokens or personal coordinates. Home bases in `catalog.ts` are town centers.
- Every spec or data entry cites where it came from: `ShoeModel.src`, the comment above `STORE_ROWS`, test names.
- `STORE_ROWS` keep the shape `[id, chain, name, kind, street, city, st, zip, phone, lat, lon, flags?]`. Ids are stable and lowercase (`chain-town`).
- New part types go through `src/calc/`: write the calculator, register it, add tests. Do not special-case a category in the UI when the registry can answer.
- Lace math is deterministic and sourced. Do not change `RETAIL`, `SHELF`, `chartLength` or a model's `stock` without a source in the commit.
- Behaviour that users see (lace result, route order, re-route notice) must have a test in the matching `*.test.ts`.
- Prettier settings: single quotes, 110 columns, trailing commas. Let the formatter win.
- Saved state is versioned (`AppState.v === 2`). Changing the shape means bumping `v` and extending `normalizeState`.

## Skills

- `/add-part-calculator`: a new kind of item needs its own "what exactly do I buy" logic.
- `/refresh-store-data`: pull or update stores from OpenStreetMap or All The Places.
- `/release`: check, build, republish the artifact preview, push, deploy.

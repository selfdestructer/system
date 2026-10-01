# Today's Lists

Shopping and to-do lists that work out the exact part you need, tell you where to get it (nearby or online), and plan the shortest trip out and back home.

Today it knows shoelaces: type "Vans Old Skool white, 8 eyelets, size 10" and it answers "54″ flat" on the spot, with the reasoning and sources. New kinds of parts plug in through the calculator registry (see `src/calc/`).

**Live preview:** https://claude.ai/artifact/2vpRHGw68JBcwCwbXxWuTK (the claude.ai artifact, rebuilt from this repo).

## What it does

- **Lists by category** (laces, groceries, household, hardware, auto, pharmacy, pets, to-do) with a quick-add box under the animated header. Add "x2" for quantity.
- **Lace math**: parses model, size, eyelet count, color and lace style from what you type, asks for anything missing, and sizes it instantly. Switch to **Bulk** to queue several pairs and calculate them all at once.
- **Online or in person**: pick what you need, then either open online options for each item or tap **Find local stock** to see nearby stores ranked by distance and the odds they carry each item, with stock-check links, Maps links and phone numbers.
- **Route plan**: the shortest loop from home through your picked stores and back (exhaustive for up to 7 stops, nearest-neighbour + 2-opt above that). Each leg opens in Google Maps.
- **On the trip**: at each stop tap _Got it_ or _Not here_. A miss checks your later stops first, then adds the closest store that is roughly on the way, or lists detours.
- **Memory**: everything saves to a cookie and localStorage on the device. On claude.ai it also syncs to your account.

## Run it locally

Requirements: Node 20.19+ or 22.13+ (what Vite 8 supports) and npm. Works on Linux, macOS, Windows and in Termux on Android.

```bash
cd todays-lists
npm install
npm run dev
```

Vite prints a local URL (normally http://localhost:5173). Open it in a browser.

To use it from your phone while the dev server runs on a computer on the same Wi-Fi:

```bash
npm run dev -- --host
```

Then open the "Network" URL that Vite prints on the phone.

In Termux, run the same commands inside Termux and open http://localhost:5173 in the phone's browser.

## Build and launch the web app

```bash
npm run build        # → dist/  (static site for any HTTP host)
npm run preview      # serves dist/ locally to check the production build
npm run build:single # → dist-single/index.html, one self-contained file (the artifact preview)
```

`dist/` uses relative paths, so it runs from any folder on an HTTP host (GitHub Pages, Netlify, `npm run preview`, `npx serve dist`). It will not run opened straight from `file://`, because the module script is blocked there; `dist-single/index.html` is the one that works as a plain file. Pushing to `main` deploys `dist/` to GitHub Pages through `.github/workflows/pages.yml` once Pages is enabled for the repo (Settings → Pages → Source: GitHub Actions).

## Checks

```bash
npm run check   # typecheck + lint + prettier + tests
npm test        # vitest only
npm run format  # prettier --write
```

## Project layout

```
src/
  calc/            part calculators (what exactly to buy)
    types.ts       the PartCalculator interface
    registry.ts    category → calculator
    laces/         shoelace parsing, sizing, data, calculator, tests
  data/catalog.ts  categories, chains, seed stores, towns, home bases
  lib/
    geo.ts         distances, drive times, coordinate parsing
    links.ts       Google Maps, store stock and online links
    stores.ts      odds a store has an item; the store universe
    plan.ts        route order, store suggestions, trip re-routing
    importers.ts   Overpass / GeoJSON / All The Places import
    storage.ts     cookie + localStorage persistence
    state.ts       seed and normalize app state
  ui/              React components (App, lists, wizard, stores, map, trip)
  styles.css       the dark theme
  claude.d.ts      types for the claude.ai artifact runtime (optional at runtime)
```

## Data and limits

- Lace lengths come from measured box specs and published charts (818 Skate, Nike Help Center, Slickies, Shoe Lace Supply, DoctorLaces); each model entry in `src/calc/laces/data.ts` names its source.
- The seed store list covers Lower Bucks County, Northeast Philadelphia, Center City and nearby New Jersey (storelocators.com chain lists, Vans and Journeys locators, Sep 2026). Pins are placed at the shopping center; navigation uses the street address.
- Odds are a guess from the kind of store, not live stock. Tap an odds chip to check the store's site, or call.
- More stores: the **Import stores** panel shows a `curl` command for a free OpenStreetMap (Overpass) pull around your bases and accepts All The Places files.
- The "Ask Claude" buttons only appear on claude.ai, where the page can use the Claude runtime.

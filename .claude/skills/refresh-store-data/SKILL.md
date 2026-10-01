---
name: refresh-store-data
description: Pull or update the stores Today's Lists knows about from OpenStreetMap (Overpass) or All The Places, validate them, and update the seed list or ship an import file. Use when stores are missing, closed, mis-pinned, or the user moves to a new area.
---

# Refresh store data

The app ships a seed list (`STORE_ROWS` in `todays-lists/src/data/catalog.ts`) and can import open data at runtime (`src/lib/importers.ts`). This skill keeps both honest.

## When to use

- A store is missing, closed, or pinned in the wrong place.
- The user's home bases moved outside the seeded area (Lower Bucks, NE Philly, Center City, nearby NJ).
- The user wants more skate shops, shoe repair, or a new chain covered.

## When NOT to use

- Live stock or hours questions. The app only estimates odds; point the user at the store's site or phone.
- A single custom store the user knows: the **Add a store** panel in the app handles that without code.

## Steps

1. **Pick the source.**
   - Overpass (OpenStreetMap) for everything near a point. Build the bounding box the way `ImportPanel` does: each base ± 0.13° lat, ± 0.17° lon. Query shape (same as the app shows in Import stores):
     ```
     [out:json][timeout:120];(nwr["shop"~"^(shoes|shoe_repair|sports|outdoor|department_store|variety_store|supermarket|hardware|doityourself|car_parts|pet|convenience)$"](S,W,N,E);nwr["amenity"="pharmacy"](S,W,N,E);nwr["craft"="shoemaker"](S,W,N,E););out center tags;
     ```
     ```bash
     curl -sG https://overpass-api.de/api/interpreter --data-urlencode "data=<query>" -o stores.json
     ```
   - All The Places (https://alltheplaces.xyz/) for a chain's full, addressed locations (GeoJSON / NDJSON per brand).
2. **Validate with the importer, not by eye.** In a scratch test or node script: `importRecords(text)` then `finishImport(recs, DEFAULT_BASES)`. Check the counts, the `kind` distribution, and that chains were recognised (`kindFromTags`). Add a brand regex there if a chain came through as `other`.
3. **Decide where it lives.**
   - A handful of well-known stores the user will use often → add rows to `STORE_ROWS`. Keep the row shape `[id, chain, name, kind, street, city, st, zip, phone, lat, lon, flags?]`, ids `chain-town`, coordinates to 4 decimals, `'exact'` only when the pin is the real door. Group under the existing region comments.
   - Hundreds of stores → do not grow the bundle. Save the file (`stores.json`) and have the user import it from the **Import stores** panel; it stays on the device (and in the account on claude.ai).
4. **Fix a wrong pin.** Correct the `STORE_ROWS` entry; if the user already fixed it in-app (`fixes` in saved state) the app prefers their pin.
5. **Odds.** New chain: add it to `CHAINS` with per-category odds (0–1). New kind of shop: extend `KIND_CATS` and, for laces, `LACE_BASE` in `src/lib/stores.ts`.
6. **Tests.** Extend `src/lib/importers.test.ts` with a record shaped like the new data; if `candidates`/`suggestPicks` expectations change, update `src/lib/plan.test.ts`.
7. `npm run check`, then `/release`.

## Example

User now lives in Cherry Hill, NJ. Add a base `['Cherry Hill, NJ', 39.9348, -75.0307]` is already in `TOWNS`; run the Overpass query around it, import, note that "Shoe Dept Encore" came through as `other`, add `[/shoe dept/, 'shoe', '']` to `brandHit` in `kindFromTags`, re-run, add the three closest skate/shoe shops to `STORE_ROWS` under a new `// — Cherry Hill` comment with a `storelocators.com` phone check, add an importer test for the Shoe Dept record, `npm run check`.

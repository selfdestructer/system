---
name: add-part-calculator
description: Teach Today's Lists a new kind of part. Use when a list entry is a part for a specific thing (laces for a shoe, a filter for a car, a tube for a bike, a battery for a watch) and the app must work out the exact size, model or spec to buy. Also use for adding one more shoe model to the lace database.
---

# Add a part calculator

A calculator turns a typed list entry into the exact thing to buy, the way laces work: shoe model + size + eyelet pairs → "54″ flat". When a new kind of item lands on the list and a plain text line is not enough to shop for it, build a calculator.

## When to use

- The user adds an item that is a part for a specific thing and the right part depends on that thing (fitment, size, spec, compatibility).
- The user asks "what do I need for X" and the answer is a lookup plus a bit of math.
- A new shoe model should be sized exactly instead of by the generic eyelet chart (the short path at the end).

## When NOT to use

- The item is a plain thing with no fitment ("milk", "AA batteries", "duct tape"). It is a normal list row.
- The answer needs live data (prices, stock). Calculators are deterministic and offline.
- The user only wants a store or a route. That is already generic.

## Steps

1. **Identify the fitment inputs.** Write down what determines the right part and nothing else. For laces: model, size, eyelet pairs, lacing style, lace type, color. Rank them: which ones block an answer (eyelets), which just refine it (bow size)? These become `fields` and `missing()`.
2. **Research with sources.** Find published charts or measured specs (manufacturer help pages, measured box specs, reputable retailers). Record the source string you will put on each data row. Prefer two agreeing sources; note disagreements in a `tip`.
3. **Create `todays-lists/src/calc/<part>/`:**
   - `data.ts`: tables and model entries, each with a `src` string.
   - `index.ts`: `parse<Part>(text)` (regex over lowercase text, like `parseLace`), `calc<Part>(spec)` returning a discriminated result (`{ need: [...] }` when inputs are missing, otherwise the sized result with `why: string[]` and `src: string[]`).
   - `calculator.ts`: an object implementing `PartCalculator<Spec, Result>` from `src/calc/types.ts`.
   - `<part>.test.ts`: at least one test per published example you found, one for a missing-input case, one for the summary and search strings.
4. **Types.** Add the spec and result types to `src/types.ts`. If the item needs a new stored field, bump `AppState.v` and extend `normalizeState` in `src/lib/state.ts`.
5. **Register and wire it in.** Today the registry, `Item.lace` and `LaceWizard` are all typed to laces, so a second part needs four small edits, not just a registry line:
   - `src/calc/registry.ts`: widen the map's value type to a union (`PartCalculator<LaceSpec, LaceCalc> | PartCalculator<WiperSpec, WiperCalc>`) or a type-erased wrapper, and add the entry.
   - `src/types.ts`: add the spec field on `Item` (for example `wipers?: WiperSpec`) and a result union for `ItemView.calc`; bump `AppState.v` and extend `normalizeState`.
   - `src/ui/App.tsx`: `addItem`, `saveDraft`, `runBatch`, `editLace` and the `items` memo read and write `Item.lace`; make them pick the field by calculator id, and open the new wizard for that category instead of `LaceWizard`.
   - `src/lib/links.ts` `itemQuery` already asks the calculator for its search string, so links work once the above is in.
6. **Category.** Add the category to `CATS0` in `src/data/catalog.ts` if it does not exist, with a tone and `shop: true`.
7. **Wizard.** If the inputs fit the lace wizard pattern (a few fields, instant result), copy `LaceWizard` in `src/ui/lace.tsx` into `src/ui/<part>.tsx` and swap the fields. Keep the result panel showing `why` and `src`.
8. **Store odds.** If stores differ for this part, add a per-item odds function in `src/lib/stores.ts` (see `laceOdds`) and extend `KIND_CATS` / `CHAINS` for the new category. Add online links for it in `onlineLinks()` in `src/lib/links.ts`.
9. **Verify.** `npm run check`, then `npm run dev` and add the item by typing it the way the user would. Then `/release` to update the preview.

## Short path: one more shoe model

1. Find eyelet pairs per size and the stock lace length (manufacturer or a measured spec). Keep the source.
2. Add an entry to `MODELS` in `src/calc/laces/data.ts`: `key`, `brand`, `name`, `re` (regex on lowercase text), `profile`, `pairs(sizeM)`, `stock` (pairs → inches), `width`, `type`, `src`, optional `tip`. Use `needVans` / `needNike` when the name alone is ambiguous.
3. Add a test in `src/calc/laces/laces.test.ts`: the model parses from a natural sentence and sizes to the stock length.
4. `npm run check`.

## Example

User adds "wiper blades for 2019 Crosstrek". Fitment inputs: year, make, model, side (driver/passenger/rear). Source: manufacturer fitment chart. `src/calc/wipers/` with a table `{ 'subaru crosstrek 2018-2023': { driver: 26, passenger: 16, rear: 14 } }`, `parseWipers` reading year + model + side, `calcWipers` returning inches per side with `why` and `src`, calculator `complete()` true once year and model are known, `summary()` → "2019 Crosstrek: 26″ driver, 16″ passenger". Register under category `auto`. Online links: Amazon, Walmart, AutoZone.

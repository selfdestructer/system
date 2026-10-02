---
name: release
description: Ship Today's Lists. Use when a change is done and should reach the claude.ai artifact preview and the GitHub branch or PR. Runs the checks, builds both outputs, republishes the artifact at its existing URL, commits and pushes.
---

# Release

The artifact at https://claude.ai/artifact/2vpRHGw68JBcwCwbXxWuTK is the preview we iterate on. GitHub holds the code.

## When to use

- A feature or fix is finished and `npm run check` is green.
- The user asks to "update the preview", "publish", "push it", or "deploy".

## When NOT to use

- Work in progress. Use `npm run dev` for local iteration.
- Only docs changed and the user did not ask for a preview update: commit and push, skip the artifact.

## Steps

1. **Check.** In `todays-lists/`: `npm run check`. Fix anything red; never skip or disable a test to get green.
2. **Build both outputs.**
   ```bash
   npm run build          # dist/        (Pages / any static host)
   npm run build:single   # dist-single/index.html (artifact preview)
   ```
3. **Smoke-test `dist/`.** `npm run preview` (or Playwright against it): header animates, the four seed pairs show 36 / 54 / 36 / 36, adding "Vans Old Skool white 8 eyelets size 10" gives 54″ instantly, Find local stock lists stores, Plan route orders a loop, a reload keeps the list.
4. **Republish the artifact preview.** Publish `todays-lists/dist-single/index.html` to the existing URL above (Artifact tool, `url` set, `file_path` to that file). Omit `capabilities` so the page keeps `db`, `user` and `sample`. Open it and confirm the sync pill still reads "Synced to your account" when signed in.
5. **Commit and push.** Conventional commit message, `git push -u origin <branch>`. Open or update the PR against `main`; its CI job runs `npm run check` and a build.
6. **Tell the user** in one short message: what changed, the artifact link, the PR link, and anything not verified.

## Example

"Added the Adidas Samba model" → `npm run check` → both builds → preview shows a Samba sized 45″ → republish artifact → `git commit -m "feat(laces): add Adidas Samba (6 pairs, 45in, source: Adidas help)"` → push → PR → reply with links.

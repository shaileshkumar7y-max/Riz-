# RIZZVERSE — blank-screen repair + Phase 4

## Confirmed blank-screen cause

The published root `index.html` referenced `/src/main.ts`, which resolved at the domain root instead of the `/Riz-/` repository path. The repository also contained a flattened upload: the Svelte/TypeScript source files were at repository root, while their imports expected the `src/lib/...` tree. GitHub Pages was serving source files instead of a Vite production bundle. The screenshot's white viewport is consistent with the missing module entry.

## Repair

- Restore the original Phase 2/3 source files into the exact Vite structure (`src/`, `src/lib/`, `tests/`, `public/`).
- Make the HTML entry path relative (`./src/main.ts`) for the repository subpath.
- Add a GitHub Actions workflow that runs the check/test/build pipeline and publishes `dist/` to Pages.
- GitHub Pages source must be set to **GitHub Actions** in Settings → Pages.

## Phase 4 implementation

- New configurable conversation vibe: Balanced, Romantic, Flirty, Playful, Bold, Naughty (non-graphic), Dark humour and Supportive.
- Vibe intensity slider 0–100 and reply length setting (Short/Balanced/Detailed).
- A dedicated personality prompt composer layers character, scenario, persona, group rules, Roman Hinglish, profanity and style guidance.
- Consent and agency rules: fictional adults only, no assumed consent/relationship, respect boundaries immediately, do not control the user's actions or speak for other group members.
- Conversation quality: reduce repetitive filler, keep recent context, ask at most one useful follow-up question.
- Old Phase 2/3 IndexedDB settings and backups merge to Phase 4 defaults; the backup validator accepts old exports that predate style fields and validates new ones strictly.

## Verification

Static source checks are run locally where possible. The workflow is configured to run `npm run build` on GitHub; deployment is only live after Pages is configured to GitHub Actions and the run succeeds.

## Publishing status

The connected GitHub integration allowed repository reads but rejected both Git blob creation and Contents API writes with HTTP 403. No GitHub files were changed by this session. Apply this incremental patch to the `main` branch, then select GitHub Actions as the Pages source. The existing flattened root files are intentionally not deleted by this patch.

# RIZZVERSE V1 — Phase 1 Audit & 7-Phase Master Tracker

**Audit date:** 2 November 2026  
**Status:** Phase 1 static repository audit complete; no source repositories modified.  
**Working name:** RIZZVERSE V1 (provisional; name not yet locked).

## Product target

Android-first, mobile-friendly AI character chat and interactive story app. Primary conversation style: natural Roman Hinglish with configurable flirty, bold, romantic, playful/naughty and dark-humour personalities; optional casual profanity level. Fictional adult characters only, with clear user boundaries and safeguards. Target deployment should keep the frontend usable on free static hosting where technically possible. AI generation itself may require a compatible external provider or a local model; ₹0 and unlimited AI usage cannot be guaranteed.

## Phase 1 — Repository, license and architecture audit

### Repository A — RisuAI
- Repository: https://github.com/kwaroran/Risuai
- Default branch: `main`; repository license: GPL-3.0.
- Main stack: Svelte 5, TypeScript 5.9, Vite 8, Tailwind CSS 4; Tauri 2 support is present. The repository also has a web manifest and service worker.
- Project README describes a cross-platform AI chat/web app, mobile-friendly UI, multiple AI providers, group chat, emotion images, plugins, regex scripts, translation, lorebooks, configurable prompting, TTS, chat media and long-term memory systems.
- Source inspection found character-card import/export code, CharX handling, persona support and separated UI/TypeScript modules.
- `package.json` declares Node `^20.19.0 || >=22.12.0`, pnpm, Vite build, Svelte type checking and Vitest tests. Repository tree contains 32 test-related source files and CI workflows.
- Latest sampled commit: 30 October 2026. At audit time: about 1,765 stars and 361 forks; repository not archived.
- **Assessment:** best foundation for the mobile-first character-chat shell and shared chat engine.

### Repository B — SillyTavern
- Repository: https://github.com/SillyTavern/SillyTavern
- Default branch: `release`; inspected package version: 1.19.0; license: AGPL-3.0.
- Main stack: JavaScript/Node.js, Express server and browser UI under `public/`; Node `>=20`.
- Source tree contains character-card/CharX parsing, group chat, personas, prompt management, world-info/lorebook, extensions, mobile styles and a web manifest.
- Its root front-end includes very large `public/index.html` and `public/script.js` files. The project has a separate test tree and Playwright end-to-end tests.
- Latest sampled code commit: 14 September 2026. At audit time: about 35,214 stars and 6,634 forks; repository not archived.
- **Assessment:** valuable reference for character-card compatibility, prompt controls, group-chat behaviour and extension ideas. Do not transplant the whole UI or server into the selected base. Its normal full application needs a Node/Express server; GitHub Pages alone cannot run that server.

### Repository C — Formamorph
- Repository: https://github.com/JakeJamesDev/formamorph
- Default branch: `main`; inspected package version: 3.5.2; current repository license: PolyForm Noncommercial 1.0.0 (package metadata and README). This is a community fork of the original Formamorph by FieryLionite; do not confuse upstream-origin notices with the current fork's overall license.
- Main stack: React 19, TypeScript 6, Vite 5, Tailwind CSS/shadcn UI, Three.js/VRM avatars, Kokoro TTS and QuickJS sandboxed scripts.
- README describes a browser-first, client-side RPG/story framework: custom worlds, world editor, locations, entities, traits, stats/stat updates, lore dictionaries, OpenAI-compatible streaming endpoint, local IndexedDB saves/rollback, responsive portrait/mobile mode and optional community workshop backend. Desktop builds can run a local GGUF model; the README describes this as a desktop feature.
- The current repo includes Capacitor 8 dependencies, Android project files and `android:sync`, `android:open` and `android:run` scripts. This confirms an Android wrapper/build path exists in source; no APK was built or tested in this audit.
- `docs/WorldFormat.md` describes a versioned JSON world format. `package.json` includes build, lint, typecheck, Vitest, Playwright e2e, coverage and baseline/profiling scripts. A sizeable test/e2e tree is present.
- Latest sampled code commits: 1 November 2026. At audit time: about 20 stars and 4 forks; repository not archived.
- README explicitly says community worlds are unmoderated. The current PolyForm Noncommercial license is not a general-purpose permissive open-source license; commercial use requires a separate license. Its CLA allows the maintainer to separately license contributions; that does not change the current code license for downstream users.
- **Assessment:** strongest reference for the RPG/world-data layer and a useful Android packaging reference. For RIZZVERSE, use its product concepts and independently implement a world schema/engine unless the precise license terms and any separate permission are resolved. Do not include its full 3D avatar/TTS stack in the first mobile build by default.

## Merge decision

**Selected foundation: RisuAI.** It best matches the target's main job—mobile-first character chat—with existing character, group-chat, persona, provider, media and memory capabilities, and a modern Svelte/TypeScript structure.

**Use SillyTavern as a compatibility/reference source:** support suitable character-card formats and design equivalent prompt/persona controls, but avoid copying its large front-end/server implementation. Any direct code reuse needs an explicit AGPL compliance review.

**Use Formamorph as an RPG and Android-design reference:** use the high-level ideas (worlds, locations, entities, traits, stats, saves and lore dictionaries), define our own data model and implement within the selected architecture. Do not assume its code can be incorporated into a distributable or commercial RIZZVERSE build under the current noncommercial license.

### Duplicate-feature consolidation map

| Capability | Unified RIZZVERSE direction |
|---|---|
| Character cards | One character model plus validated import/export adapters |
| Group chat | One shared group-chat engine, not two implementations |
| Lore/world info | One keyword-triggered lore system with source, priority and token limits |
| Memory | Separate conversation summaries, character memory and story-state memory |
| Prompting/personas | One prompt pipeline with character, user persona, scene and safety layers |
| AI providers | One provider adapter layer; user-supplied keys stay local and are never embedded in public builds |
| RPG worlds | Separate versioned JSON world schema with locations, entities, stats, traits and save slots |
| Audio/images | Optional media layer; start light for Android, add heavier avatar/TTS features later |
| Plugins/extensions | One permission-aware extension interface; no arbitrary untrusted code by default |

## Phase 1 risks and controls

1. **License mixing:** GPL-3.0, AGPL-3.0 and PolyForm Noncommercial are not interchangeable. Keep provenance and notices. Review every reused file/dependency before copying; obtain legal advice before commercial distribution.
2. **Framework mismatch:** Svelte, vanilla JavaScript/HTML and React should not be pasted together. Keep one Svelte application shell and use clean TypeScript interfaces/adapters for imported data and RPG features.
3. **Hosting limits:** GitHub Pages can host static frontend files, not a Node/Express backend. Features depending on server routes, secrets or workshop services need a separate backend or must remain disabled. Static deployment of the Risu build still needs to be validated in Phase 2.
4. **API-key safety:** never commit provider keys or ship private keys through public `VITE_*` build variables. Use user-entered BYOK credentials stored locally where feasible; document CORS/provider limitations.
5. **Untrusted world data:** imported worlds, prompts, images and scripts are untrusted. Validate JSON, sanitize media/markup, enforce resource limits, and never execute arbitrary imported scripts in the main app context.
6. **Adult-content controls:** provide an 18+ entry notice, adult fictional characters only, clear user controls and boundaries. Keep public community uploads/sharing out of the first release until moderation/reporting controls exist.
7. **Android performance:** defer heavy 3D/VRM assets and large local TTS models. Prioritize text chat, compressed media, lazy loading and readable mobile layout.
8. **Data safety:** make export/backup and versioned migrations part of the design before changing storage. Never overwrite existing chats or user data during import.

## Audit limitations

This is a source-level repository audit using repository metadata, README files, manifests, package files, selected source files, directory trees, test-file listings and recent commit history. **No dependency installation, build, unit-test run, browser session, Android-device test, APK build, penetration test or full line-by-line security review was run.** Those remain explicit validation work for later phases, especially Phase 7. No source repository was changed and no code was copied.

## Fixed 7-phase delivery tracker

- [x] **Phase 1 — Baseline audit:** repositories, licenses, stacks, overlap, risks and foundation decision.
- [ ] **Phase 2 — Mobile shell + unified data system:** set up the selected app foundation, responsive navigation, storage abstraction, versioned models, backup/import/export and deployment baseline.
- [ ] **Phase 3 — Chat engine + characters + group chat:** character cards, import/export adapters, user personas, one-to-one chat, multi-character group chat and history.
- [ ] **Phase 4 — Hinglish personality engine:** Roman Hinglish controls, romantic/flirty/bold/playful/dark-humour presets, configurable profanity, prompt composition, boundaries and character consistency.
- [ ] **Phase 5 — RPG/story worlds:** versioned world JSON, world editor, locations, entities, traits, stats, safe stat rules, branching choices, checkpoints and save/rollback.
- [ ] **Phase 6 — Memory, voice, plugins and media:** lore retrieval, chat summaries, story memory, optional TTS, emotion images, audio/media and permission-aware plugins.
- [ ] **Phase 7 — Android QA, security, performance and release:** regression suite, import/export migration tests, mobile-device checks, key/privacy review, performance checks, documentation, PWA/static deployment and release package.

**Non-negotiable workflow:** do not skip phases; do not start the next phase until the current phase's deliverables and exit checks are recorded. Preserve working features and user data. Keep this file as the project checklist and update it at each phase boundary.

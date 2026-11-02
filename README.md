# RIZZVERSE — Phase 3 character chat build

Android-first, local-first character chat and interactive story studio. The Phase 3 source package builds on the Phase 2 Svelte 5 + TypeScript shell and adds character cards, portraits, direct chat, group chat, personas and an optional OpenAI-compatible browser adapter.

## Phase 3 features

- Character editor: name, tagline, description, personality instructions, scenario, first message, example dialogue, alternate greetings, tags and portrait.
- Four original local SVG starter portraits are bundled in `public/avatars/`. No upstream repository image assets are copied.
- Portrait upload: image files are resized to a 512px maximum dimension and JPEG-compressed before storage.
- Card import: RIZZVERSE JSON, Tavern/Character Card V2/V3-style JSON, and PNG files containing uncompressed `chara` or `ccv3` text metadata.
- Card export: Character Card V2-compatible JSON with RIZZVERSE extension metadata so local portrait references and adult confirmation can be retained.
- Fictional adult characters only: imported cards require a separate 18+ confirmation; explicit under-18 age metadata and common minor descriptors are rejected.
- One-to-one chats and group chats with 2–6 characters. Group members speak in saved order, and each reply is stored with its character ID/name.
- Chat history is stored in the same IndexedDB database as character cards and included in versioned backups.
- User personas can be saved and selected for new chats.
- Local preview mode works without an API key. It is explicitly labelled as sample output, not an AI model.
- Optional OpenAI-compatible API adapter. The user supplies endpoint, model and key; the key is held in memory only and is never written to IndexedDB, backups or source files.
- Existing Phase 2 preferences and backup/restore remain available.

## Run locally

Requirements: Node.js 20.19+ and npm.

```bash
npm install
npm run dev
```

Quality commands:

```bash
npm run check
npm test
npm run build
```

## AI provider setup

Open **Settings → OpenAI-compatible provider**. Add the provider base endpoint (for example `https://api.openai.com/v1`), its model name and your own key. Save preferences to retain only endpoint/model metadata. The key remains in the current tab's memory and is cleared after refresh/close. The provider must allow browser CORS requests and use HTTPS (HTTP is allowed only for localhost development). Credential-bearing, query-string and fragment URLs are rejected. A direct browser call exposes the key to that browser session; only use a provider you trust. No AI service or free unlimited inference is bundled.

Without a key the app runs local preview replies so the chat interface can be tested without implying those replies are real AI output.

## Storage and privacy

- Character cards, compressed portraits, personas, conversations, messages, worlds, saves and preferences use local IndexedDB.
- No account, backend, cloud sync or public community upload is included.
- API keys and bearer tokens are not part of settings or backup data.
- A backup includes saved character images and chat history; large portrait libraries can increase backup size.
- Import validates the card/backup data before saving. Backup restore validates the full payload before replacing local data.

## Current limits

- PNG import reads standard uncompressed `tEXt` / `iTXt` Character Card metadata; compressed PNG metadata variants are not currently decoded.
- AI requests are non-streaming in Phase 3. Streaming, richer prompt controls and advanced Hinglish personalities are Phase 4 work.
- A group send causes one provider request per character (maximum six), sequentially.
- No live AI credentials, remote image links or upstream project source files are included.
- Full dependency-backed build, Vitest suite, Android Chrome/device test and APK packaging are pending because package installation could not complete in this environment.

## Seven phases

1. Repository and license audit — complete.
2. Mobile shell and local data foundation — source created; full dependency-backed build and Android verification pending.
3. Character cards, chat engine and group chat — implementation added; full component/test/device verification pending.
4. Hinglish personality and conversation engine.
5. RPG/story worlds.
6. Memory, voice, media and plugins.
7. Android QA, security, performance and release.

## Upstream inspiration and license notes

RIZZVERSE is an independent implementation. It does not copy source files or image assets from RisuAI, SillyTavern or Formamorph. RisuAI is the mobile character-chat architecture reference; SillyTavern is the Character Card compatibility reference; Formamorph remains a story-world design reference. Their licenses remain separate and must be reviewed before any future direct code reuse.

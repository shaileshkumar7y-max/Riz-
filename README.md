# RIZZVERSE — Phase 2 Foundation

Android-first, local-first shell for a fictional adult character chat and interactive story studio. This phase establishes the UI shell, versioned TypeScript contracts, IndexedDB storage, import/export backup and a PWA offline shell.

## Current status

- [x] Mobile-first Svelte 5 + TypeScript application shell
- [x] Main navigation placeholders for Home, Characters, Worlds and Settings
- [x] Shared data contracts for characters, personas, conversations, messages, worlds and saves
- [x] IndexedDB stores and versioned database initialization
- [x] Settings persistence for Roman Hinglish / Hindi / English and profanity intensity
- [x] Versioned JSON backup export and validation-first restore
- [x] PWA manifest and service worker app-shell caching
- [x] Provider-neutral AI interface; no live AI provider or API key storage in this phase
- [x] Unit tests for backup envelope validation

## Requirements

- Node.js 20.19+ (or a compatible newer release)
- npm

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run check
npm test
npm run build
```

## Storage and privacy

- Characters, chats, worlds, saves and preferences are designed for local IndexedDB storage.
- This phase does not create a backend or send data to a server.
- API keys and bearer tokens are not part of the settings contract and must not be written to IndexedDB or backup files.
- Export a JSON backup before clearing browser storage or changing devices.
- Restores validate the full file before opening a transaction that replaces local records.

## Seven-phase roadmap

1. Repository and licensing audit — complete.
2. Mobile shell and unified data system — current phase.
3. Character cards, chat engine and group chat.
4. Hinglish personality and conversation engine.
5. RPG worlds and interactive story system.
6. Memory, voice, media and plugins.
7. Android testing, security, performance and release.

## Upstream inspiration and license notes

RIZZVERSE is a new implementation of its phase-2 foundation. It does not copy upstream source files from RisuAI, SillyTavern or Formamorph. Their feature concepts and compatibility targets are tracked separately in the project audit. Any future direct code reuse requires its own file-level license review and preserved notices.

import { describe, expect, it } from 'vitest';
import { parseCharacterCard, exportCharacterCard, validateCharacterCard, extractCharacterCardPngJson } from '../src/lib/characters/card-format';
import { STARTER_CHARACTERS } from '../src/lib/characters/starter-characters';
import { getConversationMode, makeLocalPreviewReply, resolveConversationCharacters } from '../src/lib/chat/engine';
import { parseBackup } from '../src/lib/domain/validation';
import { DEFAULT_SETTINGS, type CharacterCard, type Conversation } from '../src/lib/domain/models';
import { createOpenAICompatibleProvider } from '../src/lib/ai/openai-compatible';

const adultCard: CharacterCard = {
  id: 'adult-1', name: 'Sample', tagline: 'Sample adult', description: 'Fictional adult character',
  personalityPrompt: 'Friendly and thoughtful.', scenario: 'A café.', firstMessage: 'Hello!', tags: ['sample'],
  isAdult: true, createdAt: 1, updatedAt: 1,
};

describe('Phase 3 character cards', () => {
  it('imports a Tavern V2 card using known text fields only', () => {
    const parsed = parseCharacterCard({
      spec: 'chara_card_v2',
      data: { name: 'Rhea', description: 'A fictional character', personality: 'Clever and calm', scenario: 'At a café', first_mes: 'Hello there', tags: ['clever'] },
    });
    expect(parsed.sourceFormat).toBe('tavern-v2');
    expect(parsed.character.name).toBe('Rhea');
    expect(parsed.character.firstMessage).toBe('Hello there');
    expect(parsed.character.isAdult).toBe(false);
  });

  it('requires explicit adult confirmation before saving', () => {
    expect(() => validateCharacterCard({ ...adultCard, isAdult: false })).toThrow(/fictional adult/i);
    expect(() => validateCharacterCard(adultCard)).not.toThrow();
  });

  it('rejects cards with explicit minor age or descriptors', () => {
    expect(() => parseCharacterCard({ name: 'Unsafe', age: 17, description: 'A character', personality: '', scenario: '', first_mes: 'Hi' })).toThrow(/under 18/i);
    expect(() => parseCharacterCard({ name: 'Unsafe', description: 'A teenage girl', personality: '', scenario: '', first_mes: 'Hi' })).toThrow(/minor/i);
  });

  it('round-trips a RIZZVERSE card while retaining its local portrait reference', () => {
    const exported = { format: 'rizzverse-character', schemaVersion: 1, character: { ...adultCard, avatarUrl: 'avatars/aanya.svg' } };
    const parsed = parseCharacterCard(exported);
    expect(parsed.sourceFormat).toBe('rizzverse');
    expect(parsed.character.avatarUrl).toBe('avatars/aanya.svg');
    expect(parsed.character.isAdult).toBe(true);
  });

  it('exports a validated card in Tavern V2-compatible JSON shape', () => {
    const exported = exportCharacterCard(adultCard) as { spec: string; data: { name: string } };
    expect(exported.spec).toBe('chara_card_v2');
    expect(exported.data.name).toBe('Sample');
  });

  it('extracts the standard base64 chara text chunk from a PNG card', () => {
    const json = JSON.stringify({ spec: 'chara_card_v2', data: { name: 'PNG Character', description: '', personality: 'Curious', scenario: '', first_mes: 'Hi' } });
    const jsonBytes = new TextEncoder().encode(json);
    const encoded = btoa(Array.from(jsonBytes, (byte) => String.fromCharCode(byte)).join(''));
    const chunkData = new TextEncoder().encode(`chara\0${encoded}`);
    const chunk = new Uint8Array(12 + chunkData.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, chunkData.length, false);
    chunk.set(new TextEncoder().encode('tEXt'), 4);
    chunk.set(chunkData, 8);
    const endChunk = new Uint8Array(12);
    endChunk.set(new TextEncoder().encode('IEND'), 4);
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const png = new Uint8Array(signature.length + chunk.length + endChunk.length);
    png.set(signature, 0); png.set(chunk, signature.length); png.set(endChunk, signature.length + chunk.length);
    expect(JSON.parse(extractCharacterCardPngJson(png))).toEqual(JSON.parse(json));
  });

  it('provides local illustrated starter profiles', () => {
    expect(STARTER_CHARACTERS).toHaveLength(4);
    expect(STARTER_CHARACTERS.every((character) => character.isAdult && character.avatarUrl?.startsWith('avatars/'))).toBe(true);
  });
});

describe('Phase 3 chat engine', () => {
  const a = { ...adultCard, id: 'a', name: 'A' };
  const b = { ...adultCard, id: 'b', name: 'B' };
  const group: Conversation = { id: 'g', title: 'A + B', characterIds: ['a', 'b'], mode: 'group', createdAt: 1, updatedAt: 1 };

  it('resolves group members in their saved turn order', () => {
    expect(resolveConversationCharacters(group, [b, a]).map((character) => character.id)).toEqual(['a', 'b']);
    expect(getConversationMode(group)).toBe('group');
  });

  it('treats older multi-character records as group conversations', () => {
    expect(getConversationMode({ ...group, mode: undefined })).toBe('group');
  });

  it('returns a labelled offline preview response path', () => {
    expect(makeLocalPreviewReply(a, 'What do you think?', [])).toContain('question');
  });

  it('requires HTTPS for non-local AI endpoints and allows localhost development', () => {
    expect(() => createOpenAICompatibleProvider({ endpoint: 'http://example.com/v1', model: 'test', apiKey: 'session-key' })).toThrow(/HTTPS/i);
    expect(() => createOpenAICompatibleProvider({ endpoint: 'https://example.com/v1?token=hidden', model: 'test', apiKey: 'session-key' })).toThrow(/query strings/i);
    expect(() => createOpenAICompatibleProvider({ endpoint: 'https://example.com/v1', model: 'test', apiKey: 'session-key' })).not.toThrow();
    expect(() => createOpenAICompatibleProvider({ endpoint: 'http://localhost:1234/v1', model: 'test', apiKey: 'session-key' })).not.toThrow();
  });
});

describe('Phase 3 backup compatibility', () => {
  it('accepts a direct chat and a group chat with character-attributed replies', () => {
    const characters = [
      { ...adultCard, id: 'a', name: 'A' },
      { ...adultCard, id: 'b', name: 'B' },
    ];
    const backup = {
      format: 'rizzverse-backup', schemaVersion: 1, exportedAt: '2026-11-02T00:00:00.000Z',
      data: {
        characters, personas: [],
        conversations: [{ id: 'g', title: 'A + B', characterIds: ['a', 'b'], mode: 'group', createdAt: 1, updatedAt: 1 }],
        messages: [{ id: 'm', conversationId: 'g', role: 'assistant', content: 'Hello', status: 'complete', characterId: 'a', characterName: 'A', createdAt: 2 }],
        worlds: [], saves: [], settings: { ...DEFAULT_SETTINGS, createdAt: 1, updatedAt: 1 },
      },
    };
    expect(parseBackup(backup).data.messages).toHaveLength(1);
  });

  it('rejects a group chat with fewer than two members', () => {
    const backup = {
      format: 'rizzverse-backup', schemaVersion: 1, exportedAt: '2026-11-02T00:00:00.000Z',
      data: {
        characters: [{ ...adultCard, id: 'a' }], personas: [],
        conversations: [{ id: 'g', title: 'Broken', characterIds: ['a'], mode: 'group', createdAt: 1, updatedAt: 1 }],
        messages: [], worlds: [], saves: [], settings: { ...DEFAULT_SETTINGS, createdAt: 1, updatedAt: 1 },
      },
    };
    expect(() => parseBackup(backup)).toThrow(/invalid format/i);
  });

  it('rejects a character reply attributed to a non-participant', () => {
    const backup = {
      format: 'rizzverse-backup', schemaVersion: 1, exportedAt: '2026-11-02T00:00:00.000Z',
      data: {
        characters: [{ ...adultCard, id: 'a' }, { ...adultCard, id: 'b' }], personas: [],
        conversations: [{ id: 'g', title: 'Group', characterIds: ['a'], mode: 'direct', createdAt: 1, updatedAt: 1 }],
        messages: [{ id: 'm', conversationId: 'g', role: 'assistant', content: 'Hi', status: 'complete', characterId: 'b', createdAt: 2 }],
        worlds: [], saves: [], settings: { ...DEFAULT_SETTINGS, createdAt: 1, updatedAt: 1 },
      },
    };
    expect(() => parseBackup(backup)).toThrow(/invalid format/i);
  });
});

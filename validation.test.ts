import { describe, expect, it } from 'vitest';
import { parseBackup } from '../src/lib/domain/validation';
import { DEFAULT_SETTINGS } from '../src/lib/domain/models';

const validBackup = {
  format: 'rizzverse-backup',
  schemaVersion: 1,
  exportedAt: '2026-11-02T00:00:00.000Z',
  data: {
    characters: [], personas: [], conversations: [], messages: [], worlds: [], saves: [],
    settings: { ...DEFAULT_SETTINGS, createdAt: 1, updatedAt: 1 },
  },
};

describe('RIZZVERSE backup validation', () => {
  it('accepts a valid versioned empty backup', () => {
    expect(parseBackup(validBackup).format).toBe('rizzverse-backup');
  });

  it('rejects an unknown backup format', () => {
    expect(() => parseBackup({ ...validBackup, format: 'other-app' })).toThrow(/not a RIZZVERSE backup/i);
  });

  it('rejects an unsupported schema version', () => {
    expect(() => parseBackup({ ...validBackup, schemaVersion: 99 })).toThrow(/unsupported backup version/i);
  });

  it('rejects API secrets in provider preferences', () => {
    const unsafe = structuredClone(validBackup);
    unsafe.data.settings.provider = { providerId: 'custom', apiKey: 'must-not-be-exported' } as never;
    expect(() => parseBackup(unsafe)).toThrow(/invalid format/i);
  });

  it('rejects conversations pointing at missing characters', () => {
    const unsafe = structuredClone(validBackup);
    unsafe.data.conversations = [{ id: 'chat-1', title: 'Chat', characterIds: ['missing'], createdAt: 1, updatedAt: 1 }] as never;
    expect(() => parseBackup(unsafe)).toThrow(/invalid format/i);
  });

  it('rejects duplicate ids before restore', () => {
    const unsafe = structuredClone(validBackup);
    unsafe.data.worlds = [
      { id: 'world-1', name: 'A', description: '', author: '', tags: [], formatVersion: 1, worldData: {}, createdAt: 1, updatedAt: 1 },
      { id: 'world-1', name: 'B', description: '', author: '', tags: [], formatVersion: 1, worldData: {}, createdAt: 1, updatedAt: 1 },
    ] as never;
    expect(() => parseBackup(unsafe)).toThrow(/invalid format/i);
  });

  it('rejects malformed character records before restore', () => {
    const unsafe = structuredClone(validBackup);
    unsafe.data.characters = [{ id: 'broken', name: 'No timestamps' }] as never;
    expect(() => parseBackup(unsafe)).toThrow(/invalid format/i);
  });
});

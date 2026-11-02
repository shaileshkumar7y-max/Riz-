import { DATA_SCHEMA_VERSION, type BackupEnvelope, type BackupPayload } from '../domain/models';
import { parseBackup } from '../domain/validation';
import { getDatabase, getSettings } from './database';

export async function createBackup(): Promise<BackupEnvelope> {
  const db = await getDatabase();
  const data: BackupPayload = {
    characters: await db.getAll('characters'),
    personas: await db.getAll('personas'),
    conversations: await db.getAll('conversations'),
    messages: await db.getAll('messages'),
    worlds: await db.getAll('worlds'),
    saves: await db.getAll('saves'),
    settings: await getSettings(),
  };
  return {
    format: 'rizzverse-backup',
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Validate fully before opening the write transaction, so a bad file cannot erase existing data. */
export async function restoreBackup(input: unknown): Promise<void> {
  const backup = parseBackup(input);
  const db = await getDatabase();
  const stores = ['characters', 'personas', 'conversations', 'messages', 'worlds', 'saves', 'settings'] as const;
  const tx = db.transaction([...stores], 'readwrite');
  try {
    // Queue every clear and put in one transaction before awaiting, so the browser cannot auto-close it mid-restore.
    const clears = stores.map((name) => tx.objectStore(name).clear());
    const { data } = backup;
    const writes = [
      ...data.characters.map((entry) => tx.objectStore('characters').put(entry)),
      ...data.personas.map((entry) => tx.objectStore('personas').put(entry)),
      ...data.conversations.map((entry) => tx.objectStore('conversations').put(entry)),
      ...data.messages.map((entry) => tx.objectStore('messages').put(entry)),
      ...data.worlds.map((entry) => tx.objectStore('worlds').put(entry)),
      ...data.saves.map((entry) => tx.objectStore('saves').put(entry)),
      tx.objectStore('settings').put({ key: 'app', value: data.settings }),
    ];
    await Promise.all([...clears, ...writes]);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* transaction may already be aborted */ }
    throw error;
  }
}

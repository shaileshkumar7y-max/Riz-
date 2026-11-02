import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type AppSettings, type CharacterCard, type ChatMessage, type Conversation, type StoryWorld, type UserPersona, type WorldSave } from '../domain/models';

const DATABASE_NAME = 'rizzverse-local';
const DATABASE_VERSION = 1;

interface SettingsRow { key: 'app'; value: AppSettings }
interface RizzverseDB extends DBSchema {
  characters: { key: string; value: CharacterCard; indexes: { 'by-updated': number } };
  personas: { key: string; value: UserPersona; indexes: { 'by-updated': number } };
  conversations: { key: string; value: Conversation; indexes: { 'by-updated': number } };
  messages: { key: string; value: ChatMessage; indexes: { 'by-conversation': string; 'by-created': number } };
  worlds: { key: string; value: StoryWorld; indexes: { 'by-updated': number } };
  saves: { key: string; value: WorldSave; indexes: { 'by-world': string; 'by-updated': number } };
  settings: { key: string; value: SettingsRow };
}

let databasePromise: Promise<IDBPDatabase<RizzverseDB>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<RizzverseDB>> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('Local database is not available in this browser. Use a recent version of Chrome.'));
  }
  if (!databasePromise) {
    databasePromise = openDB<RizzverseDB>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('characters')) {
          db.createObjectStore('characters', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('personas')) {
          db.createObjectStore('personas', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('by-conversation', 'conversationId');
          store.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('worlds')) {
          db.createObjectStore('worlds', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('saves')) {
          const store = db.createObjectStore('saves', { keyPath: 'id' });
          store.createIndex('by-world', 'worldId');
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('RIZZVERSE database upgrade is blocked by another open tab. Close older RIZZVERSE tabs and retry.');
      },
      blocking(currentDb) {
        currentDb.close();
        databasePromise = undefined;
      },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.get('settings', 'app');
  if (row) return row.value;
  const now = Date.now();
  const initial = { ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now };
  await db.put('settings', { key: 'app', value: initial });
  return initial;
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  // Persist only the allow-listed preference fields. Never persist accidental token/API-key properties.
  const provider = settings.provider ? {
    providerId: settings.provider.providerId,
    ...(settings.provider.endpoint ? { endpoint: settings.provider.endpoint } : {}),
    ...(settings.provider.model ? { model: settings.provider.model } : {}),
  } : null;
  await db.put('settings', { key: 'app', value: {
    language: settings.language,
    profanity: settings.profanity,
    theme: settings.theme,
    reduceMotion: settings.reduceMotion,
    provider,
    createdAt: settings.createdAt || Date.now(),
    updatedAt: Date.now(),
  } });
}

export async function getStorageCounts() {
  const db = await getDatabase();
  const [characters, conversations, messages, worlds, saves] = await Promise.all([
    db.count('characters'), db.count('conversations'), db.count('messages'), db.count('worlds'), db.count('saves'),
  ]);
  return { characters, conversations, messages, worlds, saves };
}

export async function clearDatabaseConnectionForTests(): Promise<void> {
  if (databasePromise) (await databasePromise).close();
  databasePromise = undefined;
}

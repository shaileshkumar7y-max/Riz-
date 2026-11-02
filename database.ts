import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type CharacterCard,
  type ChatMessage,
  type Conversation,
  type StoryWorld,
  type UserPersona,
  type WorldSave,
} from '../domain/models';
import { validateCharacterCard } from '../characters/card-format';

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
  if (row) return {
    ...DEFAULT_SETTINGS,
    ...row.value,
    // Merge defaults so Phase 2/3 local data remains compatible after the Phase 4 update.
    conversationStyle: { ...DEFAULT_SETTINGS.conversationStyle, ...(row.value.conversationStyle ?? {}) },
  };
  const now = Date.now();
  const initial = { ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now };
  await db.put('settings', { key: 'app', value: initial });
  return initial;
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  // Persist only allow-listed preference fields. API keys and tokens are never written here.
  const provider = settings.provider ? {
    providerId: settings.provider.providerId,
    ...(settings.provider.endpoint ? { endpoint: settings.provider.endpoint } : {}),
    ...(settings.provider.model ? { model: settings.provider.model } : {}),
  } : null;
  await db.put('settings', { key: 'app', value: {
    language: settings.language,
    profanity: settings.profanity,
    conversationStyle: {
      tone: settings.conversationStyle.tone,
      intensity: Math.max(0, Math.min(100, Math.round(settings.conversationStyle.intensity))),
      replyLength: settings.conversationStyle.replyLength,
    },
    theme: settings.theme,
    reduceMotion: settings.reduceMotion,
    provider,
    ...(settings.defaultPersonaId ? { defaultPersonaId: settings.defaultPersonaId } : {}),
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

export async function listCharacters(): Promise<CharacterCard[]> {
  const db = await getDatabase();
  return (await db.getAllFromIndex('characters', 'by-updated')).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCharacter(id: string): Promise<CharacterCard | undefined> {
  return (await getDatabase()).get('characters', id);
}

export async function putCharacter(character: CharacterCard): Promise<void> {
  validateCharacterCard(character);
  await (await getDatabase()).put('characters', character);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['characters', 'conversations'], 'readonly');
  const [conversations] = await Promise.all([tx.objectStore('conversations').getAll(), tx.done]);
  if (conversations.some((conversation) => conversation.characterIds.includes(id))) {
    throw new Error('This character is part of an existing chat. Delete or export those chats first.');
  }
  await db.delete('characters', id);
}


export async function listPersonas(): Promise<UserPersona[]> {
  const db = await getDatabase();
  return (await db.getAllFromIndex('personas', 'by-updated')).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putPersona(persona: UserPersona): Promise<void> {
  if (!persona.name.trim() || persona.name.length > 80 || persona.description.length > 2_000) {
    throw new Error('Persona needs a name and a description under 2,000 characters.');
  }
  await (await getDatabase()).put('personas', persona);
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDatabase();
  return (await db.getAllFromIndex('conversations', 'by-updated')).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return (await getDatabase()).get('conversations', id);
}

export async function putConversation(conversation: Conversation): Promise<void> {
  if (!conversation.characterIds.length) throw new Error('A conversation needs at least one character.');
  if (new Set(conversation.characterIds).size !== conversation.characterIds.length) throw new Error('A character can only be added once to a chat.');
  const mode = conversation.mode ?? (conversation.characterIds.length > 1 ? 'group' : 'direct');
  if (mode === 'group' && (conversation.characterIds.length < 2 || conversation.characterIds.length > 6)) throw new Error('Group chat needs between two and six characters.');
  if (mode === 'direct' && conversation.characterIds.length !== 1) throw new Error('A direct chat must have exactly one character.');
  const db = await getDatabase();
  const tx = db.transaction(['characters', 'conversations', 'personas'], 'readwrite');
  const existing = await Promise.all(conversation.characterIds.map((id) => tx.objectStore('characters').get(id)));
  const persona = conversation.personaId ? await tx.objectStore('personas').get(conversation.personaId) : undefined;
  if (existing.some((character) => !character) || (conversation.personaId && !persona)) {
    tx.abort();
    throw new Error('A selected character or persona no longer exists. Refresh the library and try again.');
  }
  await tx.objectStore('conversations').put(conversation);
  await tx.done;
}

export async function putMessage(message: ChatMessage): Promise<void> {
  if (!message.content.trim()) throw new Error('Message cannot be empty.');
  if (message.content.length > 20_000) throw new Error('Message is too long (20,000 characters maximum).');
  const db = await getDatabase();
  const tx = db.transaction(['conversations', 'messages', 'characters'], 'readwrite');
  const conversation = await tx.objectStore('conversations').get(message.conversationId);
  if (!conversation) {
    tx.abort();
    throw new Error('This conversation no longer exists.');
  }
  if (message.characterId) {
    const speaker = await tx.objectStore('characters').get(message.characterId);
    if (message.role !== 'assistant' || !conversation.characterIds.includes(message.characterId) || !speaker) {
      tx.abort();
      throw new Error('This character cannot speak in the selected conversation.');
    }
    if (message.characterName && message.characterName !== speaker.name) {
      tx.abort();
      throw new Error('Character speaker name does not match the character library.');
    }
  }
  await tx.objectStore('messages').put(message);
  await tx.objectStore('conversations').put({
    ...conversation,
    updatedAt: message.createdAt,
    lastMessagePreview: message.content.slice(0, 120),
  });
  await tx.done;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDatabase();
  return (await db.getAllFromIndex('messages', 'by-conversation', conversationId)).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['conversations', 'messages'], 'readwrite');
  await tx.objectStore('conversations').delete(id);
  const messages = await tx.objectStore('messages').index('by-conversation').getAllKeys(id);
  await Promise.all(messages.map((key) => tx.objectStore('messages').delete(key)));
  await tx.done;
}

export async function clearDatabaseConnectionForTests(): Promise<void> {
  if (databasePromise) (await databasePromise).close();
  databasePromise = undefined;
}

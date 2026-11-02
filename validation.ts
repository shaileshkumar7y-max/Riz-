import { DATA_SCHEMA_VERSION, type BackupEnvelope, type BackupPayload } from './models';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hasIdAndDates = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isText(value.id) && isNumber(value.createdAt) && isNumber(value.updatedAt);
const hasIdAndCreated = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isText(value.id) && isNumber(value.createdAt);

function isCharacter(value: unknown): boolean {
  return hasIdAndDates(value) && isText(value.name) && isText(value.tagline) && isText(value.description) &&
    isText(value.personalityPrompt) && isText(value.scenario) && isText(value.firstMessage) &&
    Array.isArray(value.tags) && value.tags.every(isText) && typeof value.isAdult === 'boolean';
}
function isPersona(value: unknown): boolean {
  return hasIdAndDates(value) && isText(value.name) && isText(value.description);
}
function isConversation(value: unknown): boolean {
  return hasIdAndDates(value) && isText(value.title) && Array.isArray(value.characterIds) &&
    value.characterIds.every(isText) && (value.personaId === undefined || isText(value.personaId));
}
function isMessage(value: unknown): boolean {
  return hasIdAndCreated(value) && isText(value.conversationId) && isText(value.content) &&
    ['user', 'assistant', 'system'].includes(String(value.role)) &&
    ['complete', 'pending', 'error'].includes(String(value.status));
}
function isWorld(value: unknown): boolean {
  return hasIdAndDates(value) && isText(value.name) && isText(value.description) &&
    isText(value.author) && Array.isArray(value.tags) && value.tags.every(isText) &&
    isNumber(value.formatVersion) && isRecord(value.worldData);
}
function isSave(value: unknown): boolean {
  return hasIdAndDates(value) && isText(value.worldId) && isText(value.label) &&
    isNumber(value.revision) && isRecord(value.state);
}
function isSettings(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ('apiKey' in value || 'api_key' in value || 'token' in value || 'accessToken' in value || 'secret' in value || 'password' in value) return false;
  const provider = value.provider;
  const providerValid = provider === null || (
    isRecord(provider) && isText(provider.providerId) &&
    (provider.endpoint === undefined || isText(provider.endpoint)) &&
    (provider.model === undefined || isText(provider.model)) &&
    !('apiKey' in provider) && !('api_key' in provider) && !('token' in provider) &&
    !('accessToken' in provider) && !('secret' in provider) && !('password' in provider)
  );
  return ['hinglish', 'hindi', 'english'].includes(String(value.language)) &&
    ['off', 'light', 'medium', 'strong'].includes(String(value.profanity)) &&
    ['dark', 'system'].includes(String(value.theme)) && typeof value.reduceMotion === 'boolean' &&
    isNumber(value.createdAt) && isNumber(value.updatedAt) && providerValid;
}

export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!isRecord(value)) return false;
  const arrays: Array<[unknown, (entry: unknown) => boolean]> = [
    [value.characters, isCharacter], [value.personas, isPersona],
    [value.conversations, isConversation], [value.messages, isMessage],
    [value.worlds, isWorld], [value.saves, isSave],
  ];
  if (!arrays.every(([entries, test]) => Array.isArray(entries) && entries.every(test)) || !isSettings(value.settings)) return false;

  const characters = value.characters as Array<{ id: string }>;
  const personas = value.personas as Array<{ id: string }>;
  const conversations = value.conversations as Array<{ id: string; characterIds: string[]; personaId?: string }>;
  const messages = value.messages as Array<{ id: string; conversationId: string }>; 
  const worlds = value.worlds as Array<{ id: string }>;
  const saves = value.saves as Array<{ id: string; worldId: string }>; 
  const uniqueIds = (entries: Array<{ id: string }>) => new Set(entries.map((entry) => entry.id)).size === entries.length;
  if (![characters, personas, conversations, messages, worlds, saves].every(uniqueIds)) return false;

  const characterIds = new Set(characters.map((entry) => entry.id));
  const personaIds = new Set(personas.map((entry) => entry.id));
  const conversationIds = new Set(conversations.map((entry) => entry.id));
  const worldIds = new Set(worlds.map((entry) => entry.id));
  if (conversations.some((entry) => entry.characterIds.some((id) => !characterIds.has(id)) || (entry.personaId && !personaIds.has(entry.personaId)))) return false;
  if (messages.some((entry) => !conversationIds.has(entry.conversationId))) return false;
  if (saves.some((entry) => !worldIds.has(entry.worldId))) return false;
  return true;
}

export function parseBackup(raw: unknown): BackupEnvelope {
  if (!isRecord(raw) || raw.format !== 'rizzverse-backup') {
    throw new Error('This file is not a RIZZVERSE backup.');
  }
  if (raw.schemaVersion !== DATA_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${String(raw.schemaVersion)}.`);
  }
  if (!isText(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) {
    throw new Error('Backup date is missing or invalid.');
  }
  if (!isBackupPayload(raw.data)) {
    throw new Error('Backup data is incomplete or has an invalid format. Your current data was not changed.');
  }
  return raw as unknown as BackupEnvelope;
}

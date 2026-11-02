import { DATA_SCHEMA_VERSION, type BackupEnvelope, type BackupPayload } from './models';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const hasOnlyKeys = (value: unknown, allowed: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).every((key) => allowed.includes(key));
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hasIdAndDates = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isText(value.id) && isNumber(value.createdAt) && isNumber(value.updatedAt);
const hasIdAndCreated = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isText(value.id) && isNumber(value.createdAt);

function isCharacter(value: unknown): boolean {
  const minorText = isRecord(value) ? `${String(value.description ?? '')} ${String(value.personalityPrompt ?? '')} ${String(value.scenario ?? '')} ${String(value.firstMessage ?? '')} ${String(value.exampleMessages ?? '')}` : '';
  if (/\b(?:underage|minor character|child character|schoolgirl|schoolboy|teenage girl|teenage boy|1[0-7][ -]year[ -]old|1[0-7]\s+years?\s+old)\b/i.test(minorText)) return false;
  return hasOnlyKeys(value, ['id', 'name', 'tagline', 'description', 'personalityPrompt', 'scenario', 'firstMessage', 'exampleMessages', 'alternateGreetings', 'tags', 'avatarDataUrl', 'avatarUrl', 'isAdult', 'createdAt', 'updatedAt']) &&
    hasIdAndDates(value) && isText(value.name) && isText(value.tagline) && isText(value.description) &&
    isText(value.personalityPrompt) && isText(value.scenario) && isText(value.firstMessage) &&
    Array.isArray(value.tags) && value.tags.every(isText) && value.isAdult === true &&
    (value.exampleMessages === undefined || isText(value.exampleMessages)) &&
    (value.alternateGreetings === undefined || (Array.isArray(value.alternateGreetings) && value.alternateGreetings.every(isText) && value.alternateGreetings.length <= 12)) &&
    (value.avatarDataUrl === undefined || (isText(value.avatarDataUrl) && /^data:image\/(?:png|jpeg|webp);base64,/i.test(value.avatarDataUrl) && value.avatarDataUrl.length <= 1_500_000)) &&
    (value.avatarUrl === undefined || (isText(value.avatarUrl) && /^avatars\/[a-z0-9._-]+\.svg$/i.test(value.avatarUrl)));
}
function isPersona(value: unknown): boolean {
  return hasOnlyKeys(value, ['id', 'name', 'description', 'avatarDataUrl', 'createdAt', 'updatedAt']) &&
    hasIdAndDates(value) && isText(value.name) && isText(value.description) &&
    (value.avatarDataUrl === undefined || (isText(value.avatarDataUrl) && /^data:image\/(?:png|jpeg|webp);base64,/i.test(value.avatarDataUrl) && value.avatarDataUrl.length <= 1_500_000));
}
function isConversation(value: unknown): boolean {
  if (!hasOnlyKeys(value, ['id', 'title', 'characterIds', 'personaId', 'mode', 'createdAt', 'updatedAt', 'lastMessagePreview']) || !hasIdAndDates(value) || !isText(value.title) || !Array.isArray(value.characterIds) || !value.characterIds.every(isText)) return false;
  if (new Set(value.characterIds).size !== value.characterIds.length || value.characterIds.length < 1) return false;
  if (value.personaId !== undefined && !isText(value.personaId)) return false;
  if (value.mode !== undefined && !['direct', 'group'].includes(String(value.mode))) return false;
  if (value.mode === 'group' && (value.characterIds.length < 2 || value.characterIds.length > 6)) return false;
  if (value.mode === 'direct' && value.characterIds.length !== 1) return false;
  return true;
}
function isMessage(value: unknown): boolean {
  return hasOnlyKeys(value, ['id', 'conversationId', 'role', 'content', 'status', 'characterId', 'characterName', 'createdAt']) &&
    hasIdAndCreated(value) && isText(value.conversationId) && isText(value.content) &&
    ['user', 'assistant', 'system'].includes(String(value.role)) &&
    ['complete', 'pending', 'error'].includes(String(value.status)) &&
    (value.characterId === undefined || isText(value.characterId)) &&
    (value.characterName === undefined || isText(value.characterName));
}
function isWorld(value: unknown): boolean {
  return hasOnlyKeys(value, ['id', 'name', 'description', 'author', 'tags', 'formatVersion', 'worldData', 'createdAt', 'updatedAt']) &&
    hasIdAndDates(value) && isText(value.name) && isText(value.description) &&
    isText(value.author) && Array.isArray(value.tags) && value.tags.every(isText) &&
    isNumber(value.formatVersion) && isRecord(value.worldData);
}
function isSave(value: unknown): boolean {
  return hasOnlyKeys(value, ['id', 'worldId', 'label', 'revision', 'state', 'createdAt', 'updatedAt']) &&
    hasIdAndDates(value) && isText(value.worldId) && isText(value.label) &&
    isNumber(value.revision) && isRecord(value.state);
}
function isSettings(value: unknown): boolean {
  if (!hasOnlyKeys(value, ['language', 'profanity', 'theme', 'reduceMotion', 'provider', 'defaultPersonaId', 'createdAt', 'updatedAt'])) return false;
  const provider = value.provider;
  const providerValid = provider === null || (
    hasOnlyKeys(provider, ['providerId', 'endpoint', 'model']) && isText(provider.providerId) &&
    (provider.endpoint === undefined || isText(provider.endpoint)) &&
    (provider.model === undefined || isText(provider.model))
  );
  return ['hinglish', 'hindi', 'english'].includes(String(value.language)) &&
    ['off', 'light', 'medium', 'strong'].includes(String(value.profanity)) &&
    ['dark', 'system'].includes(String(value.theme)) && typeof value.reduceMotion === 'boolean' &&
    (value.defaultPersonaId === undefined || isText(value.defaultPersonaId)) &&
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
  const messages = value.messages as Array<{ id: string; conversationId: string; characterId?: string }>;
  const worlds = value.worlds as Array<{ id: string }>;
  const saves = value.saves as Array<{ id: string; worldId: string }>;
  const settings = value.settings as { defaultPersonaId?: string };
  const uniqueIds = (entries: Array<{ id: string }>) => new Set(entries.map((entry) => entry.id)).size === entries.length;
  if (![characters, personas, conversations, messages, worlds, saves].every(uniqueIds)) return false;

  const characterIds = new Set(characters.map((entry) => entry.id));
  const personaIds = new Set(personas.map((entry) => entry.id));
  const conversationIds = new Set(conversations.map((entry) => entry.id));
  const conversationsById = new Map(conversations.map((entry) => [entry.id, entry]));
  const worldIds = new Set(worlds.map((entry) => entry.id));
  if ((settings.defaultPersonaId && !personaIds.has(settings.defaultPersonaId)) || conversations.some((entry) => entry.characterIds.some((id) => !characterIds.has(id)) || (entry.personaId && !personaIds.has(entry.personaId)))) return false;
  if (messages.some((entry) => {
    const conversation = conversationsById.get(entry.conversationId);
    return !conversation || (entry.characterId && (!characterIds.has(entry.characterId) || !conversation.characterIds.includes(entry.characterId)));
  })) return false;
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

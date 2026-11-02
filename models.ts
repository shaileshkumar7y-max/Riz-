/** Shared RIZZVERSE data contracts. Keep these provider-neutral and versioned. */
export const DATA_SCHEMA_VERSION = 1 as const;
export type Id = string;

export type ChatRole = 'user' | 'assistant' | 'system';
export type ProfanityLevel = 'off' | 'light' | 'medium' | 'strong';
export type ChatLanguage = 'hinglish' | 'hindi' | 'english';
export type ConversationTone = 'balanced' | 'romantic' | 'flirty' | 'playful' | 'bold' | 'naughty' | 'dark-humour' | 'supportive';
export type ReplyLength = 'short' | 'balanced' | 'detailed';

export interface ConversationStyleSettings {
  tone: ConversationTone;
  intensity: number;
  replyLength: ReplyLength;
}
export type ThemeMode = 'dark' | 'system';
export type ConversationMode = 'direct' | 'group';

export interface CharacterCard {
  id: Id;
  name: string;
  tagline: string;
  description: string;
  personalityPrompt: string;
  scenario: string;
  firstMessage: string;
  exampleMessages?: string;
  alternateGreetings?: string[];
  tags: string[];
  /** Uploaded portraits are resized raster data URLs; bundled artwork uses avatarUrl. */
  avatarDataUrl?: string;
  avatarUrl?: string;
  /** RIZZVERSE chats are restricted to fictional adult characters. */
  isAdult: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserPersona {
  id: Id;
  name: string;
  description: string;
  avatarDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: Id;
  title: string;
  characterIds: Id[];
  personaId?: Id;
  /** Missing mode is treated as direct for older Phase 2 records. */
  mode?: ConversationMode;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview?: string;
}

export interface ChatMessage {
  id: Id;
  conversationId: Id;
  role: ChatRole;
  content: string;
  status: 'complete' | 'pending' | 'error';
  /** Set for character replies in direct and group chats. */
  characterId?: Id;
  characterName?: string;
  createdAt: number;
}

export interface StoryWorld {
  id: Id;
  name: string;
  description: string;
  author: string;
  tags: string[];
  formatVersion: number;
  worldData: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WorldSave {
  id: Id;
  worldId: Id;
  label: string;
  revision: number;
  state: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderPreference {
  providerId: string;
  endpoint?: string;
  model?: string;
  /** Never put API keys, bearer tokens or other secrets in this object. */
}

export interface AppSettings {
  language: ChatLanguage;
  profanity: ProfanityLevel;
  conversationStyle: ConversationStyleSettings;
  theme: ThemeMode;
  reduceMotion: boolean;
  provider: ProviderPreference | null;
  defaultPersonaId?: Id;
  createdAt: number;
  updatedAt: number;
}

export interface BackupPayload {
  characters: CharacterCard[];
  personas: UserPersona[];
  conversations: Conversation[];
  messages: ChatMessage[];
  worlds: StoryWorld[];
  saves: WorldSave[];
  settings: AppSettings;
}

export interface BackupEnvelope {
  format: 'rizzverse-backup';
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  exportedAt: string;
  data: BackupPayload;
}

export interface StorageCounts {
  characters: number;
  conversations: number;
  messages: number;
  worlds: number;
  saves: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'hinglish',
  profanity: 'medium',
  conversationStyle: { tone: 'balanced', intensity: 55, replyLength: 'balanced' },
  theme: 'dark',
  reduceMotion: false,
  provider: null,
  createdAt: 0,
  updatedAt: 0,
};

/** Shared RIZZVERSE data contracts. Keep these provider-neutral and versioned. */
export const DATA_SCHEMA_VERSION = 1 as const;
export type Id = string;

export type ChatRole = 'user' | 'assistant' | 'system';
export type ProfanityLevel = 'off' | 'light' | 'medium' | 'strong';
export type ChatLanguage = 'hinglish' | 'hindi' | 'english';
export type ThemeMode = 'dark' | 'system';

export interface CharacterCard {
  id: Id;
  name: string;
  tagline: string;
  description: string;
  personalityPrompt: string;
  scenario: string;
  firstMessage: string;
  tags: string[];
  avatarDataUrl?: string;
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
  theme: ThemeMode;
  reduceMotion: boolean;
  provider: ProviderPreference | null;
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
  theme: 'dark',
  reduceMotion: false,
  provider: null,
  createdAt: 0,
  updatedAt: 0,
};

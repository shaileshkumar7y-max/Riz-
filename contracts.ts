import type { CharacterCard, ChatMessage, Conversation, ProfanityLevel, ChatLanguage, UserPersona, ConversationStyleSettings } from '../domain/models';

export interface CompletionRequest {
  conversation: Conversation;
  character: CharacterCard;
  characters: CharacterCard[];
  persona?: UserPersona;
  history: ChatMessage[];
  userMessage: string;
  language: ChatLanguage;
  profanity: ProfanityLevel;
  style: ConversationStyleSettings;
}

export interface CompletionResult {
  content: string;
  finishReason: 'stop' | 'length' | 'provider-error';
}

/** AI integrations receive the session key at runtime; credentials are never stored on the provider object. */
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}

export interface ProviderRegistry {
  register(provider: AIProvider): void;
  get(providerId: string): AIProvider | undefined;
  list(): Array<Pick<AIProvider, 'id' | 'displayName'>>;
}

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, AIProvider>();
  return {
    register(provider) {
      if (providers.has(provider.id)) throw new Error(`Provider already registered: ${provider.id}`);
      providers.set(provider.id, provider);
    },
    get(providerId) { return providers.get(providerId); },
    list() { return Array.from(providers.values(), ({ id, displayName }) => ({ id, displayName })); },
  };
}

export type MessageRole = ChatMessage['role'];

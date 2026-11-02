import type { CharacterCard, ChatMessage, ChatRole, Conversation, ProfanityLevel, ChatLanguage } from '../domain/models';

export interface CompletionRequest {
  conversation: Conversation;
  character: CharacterCard;
  history: ChatMessage[];
  userMessage: string;
  language: ChatLanguage;
  profanity: ProfanityLevel;
}

export interface CompletionResult {
  content: string;
  finishReason: 'stop' | 'length' | 'provider-error';
}

/** AI integrations implement this contract in a later phase. Secrets must not be persisted in browser storage. */
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

export type MessageRole = ChatRole;

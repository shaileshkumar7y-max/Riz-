import type { AIProvider, CompletionRequest, CompletionResult } from './contracts';

export interface OpenAICompatibleConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

function buildSystemPrompt(request: CompletionRequest): string {
  const groupMembers = request.characters.filter((entry) => entry.id !== request.character.id).map((entry) => entry.name);
  const language = request.language === 'hinglish' ? 'Natural Roman Hinglish, typed in Latin letters' : request.language === 'hindi' ? 'Natural Hindi' : 'Natural English';
  const profanity = request.profanity === 'off' ? 'Do not use profanity.' : request.profanity === 'light' ? 'Keep profanity rare and mild.' : request.profanity === 'medium' ? 'Moderate casual profanity is allowed when contextually appropriate.' : 'Strong profanity is allowed only when contextually appropriate; never target protected groups or use threats.';
  return [
    `You are roleplaying as ${request.character.name}, a fictional adult character (18+).`,
    `Character description: ${request.character.description}`,
    `Personality: ${request.character.personalityPrompt}`,
    request.character.exampleMessages ? `Example dialogue for tone and formatting (do not copy verbatim):\n${request.character.exampleMessages}` : '',
    `Current scenario: ${request.character.scenario}`,
    request.persona ? `The user's roleplay persona is ${request.persona.name}: ${request.persona.description}` : '',
    `Write in ${language}. ${profanity}`,
    'Stay consistent with the character, respond naturally, and do not claim to be a real person.',
    'Respect user boundaries. Do not portray minors or sexualize anyone under 18. If the user changes topic, follow the conversation naturally.',
    groupMembers.length ? `This is a group chat. Other fictional adult participants: ${groupMembers.join(', ')}. Do not speak for them; only reply as ${request.character.name}.` : '',
  ].filter(Boolean).join('\n\n');
}

function getMessageText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((part) => part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text) : '').join('').trim();
  return '';
}

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): AIProvider {
  const endpoint = config.endpoint.trim().replace(/\/+$/, '');
  const model = config.model.trim();
  const key = config.apiKey.trim();
  if (!key) throw new Error('Enter an API key. It stays in memory only and is not saved.');
  if (!model) throw new Error('Enter a model name.');
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error('Provider endpoint must be a valid URL.'); }
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('Provider endpoints must use HTTPS. Plain HTTP is allowed only for localhost development.');
  }
  if (url.username || url.password || url.hash || url.search) throw new Error('Do not put credentials, query strings or fragments in the provider URL.');
  const apiUrl = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;

  return {
    id: 'openai-compatible',
    displayName: 'OpenAI-compatible API',
    async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
      const history = request.history.slice(-30).map((message) => {
        const role = message.role === 'system' ? 'system' : message.role === 'user' ? 'user' : 'assistant';
        const content = message.role === 'assistant' && message.characterName
          ? `${message.characterName}: ${message.content}`
          : message.content;
        return { role, content };
      });
      const payload = {
        model,
        temperature: 0.85,
        max_tokens: 700,
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          ...history,
        ],
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`AI provider returned ${response.status}: ${detail || response.statusText}`);
      }
      const raw: unknown = await response.json();
      if (!raw || typeof raw !== 'object') throw new Error('AI provider returned an invalid response.');
      const choices = (raw as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> }).choices;
      const content = getMessageText(choices?.[0]?.message?.content);
      if (!content) throw new Error('AI provider returned an empty response.');
      return { content: content.slice(0, 20_000), finishReason: choices?.[0]?.finish_reason === 'length' ? 'length' : 'stop' };
    },
  };
}

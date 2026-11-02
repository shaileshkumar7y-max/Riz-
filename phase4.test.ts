import { describe, expect, it } from 'vitest';
import { composePersonalityPrompt } from '../src/lib/ai/personality';
import { DEFAULT_SETTINGS, type CharacterCard } from '../src/lib/domain/models';
import type { CompletionRequest } from '../src/lib/ai/contracts';

const character: CharacterCard = {
  id: 'adult-1', name: 'Aanya', tagline: 'Quick-witted', description: 'A fictional adult illustrator.',
  personalityPrompt: 'Warm, observant and witty.', scenario: 'A rainy evening at a café.', firstMessage: 'Coffee?',
  tags: ['creative'], isAdult: true, createdAt: 1, updatedAt: 1,
};

const request: CompletionRequest = {
  conversation: { id: 'c1', title: 'Aanya', characterIds: ['adult-1'], mode: 'direct', createdAt: 1, updatedAt: 1 },
  character, characters: [character], history: [], userMessage: 'Hey, kaise ho?',
  language: 'hinglish', profanity: 'light', style: DEFAULT_SETTINGS.conversationStyle,
};

describe('Phase 4 personality composer', () => {
  it('defaults to Roman Hinglish using Latin script', () => {
    const prompt = composePersonalityPrompt(request);
    expect(prompt).toContain('Roman Hinglish');
    expect(prompt).toContain('Latin letters only');
  });

  it('supports configurable adult flirty style and intensity', () => {
    const prompt = composePersonalityPrompt({ ...request, style: { tone: 'flirty', intensity: 85, replyLength: 'short' } });
    expect(prompt).toContain('light, witty compliments');
    expect(prompt).toContain('85/100');
    expect(prompt).toContain('1–3 concise sentences');
  });

  it('keeps naughty tone non-graphic and consent-aware', () => {
    const prompt = composePersonalityPrompt({ ...request, style: { tone: 'naughty', intensity: 100, replyLength: 'balanced' } });
    expect(prompt).toContain('suggestive, non-graphic teasing');
    expect(prompt).toContain('Respect stated limits immediately');
    expect(prompt).toContain('Do not assume consent');
  });

  it('keeps group replies limited to the current character', () => {
    const second = { ...character, id: 'adult-2', name: 'Mira' };
    const prompt = composePersonalityPrompt({ ...request, character, characters: [character, second], conversation: { ...request.conversation, title: 'Aanya + Mira', characterIds: ['adult-1', 'adult-2'], mode: 'group' } });
    expect(prompt).toContain('reply only as Aanya');
    expect(prompt).toContain('do not write dialogue or actions for another participant');
  });

  it('limits profane language and forbids slurs under every setting', () => {
    const prompt = composePersonalityPrompt({ ...request, profanity: 'strong' });
    expect(prompt).toContain('Never use slurs');
    expect(prompt).toContain('targeted abuse');
  });
});

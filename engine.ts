import type { CharacterCard, ChatMessage, Conversation } from '../domain/models';

export function resolveConversationCharacters(conversation: Conversation, library: CharacterCard[]): CharacterCard[] {
  const byId = new Map(library.map((character) => [character.id, character]));
  return conversation.characterIds.map((id) => byId.get(id)).filter((value): value is CharacterCard => Boolean(value));
}

/** Deterministic offline preview. It is intentionally labelled as demo output, not an AI model. */
export function makeLocalPreviewReply(character: CharacterCard, userMessage: string, history: ChatMessage[]): string {
  const message = userMessage.trim().toLowerCase();
  const previousReplies = history.filter((item) => item.role === 'assistant' && item.characterId === character.id).length;
  if (/^(hi|hello|hey|hii|namaste|नमस्ते)\b/.test(message)) {
    return previousReplies === 0 ? character.firstMessage : `Hey! Good to see you. Batao, aaj kya chal raha hai?`;
  }
  if (message.includes('?')) return `Achha question hai. ${character.name} ke perspective se, main pehle context samajhna chahunga. Isme tumhare liye sabse important part kya hai?`;
  if (previousReplies === 0) return `Main tumhari baat sun raha/rahi hoon. ${character.name} ke saath is conversation ko aage badhate hain — thoda aur batao?`;
  return `Samajh aaya. Tumne jo point share kiya, usme ek interesting angle hai. Tum iske baare mein aur kya soch rahe ho?`;
}

export function createMessageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getConversationMode(conversation: Conversation): 'direct' | 'group' {
  return conversation.mode ?? (conversation.characterIds.length > 1 ? 'group' : 'direct');
}

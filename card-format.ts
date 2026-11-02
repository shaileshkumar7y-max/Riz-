import type { CharacterCard } from '../domain/models';

const MAX_CARD_TEXT = 18_000;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const safeTags = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
  : [];
const makeId = (): string => globalThis.crypto?.randomUUID?.() ?? `char-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export interface ParsedCharacterCard {
  character: CharacterCard;
  sourceFormat: 'rizzverse' | 'tavern-v2' | 'tavern-v3' | 'legacy' | 'unknown';
}

function checkedText(value: unknown, max = MAX_CARD_TEXT): string {
  return text(value).slice(0, max);
}

/** Converts only known fields. Imported JSON is data, never executable code. */
export function parseCharacterCard(raw: unknown, now = Date.now()): ParsedCharacterCard {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Character card JSON must contain an object.');
  const root = raw as Record<string, unknown>;
  const format = text(root.format);
  if (format === 'rizzverse-character' && root.character && typeof root.character === 'object') {
    const source = root.character as Record<string, unknown>;
    return { character: normalise(source, now), sourceFormat: 'rizzverse' };
  }

  const spec = text(root.spec);
  const isV3 = spec === 'chara_card_v3';
  const isV2 = spec === 'chara_card_v2' || (!!root.data && typeof root.data === 'object');
  const data = (isV2 || isV3) && root.data && typeof root.data === 'object'
    ? root.data as Record<string, unknown>
    : root;

  const personality = checkedText(data.personality);
  const ageValue = typeof data.age === 'number' ? data.age : typeof data.age === 'string' && /^(\d{1,3})(?:\+|\s*(?:years?|yrs?)?.*)?$/i.test(data.age.trim()) ? Number(data.age.trim().match(/^\d{1,3}/)?.[0]) : undefined;
  if (ageValue !== undefined && ageValue < 18) throw new Error('This card declares a character under 18 and cannot be imported.');
  const importedText = [data.description, data.personality, data.scenario, data.first_mes].filter((item) => typeof item === 'string').join(' ');
  if (/\b(?:underage|minor character|child character|schoolgirl|schoolboy|teenage girl|teenage boy|1[0-7][ -]year[ -]old|1[0-7]\s+years?\s+old)\b/i.test(importedText)) {
    throw new Error('This card appears to describe a minor. Only fictional adult characters (18+) are allowed.');
  }
  const systemPrompt = checkedText(data.system_prompt);
  const postHistory = checkedText(data.post_history_instructions);
  const parts = [personality, systemPrompt ? `Additional character instructions: ${systemPrompt}` : '', postHistory ? `Post-history guidance: ${postHistory}` : ''].filter(Boolean);

  const extensions = data.extensions && typeof data.extensions === 'object' ? data.extensions as Record<string, unknown> : {};
  const rizzverseExtension = extensions.rizzverse && typeof extensions.rizzverse === 'object' ? extensions.rizzverse as Record<string, unknown> : {};
  const extensionAvatar = typeof rizzverseExtension.avatarDataUrl === 'string' && rizzverseExtension.avatarDataUrl.length <= 1_500_000 && /^data:image\/(?:png|jpeg|webp);base64,/i.test(rizzverseExtension.avatarDataUrl)
    ? rizzverseExtension.avatarDataUrl
    : undefined;
  const extensionAvatarUrl = typeof rizzverseExtension.avatarUrl === 'string' && /^avatars\/[a-z0-9._-]+\.svg$/i.test(rizzverseExtension.avatarUrl)
    ? rizzverseExtension.avatarUrl
    : undefined;
  const character: CharacterCard = {
    id: typeof rizzverseExtension.id === 'string' ? rizzverseExtension.id : makeId(),
    name: checkedText(data.name, 80) || 'Imported character',
    tagline: checkedText(data.creator_notes, 180) || 'Imported character card',
    description: checkedText(data.description),
    personalityPrompt: parts.join('\n\n') || 'Describe your personality naturally and stay consistent with your character card.',
    scenario: checkedText(data.scenario),
    firstMessage: checkedText(data.first_mes) || 'Hey! Kahan se shuru karein?',
    exampleMessages: checkedText(data.mes_example),
    alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, MAX_CARD_TEXT)).slice(0, 12) : [],
    tags: safeTags(data.tags),
    ...(extensionAvatar ? { avatarDataUrl: extensionAvatar } : {}),
    ...(extensionAvatarUrl ? { avatarUrl: extensionAvatarUrl } : {}),
    isAdult: data.isAdult === true || rizzverseExtension.isAdult === true,
    createdAt: now,
    updatedAt: now,
  };
  if (!character.name) throw new Error('Character name is missing.');
  return { character, sourceFormat: isV3 ? 'tavern-v3' : isV2 ? 'tavern-v2' : Object.keys(root).length ? 'legacy' : 'unknown' };
}

function normalise(source: Record<string, unknown>, now: number): CharacterCard {
  const sourceAge = typeof source.age === 'number' ? source.age : typeof source.age === 'string' && /^\d{1,3}/.test(source.age.trim()) ? Number(source.age.trim().match(/^\d{1,3}/)?.[0]) : undefined;
  if (sourceAge !== undefined && sourceAge < 18) throw new Error('This card declares a character under 18 and cannot be imported.');
  const sourceText = [source.description, source.personalityPrompt, source.scenario, source.firstMessage, source.exampleMessages].filter((item) => typeof item === 'string').join(' ');
  if (/\b(?:underage|minor character|child character|schoolgirl|schoolboy|teenage girl|teenage boy|1[0-7][ -]year[ -]old|1[0-7]\s+years?\s+old)\b/i.test(sourceText)) {
    throw new Error('This card appears to describe a minor. Only fictional adult characters (18+) are allowed.');
  }
  const tags = safeTags(source.tags);
  const avatarDataUrl = typeof source.avatarDataUrl === 'string' && source.avatarDataUrl.length <= 1_500_000 && /^data:image\/(?:png|jpeg|webp);base64,/i.test(source.avatarDataUrl)
    ? source.avatarDataUrl
    : undefined;
  const avatarUrl = typeof source.avatarUrl === 'string' && /^avatars\/[a-z0-9._-]+\.svg$/i.test(source.avatarUrl)
    ? source.avatarUrl
    : undefined;
  return {
    id: typeof source.id === 'string' && source.id.length < 100 ? source.id : makeId(),
    name: checkedText(source.name, 80) || 'Imported character',
    tagline: checkedText(source.tagline, 180),
    description: checkedText(source.description),
    personalityPrompt: checkedText(source.personalityPrompt),
    scenario: checkedText(source.scenario),
    firstMessage: checkedText(source.firstMessage) || 'Hey! Kahan se shuru karein?',
    ...(typeof source.exampleMessages === 'string' ? { exampleMessages: checkedText(source.exampleMessages) } : {}),
    ...(Array.isArray(source.alternateGreetings) ? { alternateGreetings: source.alternateGreetings.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, MAX_CARD_TEXT)).slice(0, 12) } : {}),
    tags,
    ...(avatarDataUrl ? { avatarDataUrl } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    isAdult: source.isAdult === true,
    createdAt: Number.isFinite(source.createdAt) ? Number(source.createdAt) : now,
    updatedAt: Number.isFinite(source.updatedAt) ? Number(source.updatedAt) : now,
  };
}

export function validateCharacterCard(card: CharacterCard): void {
  if (!card.id.trim() || card.id.length > 100 || !Number.isFinite(card.createdAt) || !Number.isFinite(card.updatedAt)) throw new Error('Character id or timestamps are invalid.');
  if (!card.name.trim()) throw new Error('Character name is required.');
  if (!card.isAdult) throw new Error('Only fictional adult characters (18+) can be added. Confirm the adult-character checkbox.');
  if (/\b(?:underage|minor character|child character|schoolgirl|schoolboy|teenage girl|teenage boy|1[0-7][ -]year[ -]old|1[0-7]\s+years?\s+old)\b/i.test(`${card.description} ${card.personalityPrompt} ${card.scenario} ${card.exampleMessages || ''}`)) {
    throw new Error('This character card appears to describe a minor. Only fictional adult characters (18+) are allowed.');
  }
  if (card.name.length > 80 || card.tagline.length > 180) throw new Error('Name or tagline is too long.');
  if (card.description.length > MAX_CARD_TEXT || card.personalityPrompt.length > MAX_CARD_TEXT || card.scenario.length > MAX_CARD_TEXT || card.firstMessage.length > MAX_CARD_TEXT || (card.exampleMessages?.length ?? 0) > MAX_CARD_TEXT || (card.alternateGreetings?.length ?? 0) > 12 || (card.alternateGreetings ?? []).some((greeting) => greeting.length > MAX_CARD_TEXT)) {
    throw new Error('Character fields are too long. Keep each text field under 18,000 characters.');
  }
  if (card.tags.length > 20 || card.tags.some((tag) => tag.length > 32)) throw new Error('Use up to 20 short tags.');
  if (card.avatarDataUrl && (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(card.avatarDataUrl) || card.avatarDataUrl.length > 1_500_000)) {
    throw new Error('Portrait must be a compressed PNG, JPEG or WebP image under the size limit.');
  }
  if (card.avatarUrl && !/^avatars\/[a-z0-9._-]+\.svg$/i.test(card.avatarUrl)) throw new Error('Bundled portrait path is invalid.');
}

export function exportCharacterCard(card: CharacterCard): object {
  validateCharacterCard(card);
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: card.name,
      description: card.description,
      personality: card.personalityPrompt,
      scenario: card.scenario,
      first_mes: card.firstMessage,
      mes_example: card.exampleMessages || '',
      alternate_greetings: card.alternateGreetings || [],
      creator_notes: card.tagline,
      system_prompt: '',
      post_history_instructions: '',
      tags: card.tags,
      extensions: { rizzverse: { id: card.id, isAdult: true, avatarDataUrl: card.avatarDataUrl, avatarUrl: card.avatarUrl } },
    },
  };
}

function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Extracts common Character Card PNG tEXt/iTXt payloads without decoding the image. */
export function extractCharacterCardPngJson(bytes: Uint8Array): string {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error('This image is not a valid PNG file.');
  if (bytes.length > 12 * 1024 * 1024) throw new Error('PNG card is larger than 12 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let cardJson: string | undefined;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const chunkType = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    const end = start + length;
    if (length > 12 * 1024 * 1024 || end + 4 > bytes.length) throw new Error('PNG contains an invalid metadata chunk.');
    const chunk = bytes.subarray(start, end);
    if (chunkType === 'tEXt') {
      const split = chunk.indexOf(0);
      if (split >= 0) {
        const keyword = new TextDecoder().decode(chunk.subarray(0, split));
        const value = new TextDecoder().decode(chunk.subarray(split + 1));
        if (keyword === 'chara') cardJson = decodeBase64Utf8(value);
        if (keyword === 'ccv3') cardJson = value;
      }
    } else if (chunkType === 'iTXt') {
      const split = chunk.indexOf(0);
      if (split >= 0) {
        const keyword = new TextDecoder().decode(chunk.subarray(0, split));
        let cursor = split + 1;
        const compressed = chunk[cursor] === 1;
        cursor += 2;
        for (let field = 0; field < 2; field += 1) {
          const zero = chunk.indexOf(0, cursor);
          if (zero < 0) break;
          cursor = zero + 1;
        }
        if (!compressed && (keyword === 'chara' || keyword === 'ccv3')) {
          const value = new TextDecoder().decode(chunk.subarray(cursor));
          cardJson = keyword === 'chara' ? decodeBase64Utf8(value) : value;
        }
      }
    }
    offset = end + 4;
    if (chunkType === 'IEND') break;
  }
  if (!cardJson) throw new Error('No Character Card metadata was found in this PNG. Try a Character Card V2/V3 PNG or import a JSON card.');
  return cardJson;
}

/** Reads common Character Card PNG tEXt/iTXt metadata without trusting or executing file content. */
export async function parseCharacterPng(file: File): Promise<ParsedCharacterCard> {
  if (file.size > 12 * 1024 * 1024) throw new Error('PNG card is larger than 12 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const cardJson = extractCharacterCardPngJson(bytes);
  let raw: unknown;
  try { raw = JSON.parse(cardJson); } catch { throw new Error('Character Card metadata is not valid JSON.'); }
  const parsed = parseCharacterCard(raw);
  return { ...parsed, character: { ...parsed.character, avatarDataUrl: await compressPortrait(file) } };
}

async function compressPortrait(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process PNG portrait on this device.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 1_500_000) throw new Error('Compressed portrait is too large.');
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

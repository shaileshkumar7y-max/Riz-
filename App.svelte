<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    getSettings, getStorageCounts, putSettings, listCharacters, putCharacter, deleteCharacter,
    listConversations, putConversation, getConversation, listMessages, putMessage, deleteConversation,
    listPersonas, putPersona,
  } from './lib/storage/database';
  import { createBackup, restoreBackup } from './lib/storage/backup';
  import { DEFAULT_SETTINGS, type AppSettings, type CharacterCard, type ChatMessage, type Conversation, type StorageCounts, type UserPersona } from './lib/domain/models';
  import { parseCharacterCard, parseCharacterPng, exportCharacterCard } from './lib/characters/card-format';
  import { STARTER_CHARACTERS, copyStarterCharacter } from './lib/characters/starter-characters';
  import { portraitFileToDataUrl } from './lib/media/portrait';
  import { createOpenAICompatibleProvider } from './lib/ai/openai-compatible';
  import { createMessageId, makeLocalPreviewReply, resolveConversationCharacters, getConversationMode } from './lib/chat/engine';

  type Tab = 'home' | 'characters' | 'chats' | 'worlds' | 'settings';
  let activeTab = $state<Tab>('home');
  let settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  let counts = $state<StorageCounts>({ characters: 0, conversations: 0, messages: 0, worlds: 0, saves: 0 });
  let characters = $state<CharacterCard[]>([]);
  let conversations = $state<Conversation[]>([]);
  let personas = $state<UserPersona[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let feedback = $state('');
  let importInput: HTMLInputElement | undefined;
  let backupInput: HTMLInputElement | undefined;
  let portraitInput: HTMLInputElement | undefined;
  let messageList: HTMLDivElement | undefined;

  let editorOpen = $state(false);
  let characterDraft = $state<CharacterCard | null>(null);
  let adultConfirmed = $state(false);
  let tagText = $state('');
  let exampleMessagesText = $state('');
  let alternateGreetingsText = $state('');

  let selectedGroupIds = $state<string[]>([]);
  let chatRoomOpen = $state(false);
  let currentConversation = $state<Conversation | null>(null);
  let messages = $state<ChatMessage[]>([]);
  let draftMessage = $state('');
  let chatBusy = $state(false);
  let providerEndpoint = $state('https://api.openai.com/v1');
  let providerModel = $state('');
  let sessionApiKey = $state('');
  let personaName = $state('');
  let personaDescription = $state('');
  let selectedPersonaId = $state('');

  const tabs: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'home', icon: '⌂', label: 'Home' },
    { id: 'characters', icon: '✦', label: 'Characters' },
    { id: 'chats', icon: '▤', label: 'Chats' },
    { id: 'worlds', icon: '◈', label: 'Worlds' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  let activeChatCharacters = $derived(currentConversation ? resolveConversationCharacters(currentConversation, characters) : []);

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = settings.theme;
      document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
    }
  });

  onMount(async () => {
    try {
      settings = await getSettings();
      providerEndpoint = settings.provider?.endpoint || 'https://api.openai.com/v1';
      providerModel = settings.provider?.model || '';
      await refreshWorkspace();
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Local setup could not start.';
    } finally {
      loading = false;
    }
  });

  function newId(prefix = 'id'): string {
    return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async function refreshWorkspace() {
    const [nextCounts, nextCharacters, nextConversations, nextPersonas] = await Promise.all([
      getStorageCounts(), listCharacters(), listConversations(), listPersonas(),
    ]);
    counts = nextCounts;
    characters = nextCharacters;
    conversations = nextConversations;
    personas = nextPersonas;
    if (settings.defaultPersonaId && nextPersonas.some((persona) => persona.id === settings.defaultPersonaId)) {
      selectedPersonaId = settings.defaultPersonaId;
    } else if (!selectedPersonaId || !nextPersonas.some((persona) => persona.id === selectedPersonaId)) {
      selectedPersonaId = nextPersonas[0]?.id || '';
    }
  }

  function avatarSrc(character: CharacterCard): string {
    if (character.avatarDataUrl) return character.avatarDataUrl;
    if (character.avatarUrl) return `${import.meta.env.BASE_URL}${character.avatarUrl}`;
    return `${import.meta.env.BASE_URL}icon.svg`;
  }

  function formatTime(value: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  function formatDate(value: number): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  }

  function openEditor(character?: CharacterCard, confirmAdult = true) {
    const now = Date.now();
    characterDraft = character ? structuredClone(character) : {
      id: newId('character'), name: '', tagline: '', description: '', personalityPrompt: '', scenario: '',
      firstMessage: 'Hey! Kahan se shuru karein?', exampleMessages: '', alternateGreetings: [], tags: [], isAdult: false, createdAt: now, updatedAt: now,
    };
    adultConfirmed = character ? (confirmAdult && character.isAdult) : false;
    tagText = character?.tags.join(', ') || '';
    exampleMessagesText = character?.exampleMessages || '';
    alternateGreetingsText = character?.alternateGreetings?.join('\n') || '';
    editorOpen = true;
    feedback = '';
  }

  async function saveCharacter() {
    if (!characterDraft) return;
    saving = true;
    feedback = '';
    try {
      const card: CharacterCard = {
        ...characterDraft,
        tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
        exampleMessages: exampleMessagesText,
        alternateGreetings: alternateGreetingsText.split('\n').map((greeting) => greeting.trim()).filter(Boolean).slice(0, 12),
        isAdult: adultConfirmed,
        updatedAt: Date.now(),
      };
      await putCharacter(card);
      editorOpen = false;
      characterDraft = null;
      await refreshWorkspace();
      feedback = 'Character saved on this device.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Character could not be saved.';
    } finally {
      saving = false;
    }
  }

  async function addStarter(character: CharacterCard) {
    try {
      await putCharacter(copyStarterCharacter(character, newId('character')));
      await refreshWorkspace();
      feedback = `${character.name} added to your character library.`;
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Starter character could not be added.';
    }
  }

  async function importCharacter(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Character card file is larger than 12 MB.');
      const parsed = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        ? await parseCharacterPng(file)
        : parseCharacterCard(JSON.parse(await file.text()));
      openEditor(parsed.character, false);
      adultConfirmed = false;
      feedback = `Imported ${parsed.sourceFormat} card. Review it and confirm it is a fictional adult (18+) before saving.`;
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Character card could not be imported.';
    } finally {
      input.value = '';
    }
  }

  async function uploadPortrait(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !characterDraft) return;
    try {
      characterDraft.avatarDataUrl = await portraitFileToDataUrl(file);
      characterDraft.avatarUrl = undefined;
      feedback = 'Portrait compressed and attached to this character.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Portrait could not be added.';
    } finally {
      input.value = '';
    }
  }

  async function exportCharacter(character: CharacterCard) {
    try {
      let cardToExport = character;
      // Embed bundled starter artwork in the exported JSON so the portrait travels with the card.
      if (!character.avatarDataUrl && character.avatarUrl) {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}${character.avatarUrl}`);
          if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], `${character.name}-portrait.svg`, { type: blob.type || 'image/svg+xml' });
            const embeddedPortrait = await portraitFileToDataUrl(file);
            cardToExport = { ...character, avatarDataUrl: embeddedPortrait, avatarUrl: undefined };
          }
        } catch {
          // The packaged local path is still included if rasterizing the bundled SVG is unavailable.
        }
      }
      const payload = exportCharacterCard(cardToExport);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'character'}-character-card.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      feedback = 'Character Card V2 JSON exported with portrait metadata.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Character export failed.';
    }
  }

  async function removeCharacter(character: CharacterCard) {
    if (!window.confirm(`Delete ${character.name}? Characters used in existing chats cannot be deleted.`)) return;
    try {
      await deleteCharacter(character.id);
      await refreshWorkspace();
      feedback = `${character.name} deleted.`;
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Character could not be deleted.';
    }
  }

  function toggleGroupSelection(id: string) {
    selectedGroupIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter((entry) => entry !== id)
      : [...selectedGroupIds, id];
  }

  async function createChat(characterIds: string[]) {
    if (!characterIds.length) return;
    if (characterIds.length > 6) { feedback = 'A group can include up to six characters in this mobile build.'; return; }
    const members = characterIds.map((id) => characters.find((item) => item.id === id)).filter((item): item is CharacterCard => Boolean(item));
    if (members.length !== characterIds.length) {
      feedback = 'One selected character is missing. Refresh the library and try again.';
      return;
    }
    const now = Date.now();
    const isGroup = members.length > 1;
    const conversation: Conversation = {
      id: newId('conversation'),
      title: isGroup ? members.map((entry) => entry.name).join(' + ') : members[0].name,
      characterIds,
      ...(selectedPersonaId ? { personaId: selectedPersonaId } : {}),
      mode: isGroup ? 'group' : 'direct',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await putConversation(conversation);
      // Seed the room with each character's authored opening line.
      for (const member of members) {
        if (!member.firstMessage.trim()) continue;
        await putMessage({
          id: createMessageId(), conversationId: conversation.id, role: 'assistant', content: member.firstMessage,
          status: 'complete', characterId: member.id, characterName: member.name, createdAt: Date.now(),
        });
      }
      selectedGroupIds = [];
      await refreshWorkspace();
      await openConversation(conversation.id);
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Chat could not be created.';
    }
  }

  async function openConversation(id: string) {
    try {
      const conversation = await getConversation(id);
      if (!conversation) throw new Error('This conversation no longer exists.');
      currentConversation = conversation;
      messages = await listMessages(id);
      chatRoomOpen = true;
      activeTab = 'chats';
      feedback = '';
      await tick();
      if (messageList) messageList.scrollTop = messageList.scrollHeight;
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Chat could not be opened.';
    }
  }

  async function sendMessage() {
    const current = currentConversation;
    const content = draftMessage.trim();
    if (!current || !content || chatBusy) return;
    if (content.length > 20_000) {
      feedback = 'Message is too long. Keep it under 20,000 characters.';
      return;
    }
    const participants = resolveConversationCharacters(current, characters);
    if (!participants.length) {
      feedback = 'No character is available in this chat.';
      return;
    }
    const userMessage: ChatMessage = {
      id: createMessageId(), conversationId: current.id, role: 'user', content, status: 'complete', createdAt: Date.now(),
    };
    try {
      await putMessage(userMessage);
      messages = [...messages, userMessage];
      draftMessage = '';
      chatBusy = true;
      feedback = '';
      const realProvider = sessionApiKey.trim()
        ? createOpenAICompatibleProvider({ endpoint: providerEndpoint, model: providerModel, apiKey: sessionApiKey })
        : null;
      const persona = personas.find((item) => item.id === current.personaId);
      for (const character of participants) {
        const history = [...messages];
        let answer: string;
        if (realProvider) {
          const result = await realProvider.complete({
            conversation: current,
            character,
            characters: participants,
            ...(persona ? { persona } : {}),
            history,
            userMessage: content,
            language: settings.language,
            profanity: settings.profanity,
            style: settings.conversationStyle,
          });
          answer = result.content;
        } else {
          answer = makeLocalPreviewReply(character, content, history);
        }
        const reply: ChatMessage = {
          id: createMessageId(), conversationId: current.id, role: 'assistant', content: answer,
          status: 'complete', characterId: character.id, characterName: character.name, createdAt: Date.now(),
        };
        await putMessage(reply);
        messages = [...messages, reply];
        await tick();
        if (messageList) messageList.scrollTop = messageList.scrollHeight;
      }
      await refreshWorkspace();
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Message could not be sent.';
    } finally {
      chatBusy = false;
    }
  }

  async function removeConversation(conversation: Conversation) {
    if (!window.confirm(`Delete the chat “${conversation.title}” and its messages?`)) return;
    try {
      await deleteConversation(conversation.id);
      if (currentConversation?.id === conversation.id) {
        chatRoomOpen = false;
        currentConversation = null;
        messages = [];
      }
      await refreshWorkspace();
      feedback = 'Chat deleted.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Chat could not be deleted.';
    }
  }

  async function savePreferences() {
    saving = true;
    feedback = '';
    try {
      const provider = providerEndpoint.trim() && providerModel.trim()
        ? { providerId: 'openai-compatible', endpoint: providerEndpoint.trim(), model: providerModel.trim() }
        : null;
      settings = { ...settings, provider, ...(selectedPersonaId ? { defaultPersonaId: selectedPersonaId } : { defaultPersonaId: undefined }) };
      await putSettings(settings);
      settings = await getSettings();
      feedback = 'Preferences saved. API key is not stored; it remains only in this open tab.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Could not save preferences.';
    } finally {
      saving = false;
    }
  }

  async function savePersona() {
    const name = personaName.trim();
    if (!name) {
      feedback = 'Persona name is required.';
      return;
    }
    try {
      const persona: UserPersona = {
        id: newId('persona'), name, description: personaDescription.trim(), createdAt: Date.now(), updatedAt: Date.now(),
      };
      await putPersona(persona);
      personas = await listPersonas();
      selectedPersonaId = persona.id;
      personaName = '';
      personaDescription = '';
      feedback = 'Your chat persona has been saved.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Persona could not be saved.';
    }
  }

  async function downloadBackup() {
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rizzverse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      feedback = 'Backup exported. Keep the file somewhere safe.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Backup export failed.';
    }
  }

  async function importBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Backup is larger than 25 MB.');
      const raw: unknown = JSON.parse(await file.text());
      if (!window.confirm('Restore this backup? It will replace the data currently stored on this device.')) return;
      await restoreBackup(raw);
      settings = await getSettings();
      providerEndpoint = settings.provider?.endpoint || 'https://api.openai.com/v1';
      providerModel = settings.provider?.model || '';
      await refreshWorkspace();
      feedback = 'Backup restored successfully on this device.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Backup could not be restored.';
    } finally {
      input.value = '';
    }
  }
</script>

<svelte:head>
  <meta name="theme-color" content="#101018" />
  <meta name="description" content="RIZZVERSE — private, mobile-first character chat and story studio." />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="#home" onclick={() => { activeTab = 'home'; chatRoomOpen = false; }} aria-label="RIZZVERSE home">
      <span class="brand-mark">R</span>
      <span><strong>RIZZVERSE</strong><small>CHARACTER & STORY STUDIO</small></span>
    </a>
    <span class="local-pill"><i></i> LOCAL FIRST</span>
  </header>

  <main class="main-content">
    {#if loading}
      <section class="loading-state"><div class="spinner"></div><p>Setting up your private space…</p></section>
    {:else if activeTab === 'home'}
      <section class="hero-card">
        <div class="eyebrow">YOUR SPACE. YOUR STORIES.</div>
        <h1>Meet your cast.<br /><span>Start a conversation.</span></h1>
        <p>Create fictional adult characters, import character cards, and chat one-to-one or in a group. Your library and chat history stay on this device by default.</p>
        <div class="hero-tags"><span>Roman Hinglish</span><span>Android first</span><span>Private local storage</span></div>
      </section>

      <section class="section-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>Studio overview</h2></div><span class="phase-label">PHASE 3 · BUILD</span></section>
      <div class="stats-grid">
        <div class="stat-card"><strong>{counts.characters}</strong><span>Characters</span></div>
        <div class="stat-card"><strong>{counts.conversations}</strong><span>Chats</span></div>
        <div class="stat-card"><strong>{counts.messages}</strong><span>Messages</span></div>
      </div>
      <div class="feature-grid home-actions">
        <button class="feature-card" onclick={() => { activeTab = 'characters'; editorOpen = false; }}><span class="feature-icon purple">✦</span><span class="feature-name">Character library</span><span class="feature-desc">Create, import, edit and export cards</span><span class="feature-status">OPEN LIBRARY →</span></button>
        <button class="feature-card" onclick={() => { activeTab = 'chats'; chatRoomOpen = false; }}><span class="feature-icon amber">▤</span><span class="feature-name">Your conversations</span><span class="feature-desc">Continue direct and group chats</span><span class="feature-status">VIEW CHATS →</span></button>
      </div>
      <section class="section-heading"><div><span class="eyebrow">RECENT ACTIVITY</span><h2>Recent chats</h2></div><button class="text-button" onclick={() => activeTab = 'chats'}>See all</button></section>
      {#if conversations.length}
        <div class="conversation-list">
          {#each conversations.slice(0, 3) as conversation (conversation.id)}
            <button class="conversation-card" onclick={() => openConversation(conversation.id)}>
              <span class="conversation-icon">{getConversationMode(conversation) === 'group' ? '✥' : '✦'}</span>
              <span class="conversation-copy"><strong>{conversation.title}</strong><small>{conversation.lastMessagePreview || 'Start your conversation'}</small></span>
              <span class="conversation-date">{formatDate(conversation.updatedAt)}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="empty-inline">No chats yet. Add a character and start your first conversation.</div>
      {/if}
      <section class="notice-card"><span class="notice-icon">⌁</span><div><strong>Chat mode explained</strong><p>Without an API key the app uses clearly labelled local preview replies. Connect an OpenAI-compatible provider in Settings for actual AI responses. Keys stay in tab memory only.</p></div></section>

    {:else if activeTab === 'characters'}
      {#if editorOpen && characterDraft}
        <section class="page-heading editor-heading">
          <button class="back-button" onclick={() => { editorOpen = false; characterDraft = null; }}>← Back to library</button>
          <span class="eyebrow">CHARACTER STUDIO</span>
          <h1>{characterDraft.name ? 'Edit character' : 'Create character'}</h1>
          <p>Build the card that defines how this fictional adult character looks, speaks and behaves.</p>
        </section>
        <form class="editor-panel" onsubmit={(event) => { event.preventDefault(); void saveCharacter(); }}>
          <div class="portrait-editor">
            <img src={avatarSrc(characterDraft)} alt="Character portrait preview" />
            <div><strong>Character portrait</strong><small>Images are resized to 512px and stored on this device.</small><button type="button" class="secondary-button compact-button" onclick={() => portraitInput?.click()}>Upload portrait</button></div>
            <input bind:this={portraitInput} class="visually-hidden" type="file" accept="image/*" onchange={uploadPortrait} />
          </div>
          <label class="field-label">Character name<input bind:value={characterDraft.name} maxlength="80" required placeholder="e.g. Aanya" /></label>
          <label class="field-label">Short tagline<input bind:value={characterDraft.tagline} maxlength="180" placeholder="A quick-witted night owl" /></label>
          <label class="field-label">Description<textarea bind:value={characterDraft.description} rows="3" maxlength="18000" placeholder="Who is this character? What makes them interesting?" /></label>
          <label class="field-label">Personality instructions<textarea bind:value={characterDraft.personalityPrompt} rows="4" maxlength="18000" placeholder="Traits, speaking style, humour, habits and character consistency…" /></label>
          <label class="field-label">Scenario<textarea bind:value={characterDraft.scenario} rows="3" maxlength="18000" placeholder="Where does the conversation begin?" /></label>
          <label class="field-label">First message<textarea bind:value={characterDraft.firstMessage} rows="2" maxlength="18000" placeholder="The opening message shown when a chat starts" /></label>
          <label class="field-label">Example dialogue (optional)<textarea bind:value={exampleMessagesText} rows="3" maxlength="18000" placeholder="Show the character's usual writing style" /></label>
          <label class="field-label">Alternate greetings (one per line)<textarea bind:value={alternateGreetingsText} rows="2" maxlength="18000" placeholder="Optional alternate opening lines" /></label>
          <label class="field-label">Tags<input bind:value={tagText} placeholder="romantic, witty, mystery" /><small>Comma-separated, maximum 20 tags.</small></label>
          <label class="adult-confirm"><input type="checkbox" bind:checked={adultConfirmed} /><span><strong>18+ adult character confirmation</strong><small>I confirm this is a fictional adult character, aged 18 or older. No minors are allowed in RIZZVERSE character cards.</small></span></label>
          <div class="form-actions"><button type="button" class="secondary-button" onclick={() => { editorOpen = false; characterDraft = null; }}>Cancel</button><button type="submit" class="primary-button" disabled={saving || !adultConfirmed}>{saving ? 'Saving…' : 'Save character'}</button></div>
        </form>
      {:else}
        <section class="page-heading">
          <span class="eyebrow">YOUR CAST</span><h1>Characters</h1><p>Create original fictional adults or import compatible Tavern V2/V3 character cards, including PNG cards.</p>
        </section>
        <div class="library-actions">
          <button class="primary-button" onclick={() => openEditor()}>＋ Create character</button>
          <button class="secondary-button" onclick={() => importInput?.click()}>↑ Import card</button>
          <input bind:this={importInput} class="visually-hidden" type="file" accept="application/json,.json,image/png,.png" onchange={importCharacter} />
        </div>
        <p class="helper-line">Group chat: select 2–6 characters. Each member replies in turn when you send a message.</p>
        {#if characters.length}
          <div class="character-grid">
            {#each characters as character (character.id)}
              <article class="character-card">
                <div class="character-art"><img src={avatarSrc(character)} alt={`${character.name} portrait`} loading="lazy" /><span class="adult-chip">18+</span></div>
                <div class="character-details"><h2>{character.name}</h2><p>{character.tagline || character.description.slice(0, 95) || 'Your custom character'}</p>
                  <div class="tag-row">{#each character.tags.slice(0, 3) as tag}<span>{tag}</span>{/each}</div>
                  <div class="character-actions"><button class="primary-button" onclick={() => createChat([character.id])}>Chat</button><button class="secondary-button" onclick={() => openEditor(character)}>Edit</button><button class="icon-button" aria-label={`Export ${character.name}`} title="Export card" onclick={() => exportCharacter(character)}>↓</button></div>
                  <div class="character-footer"><label class="group-select"><input type="checkbox" checked={selectedGroupIds.includes(character.id)} disabled={selectedGroupIds.length >= 6 && !selectedGroupIds.includes(character.id)} onchange={() => toggleGroupSelection(character.id)} /> Add to group</label><button class="delete-link" onclick={() => removeCharacter(character)}>Delete</button></div>
                </div>
              </article>
            {/each}
          </div>
          {#if selectedGroupIds.length >= 2}
            <div class="group-create-bar"><span>{selectedGroupIds.length} characters selected</span><button class="primary-button" onclick={() => createChat(selectedGroupIds)}>＋ Start group chat</button></div>
          {:else if selectedGroupIds.length === 1}
            <div class="helper-line">Select at least one more character to create a group chat.</div>
          {/if}
        {:else}
          <div class="empty-card"><div class="empty-icon">✦</div><h2>Your character library is empty</h2><p>Create your first fictional adult character, import a Tavern card, or add one of the starter profiles below.</p></div>
        {/if}
        <section class="section-heading"><div><span class="eyebrow">STARTER CAST</span><h2>Try a sample character</h2></div><span class="secure-label">LOCAL ART INCLUDED</span></section>
        <div class="starter-list">
          {#each STARTER_CHARACTERS.filter((starter) => !characters.some((saved) => saved.name === starter.name && saved.tagline === starter.tagline)) as starter (starter.id)}
            <div class="starter-card"><img src={`${import.meta.env.BASE_URL}${starter.avatarUrl}`} alt={`${starter.name} illustrated avatar`} loading="lazy" /><div class="starter-copy"><strong>{starter.name}</strong><small>{starter.tagline}</small></div><button class="secondary-button compact-button" onclick={() => addStarter(starter)}>Add</button></div>
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'chats'}
      {#if chatRoomOpen && currentConversation}
        <section class="chat-heading">
          <button class="back-button" onclick={() => { chatRoomOpen = false; currentConversation = null; messages = []; }}>← All chats</button>
          <div class="chat-heading-main"><div class="chat-avatar-stack">{#each activeChatCharacters.slice(0, 3) as character (character.id)}<img src={avatarSrc(character)} alt="" />{/each}</div><div><h1>{currentConversation.title}</h1><p>{getConversationMode(currentConversation) === 'group' ? `${activeChatCharacters.length} characters · Group chat` : 'One-to-one character chat'}</p></div></div>
          {#if activeChatCharacters.length}<div class="participant-row">{#each activeChatCharacters as character (character.id)}<span>{character.name}</span>{/each}</div>{/if}
        </section>
        <div class="chat-mode-note">{#if sessionApiKey.trim()}<span class="connected-dot"></span> AI provider connected in this tab{:else}<span class="preview-dot"></span> Local preview mode · sample replies, not an AI model{/if}</div>
        <div class="message-list" bind:this={messageList} aria-live="polite">
          {#if messages.length === 0}
            <div class="chat-welcome"><span>✦</span><strong>Conversation started</strong><p>Send a message to begin. Each selected group character will take a turn.</p></div>
          {/if}
          {#each messages as message (message.id)}
            <div class:own-message={message.role === 'user'} class="message-row">
              {#if message.role === 'assistant'}
                <div class="message-avatar">{message.characterName?.slice(0, 1) || '✦'}</div>
              {/if}
              <div class="message-bubble-wrap">
                {#if message.role === 'assistant'}<span class="message-sender">{message.characterName || 'Character'}</span>{/if}
                <div class="message-bubble">{message.content}</div>
                <span class="message-time">{formatTime(message.createdAt)}</span>
              </div>
            </div>
          {/each}
          {#if chatBusy}<div class="typing-indicator"><span></span><span></span><span></span> {sessionApiKey.trim() ? 'Character is replying…' : 'Preparing preview reply…'}</div>{/if}
        </div>
        <form class="composer" onsubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <textarea bind:value={draftMessage} rows="1" maxlength="20000" placeholder="Write a message…" disabled={chatBusy} onkeydown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
          <button class="send-button" type="submit" disabled={chatBusy || !draftMessage.trim()} aria-label="Send message">➤</button>
        </form>
        <p class="composer-help">Enter to send · Shift + Enter for a new line</p>
      {:else}
        <section class="page-heading"><span class="eyebrow">YOUR CONVERSATIONS</span><h1>Chats</h1><p>Continue a previous chat or start a new one from your character library.</p></section>
        {#if conversations.length}
          <div class="conversation-list chat-history-list">
            {#each conversations as conversation (conversation.id)}
              <div class="conversation-card-wrap"><button class="conversation-card" onclick={() => openConversation(conversation.id)}><span class="conversation-icon">{getConversationMode(conversation) === 'group' ? '✥' : '✦'}</span><span class="conversation-copy"><strong>{conversation.title}</strong><small>{conversation.lastMessagePreview || 'No messages yet'}</small></span><span class="conversation-date">{formatDate(conversation.updatedAt)}</span></button><button class="delete-chat-button" title="Delete chat" aria-label={`Delete ${conversation.title}`} onclick={() => removeConversation(conversation)}>×</button></div>
            {/each}
          </div>
        {:else}
          <div class="empty-card"><div class="empty-icon">▤</div><h2>No conversations yet</h2><p>Go to Characters, add a starter profile or create your own, then tap Chat.</p><button class="primary-button" onclick={() => activeTab = 'characters'}>Open character library</button></div>
        {/if}
      {/if}

    {:else if activeTab === 'worlds'}
      <section class="page-heading"><span class="eyebrow">INTERACTIVE FICTION</span><h1>Story worlds</h1><p>World-building tools connect to the same character and conversation foundation.</p></section>
      <div class="empty-card"><div class="empty-icon amber-text">◈</div><h2>Your worlds start here</h2><p>Phase 5 will add a world editor, locations, entities, stats, branching choices and save checkpoints. Phase 3 keeps the shared character and chat system ready for that layer.</p><span class="coming-chip">PLANNED · PHASE 5</span></div>

    {:else}
      <section class="page-heading"><span class="eyebrow">PERSONALIZE</span><h1>Settings</h1><p>Set conversation defaults and connect an optional AI provider.</p></section>
      <section class="settings-panel">
        <label class="setting-row"><span><strong>Chat language</strong><small>Default response language</small></span><select bind:value={settings.language}><option value="hinglish">Roman Hinglish</option><option value="hindi">Hindi</option><option value="english">English</option></select></label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Gaali intensity</strong><small>Default vocabulary preference</small></span><select bind:value={settings.profanity}><option value="off">Off</option><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Conversation vibe</strong><small>Default character personality</small></span><select bind:value={settings.conversationStyle.tone}><option value="balanced">Balanced</option><option value="romantic">Romantic</option><option value="flirty">Flirty</option><option value="playful">Playful</option><option value="bold">Bold</option><option value="naughty">Naughty · non-graphic</option><option value="dark-humour">Dark humour</option><option value="supportive">Supportive</option></select></label>
        <div class="tone-control"><div class="tone-control-heading"><strong>Vibe intensity</strong><span>{settings.conversationStyle.intensity}%</span></div><input class="tone-range" type="range" min="0" max="100" step="5" bind:value={settings.conversationStyle.intensity} aria-label="Conversation vibe intensity" /><small>Low = subtle · High = expressive, without ignoring boundaries.</small></div>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Reply length</strong><small>How detailed should replies feel?</small></span><select bind:value={settings.conversationStyle.replyLength}><option value="short">Short</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Appearance</strong><small>Keep the interface comfortable</small></span><select bind:value={settings.theme}><option value="dark">Dark</option><option value="system">System</option></select></label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Reduce motion</strong><small>Use fewer animated effects</small></span><input class="toggle" type="checkbox" bind:checked={settings.reduceMotion} /></label>
      </section>

      <section class="section-heading"><div><span class="eyebrow">AI CONNECTION</span><h2>OpenAI-compatible provider</h2></div></section>
      <section class="provider-panel">
        <label class="field-label">API endpoint<input bind:value={providerEndpoint} placeholder="https://api.openai.com/v1" autocomplete="url" /></label>
        <label class="field-label">Model name<input bind:value={providerModel} placeholder="Enter the model name from your provider" /></label>
        <label class="field-label">API key (memory only)<input bind:value={sessionApiKey} type="password" placeholder="Paste key for this open tab only" autocomplete="off" /></label>
        <div class="provider-status">{#if sessionApiKey.trim()}<span class="connected-dot"></span> Key present in this tab{:else}<span class="preview-dot"></span> No key · local preview replies{/if}</div>
        <div class="provider-actions"><button class="secondary-button" onclick={() => sessionApiKey = ''}>Clear key</button><button class="primary-button" onclick={savePreferences} disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button></div>
        <p class="security-note">Your key is not written to IndexedDB, backups, or project files. It is cleared when this app tab is closed or refreshed. Provider endpoints must use HTTPS (HTTP only for localhost development) and allow browser CORS. Direct browser calls expose the key to this browser session; use a trusted provider only.</p>
      </section>

      <section class="section-heading"><div><span class="eyebrow">YOUR ROLEPLAY PROFILE</span><h2>User personas</h2></div></section>
      <section class="provider-panel">
        <label class="field-label">Persona name<input bind:value={personaName} placeholder="e.g. Arjun" maxlength="80" /></label>
        <label class="field-label">Persona description<textarea bind:value={personaDescription} rows="2" maxlength="2000" placeholder="How should characters understand your roleplay persona?" /></label>
        <button class="secondary-button full-button" onclick={savePersona}>＋ Save persona</button>
        {#if personas.length}
          <label class="field-label persona-select-label">Default persona for new chats<select bind:value={selectedPersonaId}><option value="">No persona</option>{#each personas as persona (persona.id)}<option value={persona.id}>{persona.name}</option>{/each}</select></label>
          <small class="security-note">The selected persona is used for new chats. Save preferences above to remember this choice on this device.</small>
        {/if}
      </section>

      <section class="section-heading backup-heading"><div><span class="eyebrow">DATA SAFETY</span><h2>Backup & restore</h2></div></section>
      <div class="backup-panel"><p>Export characters, portraits, chats, messages, personas, worlds, saves and preferences as one versioned JSON file. API keys are excluded.</p>
        <div class="backup-actions"><button class="secondary-button" onclick={downloadBackup}>↓ Export backup</button><button class="secondary-button" onclick={() => backupInput?.click()}>↑ Restore backup</button></div>
        <input bind:this={backupInput} class="visually-hidden" type="file" accept="application/json,.json" onchange={importBackup} />
        <small>Restore validates the file before replacing the local database. Keep a separate backup before restoring.</small>
      </div>
    {/if}

    {#if feedback}<div class="feedback" role="status">{feedback}</div>{/if}
  </main>

  <nav class="bottom-nav" aria-label="Main navigation">
    {#each tabs as tab (tab.id)}
      <button class:active={activeTab === tab.id} class="nav-item" onclick={() => { activeTab = tab.id; editorOpen = false; chatRoomOpen = tab.id === 'chats' ? chatRoomOpen : false; feedback = ''; }} aria-current={activeTab === tab.id ? 'page' : undefined}>
        <span class="nav-icon">{tab.icon}</span><span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

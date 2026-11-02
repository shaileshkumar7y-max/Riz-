<script lang="ts">
  import { onMount } from 'svelte';
  import { getSettings, getStorageCounts, putSettings } from './lib/storage/database';
  import { createBackup, restoreBackup } from './lib/storage/backup';
  import { DEFAULT_SETTINGS, type AppSettings, type StorageCounts } from './lib/domain/models';

  type Tab = 'home' | 'characters' | 'worlds' | 'settings';
  let activeTab = $state<Tab>('home');
  let settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  let counts = $state<StorageCounts>({ characters: 0, conversations: 0, messages: 0, worlds: 0, saves: 0 });
  let loading = $state(true);
  let saving = $state(false);
  let feedback = $state('');
  let fileInput: HTMLInputElement | undefined;

  const tabs: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'home', icon: '⌂', label: 'Home' },
    { id: 'characters', icon: '✦', label: 'Characters' },
    { id: 'worlds', icon: '◈', label: 'Worlds' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = settings.theme;
      document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
    }
  });

  onMount(async () => {
    try {
      settings = await getSettings();
      counts = await getStorageCounts();
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Local setup could not start.';
    } finally {
      loading = false;
    }
  });

  async function saveSettings() {
    saving = true;
    feedback = '';
    try {
      await putSettings(settings);
      feedback = 'Preferences saved on this device.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Could not save preferences.';
    } finally {
      saving = false;
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
      counts = await getStorageCounts();
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
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="#home" onclick={() => activeTab = 'home'} aria-label="RIZZVERSE home">
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
        <h1>Build characters.<br /><span>Make the story yours.</span></h1>
        <p>A private, phone-first studio for character chats and interactive worlds. Your library stays on this device by default.</p>
        <div class="hero-tags"><span>Hinglish ready</span><span>Android first</span><span>Local storage</span></div>
      </section>

      <section class="section-heading"><div><span class="eyebrow">WORKSPACE</span><h2>Your studio</h2></div><span class="phase-label">FOUNDATION · 02/07</span></section>
      <div class="feature-grid">
        <button class="feature-card" onclick={() => activeTab = 'characters'}>
          <span class="feature-icon purple">✦</span><span class="feature-name">Characters</span><span class="feature-desc">Create your cast and personalities</span><span class="feature-status">NEXT · PHASE 3</span>
        </button>
        <button class="feature-card" onclick={() => activeTab = 'worlds'}>
          <span class="feature-icon amber">◈</span><span class="feature-name">Story worlds</span><span class="feature-desc">Build locations, lore and game states</span><span class="feature-status">PLANNED · PHASE 5</span>
        </button>
      </div>

      <section class="section-heading"><div><span class="eyebrow">DEVICE STORAGE</span><h2>Your data</h2></div><span class="secure-label">PRIVATE BY DEFAULT</span></section>
      <div class="stats-grid">
        <div class="stat-card"><strong>{counts.characters}</strong><span>Characters</span></div>
        <div class="stat-card"><strong>{counts.conversations}</strong><span>Chats</span></div>
        <div class="stat-card"><strong>{counts.worlds}</strong><span>Worlds</span></div>
      </div>

      <section class="notice-card">
        <span class="notice-icon">⌁</span><div><strong>Foundation is ready</strong><p>Local database, settings, backup and offline app shell are wired up. AI chat and character tools come in later phases.</p></div>
      </section>
    {:else if activeTab === 'characters'}
      <section class="page-heading"><span class="eyebrow">YOUR CAST</span><h1>Characters</h1><p>Your character studio is the next build step.</p></section>
      <div class="empty-card"><div class="empty-icon">✦</div><h2>No characters yet</h2><p>Phase 3 will add character cards, portraits, personalities, import/export and group-chat setup. The database is already prepared for them.</p><span class="coming-chip">COMING IN PHASE 3</span></div>
    {:else if activeTab === 'worlds'}
      <section class="page-heading"><span class="eyebrow">INTERACTIVE FICTION</span><h1>Story worlds</h1><p>World-building tools will connect to the shared character and memory system.</p></section>
      <div class="empty-card"><div class="empty-icon amber-text">◈</div><h2>Your worlds start here</h2><p>Phase 5 will add world editor, locations, entities, stat systems, choices and save checkpoints. Storage contracts are already in place.</p><span class="coming-chip">COMING IN PHASE 5</span></div>
    {:else}
      <section class="page-heading"><span class="eyebrow">PERSONALIZE</span><h1>Settings</h1><p>Choose the default conversation style for your workspace.</p></section>
      <section class="settings-panel">
        <label class="setting-row"><span><strong>Chat language</strong><small>Default writing style for future chats</small></span>
          <select bind:value={settings.language}><option value="hinglish">Roman Hinglish</option><option value="hindi">Hindi</option><option value="english">English</option></select>
        </label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Gaali intensity</strong><small>Character vocabulary preference</small></span>
          <select bind:value={settings.profanity}><option value="off">Off</option><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong</option></select>
        </label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Appearance</strong><small>Keep the interface comfortable</small></span>
          <select bind:value={settings.theme}><option value="dark">Dark</option><option value="system">System</option></select>
        </label>
        <div class="setting-divider"></div>
        <label class="setting-row"><span><strong>Reduce motion</strong><small>Use fewer animated effects</small></span>
          <input class="toggle" type="checkbox" bind:checked={settings.reduceMotion} />
        </label>
        <button class="primary-button" onclick={saveSettings} disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button>
      </section>

      <section class="section-heading backup-heading"><div><span class="eyebrow">DATA SAFETY</span><h2>Backup & restore</h2></div></section>
      <div class="backup-panel"><p>Export characters, chats, worlds, saves and preferences as one versioned JSON file. Restore checks the file before replacing local data.</p>
        <div class="backup-actions"><button class="secondary-button" onclick={downloadBackup}>↓ Export backup</button><button class="secondary-button" onclick={() => fileInput?.click()}>↑ Restore backup</button></div>
        <input bind:this={fileInput} class="visually-hidden" type="file" accept="application/json,.json" onchange={importBackup} />
        <small>API keys and tokens are deliberately excluded from backups and local preferences.</small>
      </div>
    {/if}

    {#if feedback}
      <div class="feedback" role="status">{feedback}</div>
    {/if}
  </main>

  <nav class="bottom-nav" aria-label="Main navigation">
    {#each tabs as tab (tab.id)}
      <button class:active={activeTab === tab.id} class="nav-item" onclick={() => { activeTab = tab.id; feedback = ''; }} aria-current={activeTab === tab.id ? 'page' : undefined}>
        <span class="nav-icon">{tab.icon}</span><span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

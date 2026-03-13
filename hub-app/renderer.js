function switchSection(targetId) {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === targetId);
  });

  document.querySelectorAll('.section').forEach((section) => {
    section.classList.toggle('visible', section.id === `section-${targetId}`);
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) {
        switchSection(section);
      }
    });
  });

  document.querySelectorAll('[data-open-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.openSection;
      if (target) {
        switchSection(target);
      }
    });
  });
}

const DISCORD_URL_KEY = 'motionhub-discord-url';
const DISCORD_URL_DEFAULT = 'https://discord.gg/cdZgZZUvpW';

function getDiscordUrl() {
  try {
    const saved = localStorage.getItem(DISCORD_URL_KEY);
    return (saved && saved.trim()) || DISCORD_URL_DEFAULT;
  } catch {
    return DISCORD_URL_DEFAULT;
  }
}

function setDiscordUrl(url) {
  const u = (url && url.trim()) || DISCORD_URL_DEFAULT;
  localStorage.setItem(DISCORD_URL_KEY, u);
}

function applyDiscordLink() {
  const url = getDiscordUrl();
  document.querySelectorAll('[data-link-key="discord"]').forEach((el) => {
    el.dataset.link = url;
  });
}

function setupDiscordLinkConfig() {
  const input = document.getElementById('discord-url-input');
  const saveBtn = document.getElementById('discord-url-save');
  if (input) input.value = getDiscordUrl();
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const url = (input && input.value && input.value.trim()) || DISCORD_URL_DEFAULT;
      setDiscordUrl(url);
      applyDiscordLink();
      if (input) input.value = getDiscordUrl();
    });
  }
}

function setupCheckForUpdates() {
  const btn = document.getElementById('check-for-updates-btn');
  if (!btn) return;
  const ipc = getIpc();
  if (!ipc || typeof ipc.invoke !== 'function') return;
  ipc.invoke('app:getUpdateUrl').then((url) => {
    if (url && url.trim()) {
      btn.style.display = '';
      btn.addEventListener('click', () => { ipc.invoke('app:openUpdateUrl'); });
    }
  }).catch(() => {});
}

function setupTournamentApp() {
  const pathInput = document.getElementById('tournament-app-path');
  const browseBtn = document.getElementById('tournament-browse-btn');
  const saveBtn = document.getElementById('tournament-save-path-btn');
  const launchBtn = document.getElementById('tournament-launch-btn');
  const statusEl = document.getElementById('tournament-status');
  const ipc = getIpc();
  if (!ipc || !pathInput) return;

  function setStatus(msg, isError) {
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.style.color = isError ? '#f87171' : '';
    }
  }

  ipc.invoke('app:getTournamentAppPath').then((p) => {
    if (pathInput) pathInput.value = p || '';
  }).catch(() => {});

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const value = pathInput.value.trim();
      await ipc.invoke('app:setTournamentAppPath', value);
      setStatus(value ? 'Path saved.' : 'Path cleared.');
    });
  }
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      const chosen = await ipc.invoke('app:pickTournamentAppPath');
      if (chosen) {
        pathInput.value = chosen;
        await ipc.invoke('app:setTournamentAppPath', chosen);
        setStatus('Path saved.');
      }
    });
  }
  if (launchBtn) {
    launchBtn.addEventListener('click', async () => {
      setStatus('Launching…');
      try {
        await ipc.invoke('app:launchTournamentApp');
        setStatus('Tournament app started.');
      } catch (e) {
        setStatus(e.message || 'Failed to launch.', true);
      }
    });
  }

  // Discord Bot (Master only — UI is .master-only)
  const botPathInput = document.getElementById('tournament-bot-path');
  const botBrowseBtn = document.getElementById('tournament-bot-browse-btn');
  const botSaveBtn = document.getElementById('tournament-bot-save-btn');
  const botStartBtn = document.getElementById('tournament-bot-start-btn');
  const botStatusEl = document.getElementById('tournament-bot-status');
  if (botPathInput) {
    ipc.invoke('app:getBotPath').then((p) => { botPathInput.value = p || ''; }).catch(() => {});
    function setBotStatus(msg, isError) {
      if (botStatusEl) { botStatusEl.textContent = msg || ''; botStatusEl.style.color = isError ? '#f87171' : ''; }
    }
    if (botSaveBtn) botSaveBtn.addEventListener('click', async () => {
      const value = botPathInput.value.trim();
      await ipc.invoke('app:setBotPath', value);
      setBotStatus(value ? 'Path saved.' : 'Path cleared.');
    });
    if (botBrowseBtn) botBrowseBtn.addEventListener('click', async () => {
      const chosen = await ipc.invoke('app:pickBotFolder');
      if (chosen) { botPathInput.value = chosen; await ipc.invoke('app:setBotPath', chosen); setBotStatus('Path saved.'); }
    });
    if (botStartBtn) botStartBtn.addEventListener('click', async () => {
      setBotStatus('Starting bot…');
      try {
        await ipc.invoke('app:launchBot');
        setBotStatus('Bot started. Keep this PC on for it to stay online.');
      } catch (e) {
        setBotStatus(e.message || 'Failed to start.', true);
      }
    });
  }
}

function setupExternalLinks() {
  let shell;
  try {
    // Available because nodeIntegration is enabled for this trusted app
    // eslint-disable-next-line global-require
    shell = require('electron').shell;
  } catch {
    shell = null;
  }

  applyDiscordLink();

  document.querySelectorAll('[data-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.link;
      if (url) {
        if (shell && typeof shell.openExternal === 'function') {
          shell.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      }
    });
  });
}

function loadNotes() {
  try {
    const raw = localStorage.getItem('motionhub-notes');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem('motionhub-notes', JSON.stringify(notes));
}

function renderNotes() {
  const list = document.getElementById('notes-items');
  if (!list) return;

  const notes = loadNotes();
  list.innerHTML = '';

  if (!notes.length) {
    const empty = document.createElement('li');
    empty.className = 'note-item';
    empty.textContent = 'No notes saved on this device yet.';
    list.appendChild(empty);
    return;
  }

  notes
    .slice()
    .reverse()
    .forEach((note) => {
      const li = document.createElement('li');
      li.className = 'note-item';

      const topic = document.createElement('div');
      topic.className = 'note-topic';
      topic.textContent = note.topic || 'Untitled';

      const body = document.createElement('div');
      body.className = 'note-body';
      body.textContent = note.body || '';

      const meta = document.createElement('div');
      meta.className = 'note-meta';
      meta.textContent = new Date(note.createdAt).toLocaleString();

      li.appendChild(topic);
      li.appendChild(body);
      li.appendChild(meta);
      list.appendChild(li);
    });
}

function setupNotesForm() {
  const form = document.getElementById('notes-form');
  const status = document.getElementById('notes-status');
  const syncUrlInput = document.getElementById('notes-sync-url');
  const syncUrlSave = document.getElementById('notes-sync-save');
  const loadSyncedBtn = document.getElementById('notes-load-synced');
  const syncedList = document.getElementById('notes-synced-items');
  if (!form) return;

  const ipc = getIpc();
  if (ipc) {
    ipc.invoke('notes:getSyncUrl').then((url) => {
      if (syncUrlInput) syncUrlInput.value = url || '';
    }).catch(() => {});
    if (syncUrlSave && syncUrlInput) {
      syncUrlSave.addEventListener('click', async () => {
        await ipc.invoke('notes:setSyncUrl', syncUrlInput.value);
        if (status) status.textContent = 'Sync URL saved.';
      });
    }
    if (loadSyncedBtn && syncedList) {
      loadSyncedBtn.addEventListener('click', async () => {
        syncedList.innerHTML = '<li class="note-item">Loading…</li>';
        const result = await ipc.invoke('notes:fetch');
        syncedList.innerHTML = '';
        if (!result.ok) {
          const li = document.createElement('li');
          li.className = 'note-item';
          li.textContent = result.error || 'Failed to load synced notes.';
          syncedList.appendChild(li);
          return;
        }
        if (!result.notes || result.notes.length === 0) {
          const li = document.createElement('li');
          li.className = 'note-item';
          li.textContent = 'No synced notes yet.';
          syncedList.appendChild(li);
          return;
        }
        result.notes.slice().reverse().forEach((note) => {
          const li = document.createElement('li');
          li.className = 'note-item';
          const topic = document.createElement('div');
          topic.className = 'note-topic';
          topic.textContent = note.topic || 'Untitled';
          const body = document.createElement('div');
          body.className = 'note-body';
          body.textContent = note.body || '';
          const meta = document.createElement('div');
          meta.className = 'note-meta';
          meta.textContent = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';
          li.appendChild(topic);
          li.appendChild(body);
          li.appendChild(meta);
          syncedList.appendChild(li);
        });
      });
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const topic = (data.get('topic') || '').toString().trim();
    const body = (data.get('body') || '').toString().trim();

    if (!topic || !body) {
      if (status) status.textContent = 'Please fill out both fields.';
      return;
    }

    const note = {
      id: Date.now(),
      topic,
      body,
      createdAt: new Date().toISOString(),
    };
    const notes = loadNotes();
    notes.push(note);
    saveNotes(notes);
    renderNotes();
    form.reset();

    if (ipc) {
      const syncUrl = await ipc.invoke('notes:getSyncUrl');
      if (syncUrl) {
        const result = await ipc.invoke('notes:submit', { topic, body, createdAt: note.createdAt });
        if (status) {
          status.textContent = result.ok
            ? 'Note saved and synced to the team.'
            : 'Note saved locally. Sync failed: ' + (result.error || 'unknown');
        }
      } else {
        if (status) status.textContent = 'Note saved on this device. Set a sync URL to send to the team.';
      }
    } else {
      if (status) status.textContent = 'Note saved on this device.';
    }
  });

  renderNotes();
}

function getIpc() {
  try {
    return require('electron').ipcRenderer;
  } catch {
    return null;
  }
}

function setupRulesEditor() {
  const tabPreview = document.querySelector('.rules-tab[data-rules-tab="preview"]');
  const tabSource = document.querySelector('.rules-tab[data-rules-tab="source"]');
  const panePreview = document.getElementById('rules-preview-pane');
  const paneSource = document.getElementById('rules-source-pane');
  const loadBtn = document.getElementById('rules-load-btn');
  const publishBtn = document.getElementById('rules-publish-btn');
  const rollbackBtn = document.getElementById('rules-rollback-btn');
  const editor = document.getElementById('rules-source-editor');
  const statusEl = document.getElementById('rules-editor-status');
  const modal = document.getElementById('rules-rollback-modal');
  const commitList = document.getElementById('rules-commit-list');
  const rollbackCancel = document.getElementById('rules-rollback-cancel');

  let currentSha = null;

  function closeRollbackModal() {
    if (modal) modal.hidden = true;
  }

  if (modal) modal.hidden = true;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#f87171' : '';
  }

  const paneEasy = document.getElementById('rules-easy-pane');

  function switchRulesTab(tab) {
    document.querySelectorAll('.rules-tab').forEach((b) => b.classList.toggle('active', b.dataset.rulesTab === tab));
    panePreview.classList.toggle('visible', tab === 'preview');
    if (paneEasy) {
      paneEasy.classList.toggle('visible', tab === 'easy');
      if (tab === 'easy' && !_rulesState.model && RulesEditorAPI) {
        _rulesState = { model: RulesEditorAPI.defaultModel(), fullHtml: '', replaceStart: 0, replaceEnd: 0, heroStart: null, heroEnd: null };
        _rulesEasyDirty = false;
        renderStructuredEditor(_rulesState.model);
      }
    }
    paneSource.classList.toggle('visible', tab === 'source');
  }

  document.querySelectorAll('.rules-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchRulesTab(btn.dataset.rulesTab));
  });

  loadBtn.addEventListener('click', async () => {
    const ipc = getIpc();
    if (!ipc) {
      setStatus('Not available in this context.', true);
      return;
    }
    setStatus('Loading…');
    try {
      const { content, sha } = await ipc.invoke('github:getRulesFile');
      editor.value = content;
      currentSha = sha;
      setStatus('Loaded from GitHub. Edit and click Publish to push changes.');
    } catch (err) {
      setStatus(err.message || 'Failed to load', true);
      currentSha = null;
    }
  });

  publishBtn.addEventListener('click', async () => {
    const ipc = getIpc();
    if (!ipc) {
      setStatus('Not available.', true);
      return;
    }
    const content = editor.value.trim();
    if (!content) {
      setStatus('Load content first, then edit and Publish.', true);
      return;
    }
    setStatus('Publishing…');
    try {
      await ipc.invoke('github:putRulesFile', {
        content,
        message: 'Update rules from Motion Hub',
        sha: currentSha,
      });
      const { sha } = await ipc.invoke('github:getRulesFile');
      currentSha = sha;
      setStatus('Published. Live site may take a minute to update.');
    } catch (err) {
      setStatus(err.message || 'Publish failed', true);
    }
  });

  if (rollbackBtn) {
    rollbackBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return;
      setStatus('Loading commits…');
      try {
        const commits = await ipc.invoke('github:getRulesCommits');
        if (commitList) commitList.innerHTML = '';
        commits.forEach((c) => {
          const li = document.createElement('li');
          li.dataset.sha = c.sha;
          li.innerHTML = `<div class="commit-msg">${escapeHtml(c.message || '(no message)')}</div><div class="commit-meta">${c.date ? new Date(c.date).toLocaleString() : ''} ${c.author ? ' · ' + escapeHtml(c.author) : ''}</div>`;
          li.addEventListener('click', async () => {
            setStatus('Loading version…');
            try {
              const content = await ipc.invoke('github:getRulesFileAtRef', c.sha);
              editor.value = content;
              currentSha = null;
              setStatus('Loaded that version. Click Publish to make it live.');
              closeRollbackModal();
            } catch (e) {
              setStatus(e.message || 'Failed to load version', true);
            }
          });
          if (commitList) commitList.appendChild(li);
        });
        if (modal) modal.hidden = false;
        setStatus('');
      } catch (err) {
        setStatus(err.message || 'Failed to load commits', true);
      }
    });
  }

  if (rollbackCancel) {
    rollbackCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRollbackModal();
    });
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeRollbackModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeRollbackModal();
    });
  }
  const modalContent = modal && modal.querySelector('.rules-modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => e.stopPropagation());
  }

  // —— Easy Edit: structured rules editor (form-like, drag, add/delete, bold+red+green, staff images) ———
  let _rulesState = { model: null, fullHtml: '', replaceStart: 0, replaceEnd: 0, heroStart: null, heroEnd: null };
  let _rulesEasyDirty = false;
  const RulesEditorAPI = typeof RulesEditor !== 'undefined' ? RulesEditor : null;
  let _previewDebounceTimer = null;
  const PREVIEW_DEBOUNCE_MS = 300;

  function setEasyStatus(msg, isError) {
    const el = document.getElementById('rules-easy-status');
    if (el) { el.textContent = msg || ''; el.style.color = isError ? '#f87171' : ''; }
  }

  function updatePreview() {
    const iframe = document.getElementById('rules-easy-preview-iframe');
    const wrap = iframe && iframe.closest('.rules-easy-preview-wrap');
    if (!iframe || !wrap || !RulesEditorAPI) return;
    const model = collectModelFromEditor() || _rulesState.model || RulesEditorAPI.defaultModel();
    // Always use minimal preview in iframe so it stays fast and updates reliably (full HTML can break iframe after Load from GitHub)
    const html = RulesEditorAPI.renderRulesHtml(model, '', 0, 0);
    if (!html) return;
    try {
      iframe.srcdoc = html;
      wrap.classList.add('has-preview');
      iframe.blur();
    } catch (_) {}
  }

  function debouncedUpdatePreview() {
    if (_previewDebounceTimer) clearTimeout(_previewDebounceTimer);
    _previewDebounceTimer = setTimeout(updatePreview, PREVIEW_DEBOUNCE_MS);
  }

  function _attachPreviewListeners() {
    const container = document.getElementById('rules-easy-sections');
    if (!container) return;
    function onEdit() {
      _rulesEasyDirty = true;
      debouncedUpdatePreview();
    }
    container.removeEventListener('input', onEdit);
    container.removeEventListener('change', onEdit);
    container.addEventListener('input', onEdit);
    container.addEventListener('change', onEdit);
  }

  function applyRichFormat(cmd, value) {
    document.execCommand(cmd, false, value);
    debouncedUpdatePreview();
  }

  function makeRichToolbar(contentEditableId) {
    const wrap = document.createElement('div');
    wrap.className = 'rich-toolbar';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary rich-btn';
    b.textContent = 'B';
    b.title = 'Bold';
    b.addEventListener('click', () => {
      const el = document.getElementById(contentEditableId);
      if (el) { el.focus(); applyRichFormat('bold'); }
    });
    const red = document.createElement('button');
    red.type = 'button';
    red.className = 'secondary rich-btn rich-red';
    red.textContent = 'A';
    red.title = 'Red (flag)';
    red.style.color = '#ff3a5c';
    red.addEventListener('click', () => {
      const el = document.getElementById(contentEditableId);
      if (el) { el.focus(); applyRichFormat('insertHTML', '<span class="flag">' + (window.getSelection().toString() || 'text') + '</span>'); }
    });
    const green = document.createElement('button');
    green.type = 'button';
    green.className = 'secondary rich-btn rich-green';
    green.textContent = 'A';
    green.title = 'Green (good)';
    green.style.color = '#22d98a';
    green.addEventListener('click', () => {
      const el = document.getElementById(contentEditableId);
      if (el) { el.focus(); applyRichFormat('insertHTML', '<span class="good">' + (window.getSelection().toString() || 'text') + '</span>'); }
    });
    wrap.appendChild(b);
    wrap.appendChild(red);
    wrap.appendChild(green);
    return wrap;
  }

  function renderStructuredEditor(model) {
    const container = document.getElementById('rules-easy-sections');
    if (!container || !RulesEditorAPI) return;
    const defaultModel = RulesEditorAPI.defaultModel();
    const m = model || defaultModel;
    if (!m.ruleSections || m.ruleSections.length === 0) {
      m.ruleSections = (defaultModel.ruleSections || []).map(sec => ({
        id: sec.id || 'rs' + Date.now(),
        categoryLabel: sec.categoryLabel || '',
        rules: (sec.rules || []).map(r => ({ id: r.id, num: r.num, title: r.title, contentHtml: r.contentHtml || '' }))
      }));
    }
    container.innerHTML = '';

    const addBlock = (title, inner) => {
      const block = document.createElement('div');
      block.className = 'editor-block';
      block.innerHTML = '<h3 class="editor-block-title">' + escapeHtml(title) + '</h3>';
      if (typeof inner === 'string') block.innerHTML += inner;
      else block.appendChild(inner);
      container.appendChild(block);
    };

    const hero = m.hero || {};
    const heroDiv = document.createElement('div');
    heroDiv.className = 'editor-format-details editor-hero-fields';
    heroDiv.innerHTML = '<label>Tagline (above title)</label><input type="text" class="hero-tagline" value="' + escapeHtml(hero.tagline || '') + '" placeholder="// ROCKET LEAGUE ESPORTS COMMUNITY">' +
      '<label>Title</label><input type="text" class="hero-title" value="' + escapeHtml(hero.title || '') + '" placeholder="MOTION">' +
      '<label>Subtitle (text under the title)</label><input type="text" class="hero-subtitle" value="' + escapeHtml(hero.subtitle || '') + '" placeholder="Official Rules, Formats & Info — Read before you compete.">' +
      '<label>Season label</label><input type="text" class="hero-season-label" value="' + escapeHtml(hero.seasonLabel || '') + '" placeholder="SEASON 1 ACTIVE">' +
      '<label>Formats label</label><input type="text" class="hero-formats-label" value="' + escapeHtml(hero.formatsLabel || '') + '" placeholder="2V2 · 3V3 · 4V4">' +
      '<label>Game label</label><input type="text" class="hero-game-label" value="' + escapeHtml(hero.gameLabel || '') + '" placeholder="ROCKET LEAGUE">' +
      '<label>Open label</label><input type="text" class="hero-open-label" value="' + escapeHtml(hero.openLabel || '') + '" placeholder="OPEN TO ALL RANKS">';
    addBlock('Title & subtitle (text under MOTION)', heroDiv);

    const formatsDiv = document.createElement('div');
    formatsDiv.className = 'editor-formats';
    (m.formats || []).forEach((f, i) => {
      const card = document.createElement('div');
      card.className = 'editor-format-card';
      card.dataset.index = i;
      card.innerHTML = '<label>Icon</label><input type="text" class="format-icon" value="' + escapeHtml(f.icon) + '" maxlength="2">' +
        '<label>Name</label><input type="text" class="format-name" value="' + escapeHtml(f.name) + '">' +
        '<label>Type</label><input type="text" class="format-type" value="' + escapeHtml(f.type) + '">' +
        '<label>Detail</label><textarea class="format-detail" rows="2">' + escapeHtml(f.detail) + '</textarea>';
      formatsDiv.appendChild(card);
    });
    addBlock('Formats (2v2, 3v3, 4v4)', formatsDiv);

    const formatDetailsDiv = document.createElement('div');
    formatDetailsDiv.className = 'editor-format-details';
    formatDetailsDiv.innerHTML = '<label>Series format (BO3/BO5 etc.)</label><textarea class="series-format-text" rows="4">' + escapeHtml(m.seriesFormatText || '') + '</textarea>' +
      '<label>Bracket type</label><textarea class="bracket-type-text" rows="4">' + escapeHtml(m.bracketTypeText || '') + '</textarea>' +
      '<label>Server settings</label><textarea class="server-settings-text" rows="4">' + escapeHtml(m.serverSettingsText || '') + '</textarea>';
    addBlock('Series format, Bracket, Server settings', formatDetailsDiv);

    const sectionsDiv = document.createElement('div');
    sectionsDiv.className = 'editor-rule-sections';
    (m.ruleSections || []).forEach((sec, secIdx) => {
      const secEl = document.createElement('div');
      secEl.className = 'editor-rule-section';
      secEl.dataset.sectionId = sec.id || 'rs' + secIdx;
      const secHead = document.createElement('div');
      secHead.className = 'editor-section-head';
      secHead.innerHTML = '<input type="text" class="section-category-label" value="' + escapeHtml(sec.categoryLabel || '') + '" placeholder="Section title">' +
        '<button type="button" class="secondary btn-add-rule">+ Rule</button>' +
        '<button type="button" class="secondary btn-delete-section">Delete section</button>';
      secEl.appendChild(secHead);
      const rulesList = document.createElement('div');
      rulesList.className = 'editor-rules-list';
      (sec.rules || []).forEach((rule, ruleIdx) => {
        const row = document.createElement('div');
        row.className = 'editor-rule-row';
        row.dataset.ruleId = rule.id || '';
        row.dataset.sectionIndex = secIdx;
        row.dataset.ruleIndex = ruleIdx;
        const numId = 'rule-num-' + secIdx + '-' + ruleIdx;
        const contentId = 'rule-content-' + secIdx + '-' + ruleIdx;
        row.innerHTML = '<span class="rule-drag" title="Drag to reorder">⋮⋮</span>' +
          '<input type="text" class="rule-num-input" id="' + numId + '" value="' + escapeHtml(rule.num) + '" placeholder="01 or 11.1" style="width:4em">' +
          '<input type="text" class="rule-title-input" value="' + escapeHtml(rule.title) + '" placeholder="Rule title">' +
          '<div class="rule-content-wrap"><div class="rich-toolbar-wrap"></div><div contenteditable="true" class="rule-content-editor" id="' + contentId + '">' + (rule.contentHtml || '') + '</div></div>' +
          '<button type="button" class="secondary btn-sub-rule" title="Add sub-rule (e.g. 11.1)">+ Sub</button>' +
          '<button type="button" class="secondary btn-delete-rule">Delete</button>';
        const toolbarWrap = row.querySelector('.rich-toolbar-wrap');
        toolbarWrap.appendChild(makeRichToolbar(contentId));
        rulesList.appendChild(row);
      });
      secEl.appendChild(rulesList);
      sectionsDiv.appendChild(secEl);
    });
    const addSectionBtn = document.createElement('button');
    addSectionBtn.type = 'button';
    addSectionBtn.className = 'primary';
    addSectionBtn.textContent = '+ Add new section';
    addSectionBtn.addEventListener('click', () => {
      if (!m.ruleSections) m.ruleSections = [];
      m.ruleSections.push({ id: 'rs' + Date.now(), categoryLabel: 'NEW SECTION', rules: [{ id: 'r' + Date.now(), num: '01', title: '', contentHtml: '' }] });
      renderStructuredEditor(m);
    });
    sectionsDiv.appendChild(addSectionBtn);
    addBlock('Rules (drag to reorder; use Sub for 11.1, etc.)', sectionsDiv);

    const prizesDiv = document.createElement('div');
    prizesDiv.className = 'editor-prizes';
    const p = m.prizes || {};
    prizesDiv.innerHTML = '<label>1st place</label><textarea class="prize-first" rows="3">' + escapeHtml(p.firstPlace || '') + '</textarea>' +
      '<label>2nd place</label><textarea class="prize-second" rows="2">' + escapeHtml(p.secondPlace || '') + '</textarea>' +
      '<label>MVP text</label><textarea class="prize-mvp" rows="2">' + escapeHtml(p.mvpText || '') + '</textarea>' +
      '<label>Eligibility</label><textarea class="prize-eligibility" rows="2">' + escapeHtml(p.eligibilityText || '') + '</textarea>';
    addBlock('Prizes', prizesDiv);

    const staffDiv = document.createElement('div');
    staffDiv.className = 'editor-staff';
    (m.staff || []).forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'editor-staff-card';
      card.dataset.index = i;
      card.innerHTML = '<label>Role</label><input type="text" class="staff-role" value="' + escapeHtml(s.role || '') + '">' +
        '<label>Name</label><input type="text" class="staff-name" value="' + escapeHtml(s.name || '') + '">' +
        '<label>Discord</label><input type="text" class="staff-discord" value="' + escapeHtml(s.discord || '') + '">' +
        '<label>Profile image URL</label><input type="url" class="staff-image" value="' + escapeHtml(s.imageUrl || '') + '" placeholder="https://...">' +
        '<button type="button" class="secondary btn-delete-staff">Delete</button>';
      staffDiv.appendChild(card);
    });
    const addStaffBtn = document.createElement('button');
    addStaffBtn.type = 'button';
    addStaffBtn.className = 'secondary';
    addStaffBtn.textContent = '+ Add staff';
    addStaffBtn.addEventListener('click', () => {
      if (!m.staff) m.staff = [];
      m.staff.push({ id: 's' + Date.now(), role: '', name: '', discord: '', imageUrl: '' });
      renderStructuredEditor(m);
    });
    staffDiv.appendChild(addStaffBtn);
    addBlock('Staff (with profile image URL)', staffDiv);

    _wireRuleSectionButtons(container, m);
    _wireDragDrop(container, m);
    updatePreview();
    _attachPreviewListeners();
  }

  function _wireRuleSectionButtons(container, model) {
    container.querySelectorAll('.btn-add-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const secEl = btn.closest('.editor-rule-section');
        const secIdx = Array.from(container.querySelectorAll('.editor-rule-section')).indexOf(secEl);
        const sec = (model.ruleSections || [])[secIdx];
        if (sec) {
          sec.rules = sec.rules || [];
          sec.rules.push({ id: 'r' + Date.now(), num: '', title: '', contentHtml: '' });
          renderStructuredEditor(model);
        }
      });
    });
    container.querySelectorAll('.btn-delete-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const secEl = btn.closest('.editor-rule-section');
        const secIdx = Array.from(container.querySelectorAll('.editor-rule-section')).indexOf(secEl);
        if (model.ruleSections && secIdx >= 0) { model.ruleSections.splice(secIdx, 1); renderStructuredEditor(model); }
      });
    });
    container.querySelectorAll('.btn-sub-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.editor-rule-row');
        const secIdx = parseInt(row.dataset.sectionIndex, 10);
        const ruleIdx = parseInt(row.dataset.ruleIndex, 10);
        const sec = (model.ruleSections || [])[secIdx];
        const rule = (sec && sec.rules) ? sec.rules[ruleIdx] : null;
        if (rule) {
          const subNum = rule.num ? (rule.num + '.1') : '1.1';
          sec.rules.splice(ruleIdx + 1, 0, { id: 'r' + Date.now(), num: subNum, title: '', contentHtml: '' });
          renderStructuredEditor(model);
        }
      });
    });
    container.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.editor-rule-row');
        const secIdx = parseInt(row.dataset.sectionIndex, 10);
        const ruleIdx = parseInt(row.dataset.ruleIndex, 10);
        const sec = (model.ruleSections || [])[secIdx];
        if (sec && sec.rules) { sec.rules.splice(ruleIdx, 1); renderStructuredEditor(model); }
      });
    });
    container.querySelectorAll('.btn-delete-staff').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.editor-staff-card');
        const i = parseInt(card.dataset.index, 10);
        if (model.staff && i >= 0) { model.staff.splice(i, 1); renderStructuredEditor(model); }
      });
    });
  }

  function _wireDragDrop(container, model) {
    const list = container.querySelector('.editor-rules-list');
    if (!list) return;
    list.querySelectorAll('.rule-drag').forEach(handle => {
      handle.draggable = true;
      handle.addEventListener('dragstart', (e) => {
        const row = handle.closest('.editor-rule-row');
        if (row) {
          e.dataTransfer.setData('text/plain', row.dataset.sectionIndex + ',' + row.dataset.ruleIndex);
          e.dataTransfer.effectAllowed = 'move';
        }
      });
    });
    list.querySelectorAll('.editor-rule-row').forEach(row => {
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const from = e.dataTransfer.getData('text/plain');
        if (!from) return;
        const [sIdx, rIdx] = from.split(',').map(Number);
        const sec = (model.ruleSections || [])[sIdx];
        if (!sec || !sec.rules) return;
        const toSecIdx = parseInt(row.dataset.sectionIndex, 10);
        const toRuleIdx = parseInt(row.dataset.ruleIndex, 10);
        const toSec = (model.ruleSections || [])[toSecIdx];
        if (sIdx === toSecIdx && toSec && toSec.rules) {
          const rule = sec.rules[rIdx];
          sec.rules.splice(rIdx, 1);
          toSec.rules.splice(toRuleIdx, 0, rule);
          renderStructuredEditor(model);
        }
      });
    });
  }

  function collectModelFromEditor() {
    const container = document.getElementById('rules-easy-sections');
    if (!container) return null;
    const m = _rulesState.model ? JSON.parse(JSON.stringify(_rulesState.model)) : (RulesEditorAPI ? RulesEditorAPI.defaultModel() : null);
    if (!m) return null;
    if (!m.prizes) m.prizes = {};
    if (!m.hero) m.hero = {};

    const getVal = (sel) => { const el = container.querySelector(sel); return el ? el.value : ''; };
    m.hero = {
      tagline: getVal('.hero-tagline'),
      title: getVal('.hero-title'),
      subtitle: getVal('.hero-subtitle'),
      seasonLabel: getVal('.hero-season-label'),
      formatsLabel: getVal('.hero-formats-label'),
      gameLabel: getVal('.hero-game-label'),
      openLabel: getVal('.hero-open-label')
    };

    const formatCards = container.querySelectorAll('.editor-format-card');
    if (formatCards.length) {
      m.formats = Array.from(formatCards).map(card => ({
        id: 'f' + card.dataset.index,
        icon: (card.querySelector('.format-icon') && card.querySelector('.format-icon').value) || '',
        name: (card.querySelector('.format-name') && card.querySelector('.format-name').value) || '',
        type: (card.querySelector('.format-type') && card.querySelector('.format-type').value) || '',
        detail: (card.querySelector('.format-detail') && card.querySelector('.format-detail').value) || ''
      }));
    }

    const secEls = container.querySelectorAll('.editor-rule-section');
    m.ruleSections = Array.from(secEls).map((secEl, secIdx) => {
      const rules = [];
      secEl.querySelectorAll('.editor-rule-row').forEach((row, ruleIdx) => {
        const numInput = row.querySelector('.rule-num-input');
        const titleInput = row.querySelector('.rule-title-input');
        const contentEl = row.querySelector('.rule-content-editor');
        const contentHtml = (contentEl && contentEl.innerHTML) ? (RulesEditorAPI ? RulesEditorAPI.sanitizeContentHtml(contentEl.innerHTML) : contentEl.innerHTML) : '';
        rules.push({
          id: row.dataset.ruleId || 'r' + secIdx + '-' + ruleIdx,
          num: (numInput && numInput.value) || '',
          title: (titleInput && titleInput.value) || '',
          contentHtml
        });
      });
      const catInput = secEl.querySelector('.section-category-label');
      return { id: secEl.dataset.sectionId || 'rs' + secIdx, categoryLabel: (catInput && catInput.value) || '', rules };
    });

    const prizeFirst = container.querySelector('.prize-first');
    const prizeSecond = container.querySelector('.prize-second');
    const prizeMvp = container.querySelector('.prize-mvp');
    const prizeEligibility = container.querySelector('.prize-eligibility');
    const seriesFormatEl = container.querySelector('.series-format-text');
    const bracketTypeEl = container.querySelector('.bracket-type-text');
    const serverSettingsEl = container.querySelector('.server-settings-text');
    if (seriesFormatEl) m.seriesFormatText = seriesFormatEl.value;
    if (bracketTypeEl) m.bracketTypeText = bracketTypeEl.value;
    if (serverSettingsEl) m.serverSettingsText = serverSettingsEl.value;

    if (prizeFirst) m.prizes = m.prizes || {};
    if (prizeFirst) m.prizes.firstPlace = prizeFirst.value;
    if (prizeSecond) m.prizes.secondPlace = prizeSecond.value;
    if (prizeMvp) m.prizes.mvpText = prizeMvp.value;
    if (prizeEligibility) m.prizes.eligibilityText = prizeEligibility.value;

    const staffCards = container.querySelectorAll('.editor-staff-card');
    m.staff = Array.from(staffCards).map(card => ({
      id: 's' + card.dataset.index,
      role: (card.querySelector('.staff-role') && card.querySelector('.staff-role').value) || '',
      name: (card.querySelector('.staff-name') && card.querySelector('.staff-name').value) || '',
      discord: (card.querySelector('.staff-discord') && card.querySelector('.staff-discord').value) || '',
      imageUrl: (card.querySelector('.staff-image') && card.querySelector('.staff-image').value) || ''
    }));

    return m;
  }

  const splitEl = document.getElementById('rules-easy-split');
  const resizerEl = document.getElementById('rules-easy-resizer');
  if (splitEl && resizerEl) {
    resizerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizerEl.classList.add('resizing');
      const startX = e.clientX;
      const startWidth = splitEl.querySelector('.rules-easy-editor').getBoundingClientRect().width;
      const splitRect = splitEl.getBoundingClientRect();

      function onMove(e2) {
        const dx = e2.clientX - startX;
        const newWidth = Math.round(startWidth + dx);
        const pct = Math.min(95, Math.max(20, (newWidth / splitRect.width) * 100));
        splitEl.style.setProperty('--rules-easy-editor-width', pct + '%');
      }
      function onUp() {
        resizerEl.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  const easyLoadBtn = document.getElementById('rules-easy-load-btn');
  const easySubmitBtn = document.getElementById('rules-easy-submit-btn');
  const easyPublishBtn = document.getElementById('rules-easy-publish-btn');
  const easyLoadSuggestedBtn = document.getElementById('rules-easy-load-suggested-btn');

  if (easyLoadBtn) {
    easyLoadBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setEasyStatus('Not available.', true);
      const message = _rulesEasyDirty
        ? 'You have unsaved changes. Loading from GitHub will replace your current edits. Continue?'
        : 'Load rules from GitHub? This will replace your current editor content.';
      if (!confirm(message)) return;
      setEasyStatus('Loading…');
      try {
        const { content } = await ipc.invoke('github:getRulesFile');
        const parsed = RulesEditorAPI ? RulesEditorAPI.parseRulesHtml(content) : { model: null, fullHtml: content, replaceStart: 0, replaceEnd: content.length, heroStart: null, heroEnd: null };
        _rulesState = { model: parsed.model || RulesEditorAPI.defaultModel(), fullHtml: parsed.fullHtml || content, replaceStart: parsed.replaceStart ?? 0, replaceEnd: parsed.replaceEnd ?? content.length, heroStart: parsed.heroStart ?? null, heroEnd: parsed.heroEnd ?? null };
        _rulesEasyDirty = false;
        renderStructuredEditor(_rulesState.model);
        setEasyStatus('Loaded. Edit fields, drag rules to reorder, then Submit or Publish.');
      } catch (e) {
        setEasyStatus(e.message || 'Load failed', true);
      }
    });
  }

  if (easySubmitBtn) {
    easySubmitBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setEasyStatus('Not available.', true);
      const model = collectModelFromEditor() || _rulesState.model;
      if (!model) return setEasyStatus('Nothing to submit. Add or load content first.', true);
      const html = RulesEditorAPI ? RulesEditorAPI.renderRulesHtml(model, _rulesState.fullHtml, _rulesState.replaceStart, _rulesState.replaceEnd, _rulesState.heroStart, _rulesState.heroEnd) : '';
      if (!html) return setEasyStatus('Could not build HTML.', true);
      setEasyStatus('Submitting…');
      const result = await ipc.invoke('notes:submitSuggestedRules', html);
      if (result.ok) _rulesEasyDirty = false;
      setEasyStatus(result.ok ? 'Suggested changes submitted. Master can review and publish.' : (result.error || 'Submit failed'), !result.ok);
    });
  }

  if (easyPublishBtn) {
    easyPublishBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setEasyStatus('Not available.', true);
      const model = collectModelFromEditor() || _rulesState.model;
      if (!model) return setEasyStatus('Nothing to publish. Add or load content first.', true);
      const html = RulesEditorAPI ? RulesEditorAPI.renderRulesHtml(model, _rulesState.fullHtml, _rulesState.replaceStart, _rulesState.replaceEnd, _rulesState.heroStart, _rulesState.heroEnd) : '';
      if (!html) return setEasyStatus('Could not build HTML.', true);
      setEasyStatus('Publishing…');
      try {
        await ipc.invoke('github:putRulesFile', { content: html, message: 'Update rules from Motion Hub (Easy Edit)' });
        _rulesEasyDirty = false;
        setEasyStatus('Published. Live site may take a minute to update.');
      } catch (e) {
        setEasyStatus(e.message || 'Publish failed', true);
      }
    });
  }

  if (easyLoadSuggestedBtn) {
    easyLoadSuggestedBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setEasyStatus('Not available.', true);
      if (_rulesEasyDirty && !confirm('You have unsaved changes. Load staff suggestion anyway? This will replace your current edits.')) return;
      setEasyStatus('Loading staff suggestion…');
      const result = await ipc.invoke('notes:fetchSuggestedRules');
      if (!result.ok) return setEasyStatus(result.error || 'Load failed', true);
      if (!result.html) return setEasyStatus('No suggested rules from staff yet.', true);
      const parsed = RulesEditorAPI ? RulesEditorAPI.parseRulesHtml(result.html) : { model: RulesEditorAPI.defaultModel(), fullHtml: result.html, replaceStart: 0, replaceEnd: result.html.length, heroStart: null, heroEnd: null };
      _rulesState = { model: parsed.model, fullHtml: parsed.fullHtml, replaceStart: parsed.replaceStart ?? 0, replaceEnd: parsed.replaceEnd ?? result.html.length, heroStart: parsed.heroStart ?? null, heroEnd: parsed.heroEnd ?? null };
      _rulesEasyDirty = false;
      renderStructuredEditor(_rulesState.model);
      setEasyStatus('Loaded staff suggestion. Review and click Publish to make it live.');
    });
  }

  const tokenInput = document.getElementById('rules-token-input');
  const tokenSave = document.getElementById('rules-token-save');
  if (tokenSave && tokenInput) {
    tokenSave.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return;
      const token = tokenInput.value.trim();
      await ipc.invoke('github:setToken', token || null);
      tokenInput.value = '';
      setStatus(token ? 'Token saved. You can Publish when ready.' : 'Token cleared.');
    });
    const ipc2 = getIpc();
    if (ipc2) {
      ipc2.invoke('github:hasToken').then((has) => {
        if (has && statusEl) statusEl.textContent = 'Token set. Publish is available.';
      }).catch(() => {});
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.MOTION_HUB_BUILD === 'master') {
    document.body.classList.add('is-master');
  }
  setupNavigation();
  setupExternalLinks();
  setupDiscordLinkConfig();
  setupCheckForUpdates();
  setupTournamentApp();
  setupNotesForm();
  setupRulesEditor();
});


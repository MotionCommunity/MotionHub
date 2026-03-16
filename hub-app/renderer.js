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
        if (section === 'tournament' && typeof window.refreshTournamentChangeIndicators === 'function') {
          window.refreshTournamentChangeIndicators();
        }
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

// Discord link is built-in; no config needed
function applyDiscordLink() {
  // All .discord-link-btn already have data-link in HTML
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

function setupStaffHandle() {
  const input = document.getElementById('staff-handle-input');
  const editBtn = document.getElementById('staff-handle-edit-btn');
  const ipc = getIpc();
  if (!input || !ipc || typeof ipc.invoke !== 'function') return;
  ipc.invoke('app:getStaffHandle').then((handle) => {
    input.value = handle || '';
    input.setAttribute('readonly', '');
  }).catch(() => {});
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      input.removeAttribute('readonly');
      input.focus();
    });
  }
  input.addEventListener('blur', () => {
    const val = (input.value && input.value.trim()) || '';
    ipc.invoke('app:setStaffHandle', val).catch(() => {});
    input.setAttribute('readonly', '');
  });
}

function setupTournamentApp() {
  const ipc = getIpc();
  if (!ipc) return;

  let activeTournamentId = null;
  let regList = [];
  let playersList = [];
  let regSearch = '';
  let playersSearch = '';
  let regSortKey = 'ign';
  let regSortDir = 1; // 1 asc, -1 desc
  let playersSortKey = 'ign';
  let playersSortDir = 1;

  async function ensureFormatUnlockedForTeamsAndPlayers() {
    if (!activeTournamentId) return true;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    if (t && t.formatLocked) {
      const modal = document.getElementById('tournament-locked-modal');
      if (modal) modal.hidden = false;
      else if (window.alert) window.alert('Unlock format to change teams or players. The tournament is locked. Go to the Bracket tab and click Unlock format.');
      return false;
    }
    return true;
  }

  const selectEl = document.getElementById('tournament-select');
  const newBtn = document.getElementById('tournament-new-btn');
  const archiveBtn = document.getElementById('tournament-archive-btn');
  const syncBtn = document.getElementById('tournament-sync-btn');
  const syncStatusEl = document.getElementById('tournament-sync-status');
  const regSearchInput = document.getElementById('tournament-reg-search');
  const playersSearchInput = document.getElementById('tournament-players-search');
  const regTbody = document.getElementById('tournament-registrations-tbody');
  const playersTbody = document.getElementById('tournament-players-tbody');
  const regTable = document.getElementById('tournament-registrations-table');
  const playersTable = document.getElementById('tournament-players-table');
  const playersStatusEl = document.getElementById('tournament-players-status');
  const editPlayerBtn = document.getElementById('tournament-edit-player-btn');
  const removePlayerBtn = document.getElementById('tournament-remove-player-btn');
  const playerModal = document.getElementById('tournament-player-modal');
  const playerEditId = document.getElementById('tournament-player-edit-id');
  const playerModalTitle = document.getElementById('tournament-player-modal-title');
  const playerSalaryInput = document.getElementById('tournament-player-salary');
  const playerDiscordIdInput = document.getElementById('tournament-player-discord-id');
  const playerNotesInput = document.getElementById('tournament-player-notes');
  const playerSmurfInput = document.getElementById('tournament-player-smurf');
  const playerSaveBtn = document.getElementById('tournament-player-save-btn');
  const playerCancelBtn = document.getElementById('tournament-player-cancel-btn');
  const settingsSaveBtn = document.getElementById('tournament-settings-save-btn');

  function setSyncStatus(msg, isError) {
    if (syncStatusEl) {
      syncStatusEl.textContent = msg || '';
      syncStatusEl.style.color = isError ? '#f87171' : '';
    }
  }

  function setPlayersStatus(msg) {
    if (playersStatusEl) playersStatusEl.textContent = msg || '';
  }

  function loadTournamentList() {
    ipc.invoke('tournament:getList', null).then((list) => {
      if (!selectEl) return;
      selectEl.innerHTML = '';
      const active = list.filter((t) => t.status === 'Active');
      active.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (t.id === activeTournamentId) opt.selected = true;
        selectEl.appendChild(opt);
      });
      if (active.length && !activeTournamentId) {
        activeTournamentId = active[0].id;
        selectEl.value = activeTournamentId;
      }
      loadRegistrations();
      loadPlayers();
    }).catch(() => {});
  }

  /** Build a searchable string from rank so "gc1", "ssl", "c3", "plat" etc. match full rank names. */
  function rankToSearchable(rank) {
    if (!rank) return '';
    const r = rank.toLowerCase();
    const parts = [r];
    if (r.includes('supersonic') || r.includes('ssl')) parts.push('ssl', 'supersonic legend');
    if (r.includes('grand champion')) {
      parts.push('gc', 'grand champion');
      if (r.includes('iii') || r.includes(' 3')) parts.push('gc3', 'gc 3');
      else if (r.includes('ii') || r.includes(' 2')) parts.push('gc2', 'gc 2');
      else parts.push('gc1', 'gc 1');
    }
    if (r.includes('champion') && !r.includes('grand champion')) {
      parts.push('champ', 'champion');
      if (r.includes('iii') || r.includes(' 3')) parts.push('c3', 'c 3', 'champ 3');
      else if (r.includes('ii') || r.includes(' 2')) parts.push('c2', 'c 2', 'champ 2');
      else parts.push('c1', 'c 1', 'champ 1');
    }
    if (r.includes('diamond')) {
      parts.push('diam', 'diamond');
      if (r.includes('iii') || r.includes(' 3')) parts.push('d3', 'd 3');
      else if (r.includes('ii') || r.includes(' 2')) parts.push('d2', 'd 2');
      else parts.push('d1', 'd 1');
    }
    if (r.includes('platinum') || r.includes('plat')) parts.push('plat', 'platinum', 'p1', 'p 1', 'p2', 'p 2', 'p3', 'p 3');
    if (r.includes('gold')) parts.push('gold', 'g1', 'g 1', 'g2', 'g 2', 'g3', 'g 3');
    if (r.includes('silver')) parts.push('silver', 's1', 's 1', 's2', 's 2', 's3', 's 3');
    if (r.includes('bronze')) parts.push('bronze', 'b1', 'b 1', 'b2', 'b 2', 'b3', 'b 3');
    return parts.join(' ');
  }

  function matchPlayerSearch(p, q) {
    if (!q || !q.trim()) return true;
    const s = q.trim().toLowerCase();
    const ign = (p.ign || '').toLowerCase();
    const discord = (p.discordUsername || '').toLowerCase();
    const rankSearchable = rankToSearchable(p.rank);
    const region = (p.region || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    return ign.includes(s) || discord.includes(s) || rankSearchable.includes(s) || region.includes(s) || notes.includes(s);
  }

  function sortPlayers(list, key, dir) {
    return [...list].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'registeredAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (key === 'smurfingSuspicious') {
        va = va ? 1 : 0;
        vb = vb ? 1 : 0;
      } else if (key === 'salary') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = (va ?? '').toString().toLowerCase();
        vb = (vb ?? '').toString().toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function renderRegistrationsTable() {
    if (!regTbody) return;
    const filtered = regList.filter((p) => matchPlayerSearch(p, regSearch));
    const sorted = sortPlayers(filtered, regSortKey, regSortDir);
    regTbody.innerHTML = '';
    sorted.forEach((p) => {
      const tr = document.createElement('tr');
      if (p.smurfingSuspicious) tr.classList.add('smurf-flag');
      tr.dataset.playerId = p.id;
      tr.dataset.ign = p.ign;
      const regDate = p.registeredAt ? new Date(p.registeredAt).toLocaleString() : '—';
      const notesPreview = (p.notes && p.notes.length > 30) ? p.notes.slice(0, 27) + '…' : (p.notes || '—');
      tr.innerHTML = `
        <td>${escapeHtml(p.ign)}</td>
        <td>${escapeHtml(p.discordUsername)}</td>
        <td>${escapeHtml(p.rank)}</td>
        <td>${escapeHtml(p.region)}</td>
        <td><span class="status-badge status-${(p.status || '').toLowerCase()}">${escapeHtml(p.status || 'Pending')}</span></td>
        <td>${escapeHtml(regDate)}</td>
        <td>${escapeHtml(notesPreview)}</td>
        <td>${p.smurfingSuspicious ? '⚠' : '—'}</td>
      `;
      tr.addEventListener('dblclick', () => openEditModal(p.id));
      regTbody.appendChild(tr);
    });
    updateSortHeaders(regTable, regSortKey, regSortDir);
  }

  function renderPlayersTable() {
    if (!playersTbody) return;
    const filtered = playersList.filter((p) => matchPlayerSearch(p, playersSearch));
    const sorted = sortPlayers(filtered, playersSortKey, playersSortDir);
    playersTbody.innerHTML = '';
    sorted.forEach((p) => {
      const tr = document.createElement('tr');
      if (p.smurfingSuspicious) tr.classList.add('smurf-flag');
      tr.dataset.playerId = p.id;
      tr.dataset.ign = p.ign;
      const notesPreview = (p.notes && p.notes.length > 40) ? p.notes.slice(0, 37) + '…' : (p.notes || '—');
      tr.innerHTML = `
        <td>${escapeHtml(p.ign)}</td>
        <td>${escapeHtml(p.discordUsername)}</td>
        <td>${escapeHtml(p.rank)}</td>
        <td>${escapeHtml(p.region)}</td>
        <td>${p.salary}</td>
        <td>${escapeHtml(p.draftedToTeam || '—')}</td>
        <td>${escapeHtml(notesPreview)}</td>
        <td>${p.smurfingSuspicious ? '⚠' : '—'}</td>
      `;
      tr.addEventListener('click', () => {
        document.querySelectorAll('#tournament-players-tbody tr.selected').forEach((r) => r.classList.remove('selected'));
        tr.classList.add('selected');
      });
      tr.addEventListener('dblclick', () => openEditModal(p.id));
      playersTbody.appendChild(tr);
    });
    setPlayersStatus(`${playersList.length} approved · ${playersList.filter((p) => p.smurfingSuspicious).length} smurf-flagged${playersSearch ? ` · ${filtered.length} shown` : ''}`);
    updateSortHeaders(playersTable, playersSortKey, playersSortDir);
  }

  function updateSortHeaders(table, sortKey, sortDir) {
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach((th) => {
      const key = th.dataset.sort;
      th.classList.toggle('sort-active', key === sortKey);
      th.setAttribute('title', key === sortKey ? (sortDir === 1 ? 'Sort ascending (click to reverse)' : 'Sort descending (click to reverse)') : 'Sort by this column');
      th.textContent = th.textContent.replace(/ ↑| ↓$/, '');
      if (key === sortKey) th.textContent += sortDir === 1 ? ' ↑' : ' ↓';
    });
  }

  function loadRegistrations() {
    ipc.invoke('players:getAll', { status: null, tournamentId: null }).then((players) => {
      regList = players || [];
      renderRegistrationsTable();
    }).catch(() => {});
  }

  function loadPlayers() {
    ipc.invoke('players:getAll', { status: 'Approved', tournamentId: null }).then((players) => {
      playersList = players || [];
      renderPlayersTable();
    }).catch(() => {});
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  function openEditModal(playerId) {
    ipc.invoke('players:getOne', playerId).then((p) => {
      if (!p) return;
      if (playerEditId) playerEditId.value = p.id;
      if (playerModalTitle) playerModalTitle.textContent = `Edit player — ${p.ign}`;
      if (playerSalaryInput) playerSalaryInput.value = p.salary;
      if (playerDiscordIdInput) playerDiscordIdInput.value = p.discordUserId || '';
      if (playerNotesInput) playerNotesInput.value = p.notes || '';
      if (playerSmurfInput) playerSmurfInput.checked = !!p.smurfingSuspicious;
      if (playerModal) {
        playerModal.hidden = false;
      }
    }).catch(() => {});
  }

  function closeEditModal() {
    if (playerModal) playerModal.hidden = true;
  }

  function reloadCurrentTournamentPane() {
    const activeSub = document.querySelector('.tournament-subnav-item.active');
    const sub = activeSub ? activeSub.dataset.tournamentSub : '';
    loadRegistrations();
    loadPlayers();
    if (sub === 'bracket') loadBracketPane();
    else if (sub === 'results') loadMatchResults();
    else if (sub === 'schedule') loadSchedule();
    else if (sub === 'draft') loadDraftPane();
    else if (sub === 'settings') loadSettingsIntoPane();
  }
  if (selectEl) {
    selectEl.addEventListener('change', () => {
      activeTournamentId = selectEl.value ? parseInt(selectEl.value, 10) : null;
      reloadCurrentTournamentPane();
    });
  }
  const newModal = document.getElementById('tournament-new-modal');
  const newNameInput = document.getElementById('tournament-new-name-input');
  const newCreateBtn = document.getElementById('tournament-new-create-btn');
  const newCancelBtn = document.getElementById('tournament-new-cancel-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (newNameInput) newNameInput.value = '';
      if (newModal) newModal.hidden = false;
      if (newNameInput) setTimeout(() => newNameInput.focus(), 50);
    });
  }
  if (newCancelBtn) {
    newCancelBtn.addEventListener('click', () => {
      if (newModal) newModal.hidden = true;
    });
  }
  if (newCreateBtn && newNameInput) {
    newCreateBtn.addEventListener('click', async () => {
      const name = newNameInput.value.trim();
      if (!name) return;
      try {
        const id = await ipc.invoke('tournament:create', { name, salaryCap: 300 });
        activeTournamentId = id;
        if (newModal) newModal.hidden = true;
        loadTournamentList();
      } catch (e) {
        setSyncStatus(e.message || 'Failed to create', true);
      }
    });
  }
  if (newNameInput) {
    newNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') newCreateBtn?.click();
      if (e.key === 'Escape') newCancelBtn?.click();
    });
  }
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      if (!activeTournamentId) return;
      if (!window.confirm('Archive this tournament? The Discord bot will be asked to remove team roles from players so the next tournament can reuse those roles. You can still view this tournament later.')) return;
      const t = await ipc.invoke('tournament:get', activeTournamentId);
      const rosterPlayers = await ipc.invoke('players:getAll', { status: null, tournamentId: activeTournamentId });
      const roster = (rosterPlayers || []).map((p) => ({
        id: p.id,
        ign: p.ign,
        discordUsername: p.discordUsername || '',
        discordUserId: p.discordUserId || null,
        draftedToTeam: p.draftedToTeam || null,
      }));
      const teamConfig = (t && t.teamConfig) || [];
      await ipc.invoke('tournament:archive', activeTournamentId);
      try {
        const fetchResult = await ipc.invoke('tournamentSync:fetch');
        if (fetchResult.ok && fetchResult.data) {
          await ipc.invoke('tournamentSync:update', {
            ...fetchResult.data,
            stripRolesRequest: {
              at: new Date().toISOString(),
              roster,
              teamConfig,
            },
          });
        }
      } catch (_) {
        /* Sync failed; tournament is still archived locally — update UI below */
      }
      activeTournamentId = null;
      if (selectEl) selectEl.value = '';
      loadTournamentList();
      loadArchivePane();
    });
  }
  function loadSettingsIntoPane() {
    ipc.invoke('tournament:getGoogleConfig').then((cfg) => {
      const credInput = document.getElementById('tournament-google-credentials');
      const sheetIdInput = document.getElementById('tournament-spreadsheet-id');
      const sheetNameInput = document.getElementById('tournament-sheet-name');
      if (credInput) credInput.value = cfg.credentialsPath || '';
      if (sheetIdInput) sheetIdInput.value = cfg.spreadsheetId || '';
      if (sheetNameInput) sheetNameInput.value = cfg.sheetName || 'Form_Responses';
    }).catch(() => {});
  }
  document.getElementById('tournament-google-browse-btn')?.addEventListener('click', async () => {
    const chosen = await ipc.invoke('tournament:pickCredentialsFile');
    const credInput = document.getElementById('tournament-google-credentials');
    if (chosen && credInput) credInput.value = chosen;
  });
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', async () => {
      const credInput = document.getElementById('tournament-google-credentials');
      const sheetIdInput = document.getElementById('tournament-spreadsheet-id');
      const sheetNameInput = document.getElementById('tournament-sheet-name');
      await ipc.invoke('tournament:setGoogleConfig', {
        credentialsPath: credInput?.value?.trim() || '',
        spreadsheetId: sheetIdInput?.value?.trim() || '',
        sheetName: sheetNameInput?.value?.trim() || 'Form_Responses',
      });
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      setSyncStatus('Syncing…');
      try {
        const result = await ipc.invoke('tournament:syncFromSheet', activeTournamentId);
        setSyncStatus(`Sync complete · ${result.added} new · ${result.updated} updated`);
        loadRegistrations();
        loadPlayers();
      } catch (e) {
        setSyncStatus(e.message || 'Sync failed', true);
      }
    });
  }

  const verifySyncBtn = document.getElementById('tournament-verify-sync-btn');
  const verifySyncStatusEl = document.getElementById('tournament-verify-sync-status');
  function setVerifySyncStatus(msg, isError) {
    if (verifySyncStatusEl) {
      verifySyncStatusEl.textContent = msg || '';
      verifySyncStatusEl.style.color = isError ? '#f87171' : '';
    }
  }
  if (verifySyncBtn) {
    verifySyncBtn.addEventListener('click', async () => {
      setVerifySyncStatus('Checking…');
      try {
        const fetchResult = await ipc.invoke('tournamentSync:fetch');
        if (!fetchResult.ok) {
          setVerifySyncStatus(fetchResult.error || 'Fetch failed', true);
          return;
        }
        const data = fetchResult.data || {};
        const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'never';
        let msg = `Sync reachable. Last updated: ${lastUpdated}.`;
        const rc = data.recentChanges || {};
        const parts = [];
        if (rc['tournament-bracket'] && rc['tournament-bracket'].by) parts.push(`Bracket by ${rc['tournament-bracket'].by}`);
        if (rc['tournament-results'] && rc['tournament-results'].by) parts.push(`Results by ${rc['tournament-results'].by}`);
        if (rc['tournament-schedule'] && rc['tournament-schedule'].by) parts.push(`Schedule by ${rc['tournament-schedule'].by}`);
        if (parts.length) msg += ' ' + parts.join('; ');
        if (activeTournamentId) {
          setVerifySyncStatus('Pushing your draft/bracket…');
          await pushBracketConfigToSync();
          const refetch = await ipc.invoke('tournamentSync:fetch');
          if (refetch.ok && refetch.data) {
            lastSyncData = refetch.data;
            updateChangeIndicators(refetch.data.recentChanges || {});
            const lu = refetch.data.lastUpdated ? new Date(refetch.data.lastUpdated).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '';
            setVerifySyncStatus(`Read & write OK. Your update is live. Last updated: ${lu}. Other hubs will see the change indicator.`);
          } else {
            setVerifySyncStatus(msg + ' Push may have failed.', true);
          }
        } else {
          setVerifySyncStatus(msg + ' Select a tournament and push a change to test write.');
        }
      } catch (e) {
        setVerifySyncStatus(e.message || 'Verify failed', true);
      }
    });
  }

  if (regSearchInput) {
    regSearchInput.addEventListener('input', () => {
      regSearch = regSearchInput.value || '';
      renderRegistrationsTable();
    });
  }
  if (playersSearchInput) {
    playersSearchInput.addEventListener('input', () => {
      playersSearch = playersSearchInput.value || '';
      renderPlayersTable();
    });
  }

  if (regTable) {
    regTable.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (!key) return;
        if (regSortKey === key) regSortDir *= -1;
        else { regSortKey = key; regSortDir = 1; }
        renderRegistrationsTable();
      });
    });
  }
  if (playersTable) {
    playersTable.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (!key) return;
        if (playersSortKey === key) playersSortDir *= -1;
        else { playersSortKey = key; playersSortDir = 1; }
        renderPlayersTable();
      });
    });
  }

  const ROUND_SERIES_OPTIONS = [
    { value: 'default', label: 'Default (early rounds)' },
    { value: 'quarterfinals', label: 'Quarter-finals' },
    { value: 'semifinals', label: 'Semi-finals' },
    { value: 'finals', label: 'Finals' },
  ];
  const SERIES_FORMAT_OPTIONS = [
    { value: 'SingleGame', label: 'Best of 1' },
    { value: 'BestOf3', label: 'Best of 3' },
    { value: 'BestOf5', label: 'Best of 5' },
    { value: 'BestOf7', label: 'Best of 7' },
  ];

  function getRoundFormatsFromList() {
    const listEl = document.getElementById('tournament-round-formats-list');
    if (!listEl) return [];
    const rows = listEl.querySelectorAll('.tournament-round-format-row');
    const out = [];
    rows.forEach((row) => {
      const roundSel = row.querySelector('.tournament-round-key');
      const fmtSel = row.querySelector('.tournament-round-series');
      if (roundSel && fmtSel) out.push({ round: roundSel.value, seriesFormat: fmtSel.value });
    });
    return out;
  }

  function renderRoundFormatsList(roundSeriesFormats, locked) {
    const listEl = document.getElementById('tournament-round-formats-list');
    const addBtn = document.getElementById('tournament-add-round-format-btn');
    if (!listEl) return;
    if (addBtn) addBtn.disabled = locked;
    listEl.innerHTML = '';
    (roundSeriesFormats || []).forEach(({ round, seriesFormat }) => {
      const li = document.createElement('li');
      li.className = 'tournament-round-format-row';
      const roundSelect = document.createElement('select');
      roundSelect.className = 'tournament-round-key tournament-select-inline';
      ROUND_SERIES_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === round) o.selected = true;
        roundSelect.appendChild(o);
      });
      roundSelect.disabled = locked;
      const seriesSelect = document.createElement('select');
      seriesSelect.className = 'tournament-round-series tournament-select-inline';
      SERIES_FORMAT_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === seriesFormat) o.selected = true;
        seriesSelect.appendChild(o);
      });
      seriesSelect.disabled = locked;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'secondary tournament-remove-round-format-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.disabled = locked;
      removeBtn.addEventListener('click', () => {
        li.remove();
      });
      li.append(roundSelect, ' ', seriesSelect, ' ', removeBtn);
      listEl.appendChild(li);
    });
  }

  function loadBracketPane() {
    if (!activeTournamentId) return;
    ipc.invoke('tournament:get', activeTournamentId).then((t) => {
      if (!t) return;
      const teamSizeEl = document.getElementById('tournament-team-size');
      const bracketTypeEl = document.getElementById('tournament-bracket-type');
      const seriesFormatEl = document.getElementById('tournament-series-format');
      const formatStatusEl = document.getElementById('tournament-format-status');
      const lockBtn = document.getElementById('tournament-lock-format-btn');
      if (teamSizeEl) teamSizeEl.value = String(t.teamSize ?? 3);
      if (bracketTypeEl) bracketTypeEl.value = t.bracketType || 'SingleElimination';
      if (seriesFormatEl) seriesFormatEl.value = t.seriesFormat || 'BestOf5';
      const locked = !!t.formatLocked;
      if (teamSizeEl) teamSizeEl.disabled = false;
      if (bracketTypeEl) bracketTypeEl.disabled = false;
      if (seriesFormatEl) seriesFormatEl.disabled = false;
      if (lockBtn) {
        lockBtn.textContent = locked ? 'Unlock format' : 'Lock format';
        lockBtn.disabled = false;
        lockBtn.classList.toggle('format-locked-glow', locked);
      }
      if (formatStatusEl) formatStatusEl.textContent = locked ? 'Format is locked for this tournament. You can still edit; saving will ask for confirmation.' : '';
      renderRoundFormatsList(t.roundSeriesFormats || [], false);
      const teamsListEl = document.getElementById('tournament-teams-list');
      if (teamsListEl) {
        ipc.invoke('tournament:getAllTeamSubsByTeam', activeTournamentId).then((teamSubsByTeam) => {
          ipc.invoke('players:getAll', { status: null, tournamentId: null }).then((allPlayers) => {
            const teams = t.teamConfig || [];
            teamsListEl.innerHTML = '';
            teams.forEach((team, idx) => {
              const name = team.name || 'Team';
              const roleId = team.discordRoleId || '';
              const subIds = teamSubsByTeam[name] || [];
              const subs = subIds.map((pid) => allPlayers.find((p) => p.id === pid)).filter(Boolean);
              const card = document.createElement('div');
              card.className = 'tournament-team-card';
              card.innerHTML =
                `<div class="tournament-team-card-header">` +
                `<span class="tournament-team-name">${escapeHtml(name)}</span>` +
                (roleId ? `<span class="tournament-team-role muted">Role ID: ${escapeHtml(roleId)}</span>` : '') +
                `<button type="button" class="secondary tournament-remove-team-btn" data-team-name="${escapeHtml(name)}" data-team-idx="${idx}">Remove team</button>` +
                `</div>` +
                `<p class="tournament-team-subs-label">Subs for this team:</p>` +
                `<ul class="tournament-subs-list tournament-team-subs-list" data-team-name="${escapeHtml(name)}"></ul>` +
                `<button type="button" class="secondary tournament-add-team-sub-btn" data-team-name="${escapeHtml(name)}">+ Add sub</button>`;
              const subList = card.querySelector('.tournament-team-subs-list');
              subs.forEach((p) => {
                const li = document.createElement('li');
                li.className = 'tournament-sub-item';
                const sal = Number(p.salary) || 0;
                li.innerHTML = `<span>${escapeHtml(p.ign)}</span> <span class="player-salary">$${sal}</span> <button type="button" class="secondary tournament-remove-team-sub-btn" data-team-name="${escapeHtml(name)}" data-player-id="${p.id}">Remove</button>`;
                li.querySelector('.tournament-remove-team-sub-btn').addEventListener('click', async () => {
                  if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
                  ipc.invoke('tournament:removeTeamSub', activeTournamentId, name, p.id).then(() => loadBracketPane());
                });
                subList.appendChild(li);
              });
              card.querySelector('.tournament-remove-team-btn').addEventListener('click', async () => {
                if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
                const rosterPlayers = await ipc.invoke('players:getAll', { status: null, tournamentId: activeTournamentId });
                const playersOnTeam = (rosterPlayers || []).filter((p) => (p.draftedToTeam || '') === name).map((p) => p.id);
                for (const pid of playersOnTeam) {
                  await ipc.invoke('tournament:unassignPlayerFromTeam', pid);
                }
                for (const pid of subIds) {
                  await ipc.invoke('tournament:removeTeamSub', activeTournamentId, name, pid);
                }
                const teamsNew = (t.teamConfig || []).filter((_, i) => i !== idx);
                await ipc.invoke('tournament:updateTeams', activeTournamentId, teamsNew);
                await pushBracketConfigToSync();
                loadBracketPane();
              });
              card.querySelector('.tournament-add-team-sub-btn').addEventListener('click', () => openAddTeamSubModal(name));
              teamsListEl.appendChild(card);
            });
          });
        });
      }
    }).catch(() => {});
    ipc.invoke('tournament:getSubs', activeTournamentId).then((playerIds) => {
      ipc.invoke('players:getAll', { status: null, tournamentId: null }).then((allPlayers) => {
        const subs = (playerIds || []).map((pid) => allPlayers.find((p) => p.id === pid)).filter(Boolean);
        const listEl = document.getElementById('tournament-subs-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        subs.forEach((p) => {
          const li = document.createElement('li');
          li.className = 'tournament-sub-item';
          const sal = Number(p.salary) || 0;
          li.innerHTML = `<span>${escapeHtml(p.ign)}</span> <span class="player-salary">$${sal}</span> <button type="button" class="secondary tournament-remove-sub-btn" data-player-id="${p.id}">Remove</button>`;
          li.querySelector('.tournament-remove-sub-btn').addEventListener('click', async () => {
            if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
            ipc.invoke('tournament:removeSub', activeTournamentId, p.id).then(() => loadBracketPane());
          });
          listEl.appendChild(li);
        });
      });
    }).catch(() => {});
    ipc.invoke('tournamentSync:fetch').then((result) => {
      if (result.ok && result.data) {
        lastSyncData = result.data;
        updateChangeIndicators(result.data.recentChanges);
        setLastEditedInPane('tournament-bracket-pane', 'tournament-bracket', result.data.recentChanges);
      }
    }).catch(() => {});
  }

  window._draftSelectedPlayerIds = window._draftSelectedPlayerIds || new Set();
  let draftSearch = '';
  let draftSortKey = 'ign';
  let draftSortDir = 1;
  let draftAvailableList = [];

  function parseDraftDropData(dataTransfer) {
    if (!dataTransfer) return null;
    let payload = { playerIds: [], source: 'available', sourceTeam: null };
    try {
      const text = dataTransfer.getData('text/plain');
      if (text && text.startsWith('draft:')) {
        const parsed = JSON.parse(text.slice(6));
        if (parsed && Array.isArray(parsed.playerIds)) {
          payload = { playerIds: parsed.playerIds, source: parsed.source || 'available', sourceTeam: parsed.sourceTeam || null };
        }
      } else if (text && /^\d+$/.test(text.trim())) {
        const id = parseInt(text.trim(), 10);
        if (!isNaN(id)) payload = { playerIds: [id], source: 'available', sourceTeam: null };
      } else {
        const raw = dataTransfer.getData('application/json');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.playerIds)) {
            payload = { playerIds: parsed.playerIds, source: parsed.source || 'available', sourceTeam: parsed.sourceTeam || null };
          }
        }
      }
    } catch (_) {}
    return payload.playerIds.length ? payload : null;
  }

  function renderDraftAvailableTable() {
    const tbody = document.getElementById('tournament-draft-available-tbody');
    const statusEl = document.getElementById('tournament-draft-players-status');
    const table = document.getElementById('tournament-draft-available-table');
    if (!tbody) return;
    const filtered = draftAvailableList.filter((p) => matchPlayerSearch(p, draftSearch));
    const sorted = sortPlayers(filtered, draftSortKey, draftSortDir);
    tbody.innerHTML = '';
    sorted.forEach((p) => {
      const tr = document.createElement('tr');
      tr.className = 'draggable-row';
      tr.draggable = true;
      tr.dataset.playerId = String(p.id);
      const sal = Number(p.salary) || 0;
      tr.innerHTML =
        `<td>${escapeHtml(p.ign)}</td>` +
        `<td>${escapeHtml(p.discordUsername || '—')}</td>` +
        `<td>${escapeHtml(p.rank || '—')}</td>` +
        `<td>$${sal}</td>`;
      if (window._draftSelectedPlayerIds.has(p.id)) tr.classList.add('selected');
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = p.id;
        if (window._draftSelectedPlayerIds.has(id)) {
          window._draftSelectedPlayerIds.delete(id);
          tr.classList.remove('selected');
        } else {
          window._draftSelectedPlayerIds.add(id);
          tr.classList.add('selected');
        }
      });
      tr.addEventListener('dragstart', (e) => {
        const ids = window._draftSelectedPlayerIds.has(p.id)
          ? Array.from(window._draftSelectedPlayerIds)
          : [p.id];
        const payload = { playerIds: ids, source: 'available', sourceTeam: null };
        const str = JSON.stringify(payload);
        e.dataTransfer.setData('application/json', str);
        e.dataTransfer.setData('text/plain', 'draft:' + str);
        e.dataTransfer.effectAllowed = 'move';
      });
      tbody.appendChild(tr);
    });
    if (statusEl) statusEl.textContent = `${draftAvailableList.length} available${draftSearch ? ` · ${filtered.length} shown` : ''}`;
    if (table) updateSortHeaders(table, draftSortKey, draftSortDir);
  }

  function loadDraftPresetSelect() {
    const selectEl = document.getElementById('tournament-draft-preset-select');
    if (!selectEl) return;
    ipc.invoke('app:getDraftTeamPresets').then((presets) => {
      const value = selectEl.value;
      selectEl.innerHTML = '<option value="">— Choose preset —</option>';
      presets.forEach((pre, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        const count = (pre.teamIds && pre.teamIds.length) || (pre.teams && pre.teams.length) || 0;
        opt.textContent = (pre.name || `Preset ${idx + 1}`) + (count ? ` (${count} teams)` : '');
        selectEl.appendChild(opt);
      });
      if (value && presets[parseInt(value, 10)]) selectEl.value = value;
    });
  }

  function loadTeamsPane() {
    const tbody = document.getElementById('tournament-teams-archive-tbody');
    const archiveEmpty = document.getElementById('tournament-teams-archive-empty');
    const presetsList = document.getElementById('tournament-teams-presets-list');
    const presetsEmpty = document.getElementById('tournament-teams-presets-empty');
    if (!tbody || !presetsList) return;
    Promise.all([
      ipc.invoke('app:getTeamsArchive'),
      ipc.invoke('app:getDraftTeamPresets'),
    ]).then(([archive, presets]) => {
      tbody.innerHTML = '';
      if (archive.length === 0) {
        if (archiveEmpty) archiveEmpty.style.display = '';
      } else {
        if (archiveEmpty) archiveEmpty.style.display = 'none';
        archive.forEach((team) => {
          const tr = document.createElement('tr');
          tr.innerHTML =
            `<td>${escapeHtml(team.name)}</td>` +
            `<td>${escapeHtml(team.discordRoleId || '—')}</td>` +
            `<td><button type="button" class="secondary tournament-team-edit-btn" data-team-id="${escapeHtml(team.id)}">Edit</button> ` +
            `<button type="button" class="secondary tournament-team-delete-btn" data-team-id="${escapeHtml(team.id)}" data-team-name="${escapeHtml(team.name)}">Delete</button></td>`;
          tr.querySelector('.tournament-team-edit-btn').addEventListener('click', () => openTeamEditModal(team));
          tr.querySelector('.tournament-team-delete-btn').addEventListener('click', () => deleteTeamFromArchive(team));
          tbody.appendChild(tr);
        });
      }
      presetsList.innerHTML = '';
      if (presets.length === 0) {
        if (presetsEmpty) presetsEmpty.style.display = '';
      } else {
        if (presetsEmpty) presetsEmpty.style.display = 'none';
        presets.forEach((pre, idx) => {
          const count = (pre.teamIds && pre.teamIds.length) || (pre.teams && pre.teams.length) || 0;
          const names = pre.teamIds
            ? (pre.teamIds.map((id) => archive.find((t) => t.id === id)?.name).filter(Boolean).join(', ') || '—')
            : (pre.teams && pre.teams.map((t) => t.name).filter(Boolean).join(', ')) || '—';
          const div = document.createElement('div');
          div.className = 'teams-preset-item';
          div.innerHTML =
            `<span class="preset-name">${escapeHtml(pre.name || 'Preset')}</span>` +
            `<span class="preset-teams-preview">${count ? `${count} teams: ${escapeHtml(names.length > 50 ? names.slice(0, 47) + '…' : names)}` : 'No teams'}</span>` +
            `<span><button type="button" class="primary tournament-preset-load-btn" data-preset-idx="${idx}">Load to draft</button> ` +
            `<button type="button" class="secondary tournament-preset-edit-btn" data-preset-idx="${idx}">Edit</button> ` +
            `<button type="button" class="secondary tournament-preset-delete-btn" data-preset-idx="${idx}" data-preset-name="${escapeHtml(pre.name || '')}">Delete</button></span>`;
          div.querySelector('.tournament-preset-load-btn').addEventListener('click', () => loadPresetToDraft(idx, archive, presets));
          div.querySelector('.tournament-preset-edit-btn').addEventListener('click', () => openPresetEditModal(idx, archive, presets));
          div.querySelector('.tournament-preset-delete-btn').addEventListener('click', () => deletePreset(idx, pre.name));
          presetsList.appendChild(div);
        });
      }
    });
  }

  const STATS_SITE_URL = 'https://motioncommunity.github.io/stats/';

  function openDeleteTournamentModal(t) {
    const modal = document.getElementById('tournament-delete-modal');
    const nameDisplay = document.getElementById('tournament-delete-name-display');
    const nameInput = document.getElementById('tournament-delete-name-input');
    const confirmBtn = document.getElementById('tournament-delete-confirm-btn');
    if (!modal || !nameDisplay || !nameInput || !confirmBtn) return;
    const name = (t && t.name) || 'Unnamed';
    window._deleteTournamentPayload = { id: t.id, name };
    nameDisplay.textContent = name;
    nameInput.value = '';
    nameInput.placeholder = 'Type: ' + name;
    confirmBtn.disabled = true;
    modal.hidden = false;
    setTimeout(() => nameInput.focus(), 50);
  }

  function loadArchivePane() {
    const tbody = document.getElementById('tournament-archive-tbody');
    const archiveEmpty = document.getElementById('tournament-archive-empty');
    if (!tbody) return;
    ipc.invoke('tournament:getList', 'Archived').then((list) => {
      tbody.innerHTML = '';
      if (!list || list.length === 0) {
        if (archiveEmpty) archiveEmpty.style.display = '';
      } else {
        if (archiveEmpty) archiveEmpty.style.display = 'none';
        list.forEach((t) => {
          const tr = document.createElement('tr');
          const archivedDate = t.archivedAt ? new Date(t.archivedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
          const isMasterHub = window.MOTION_HUB_BUILD === 'master';
          const deleteBtnHtml = isMasterHub
            ? ` <span class="master-only"><button type="button" class="secondary tournament-archive-delete-btn" data-tournament-id="${t.id}" data-tournament-name="${escapeHtml(t.name || 'Unnamed')}">Delete</button></span>`
            : '';
          tr.innerHTML =
            `<td>${escapeHtml(t.name || 'Unnamed')}</td>` +
            `<td>${archivedDate}</td>` +
            `<td>` +
            `<button type="button" class="secondary tournament-archive-stats-btn" data-link="${escapeHtml(STATS_SITE_URL)}" title="Open stats site to edit GitHub stats / career data for this tournament">Edit GitHub stats</button>${deleteBtnHtml}` +
            `</td>`;
          tr.querySelector('.tournament-archive-stats-btn').addEventListener('click', () => {
            if (window.motionHub && typeof window.motionHub.openExternal === 'function') {
              window.motionHub.openExternal(STATS_SITE_URL);
            } else {
              window.open(STATS_SITE_URL, '_blank');
            }
          });
          const deleteBtn = tr.querySelector('.tournament-archive-delete-btn');
          if (deleteBtn) deleteBtn.addEventListener('click', () => openDeleteTournamentModal(t));
          tbody.appendChild(tr);
        });
      }
    }).catch(() => {
      if (archiveEmpty) archiveEmpty.style.display = '';
    });
  }

  function openTeamEditModal(team) {
    document.getElementById('tournament-team-edit-modal-title').textContent = team ? 'Edit team' : 'Add team';
    document.getElementById('tournament-team-edit-id').value = team ? team.id : '';
    const nameInput = document.getElementById('tournament-team-edit-name');
    const roleInput = document.getElementById('tournament-team-edit-role');
    if (nameInput) {
      nameInput.value = team ? team.name : '';
      nameInput.removeAttribute('readonly');
      nameInput.removeAttribute('disabled');
    }
    if (roleInput) {
      roleInput.value = team && team.discordRoleId ? team.discordRoleId : '';
      roleInput.removeAttribute('readonly');
      roleInput.removeAttribute('disabled');
    }
    document.getElementById('tournament-team-edit-modal').hidden = false;
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  function deleteTeamFromArchive(team) {
    if (!window.confirm(`Delete team "${team.name}" from the archive? Presets using it will have this team removed.`)) return;
    ipc.invoke('app:deleteTeamFromArchive', team.id).then(() => loadTeamsPane());
  }

  function openPresetEditModal(index, archive, presets) {
    const pre = presets[index];
    if (!pre) return;
    document.getElementById('tournament-preset-edit-index').value = String(index);
    document.getElementById('tournament-preset-edit-name').value = pre.name || '';
    const container = document.getElementById('tournament-preset-edit-teams');
    container.innerHTML = '';
    const legacyNames = new Set((pre.teams && pre.teams.map((t) => (t.name || '').toLowerCase())) || []);
    archive.forEach((team) => {
      const label = document.createElement('label');
      const checked = (pre.teamIds && pre.teamIds.includes(team.id)) ||
        (legacyNames.size > 0 && legacyNames.has((team.name || '').toLowerCase()));
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(team.id)}" ${checked ? 'checked' : ''} /> ${escapeHtml(team.name)}`;
      container.appendChild(label);
    });
    document.getElementById('tournament-preset-edit-modal-title').textContent = 'Edit preset';
    document.getElementById('tournament-preset-edit-modal').hidden = false;
  }

  function openPresetCreateModal(archive) {
    if (archive.length === 0) {
      if (window.alert) window.alert('Add at least one team to the archive first.');
      return;
    }
    document.getElementById('tournament-preset-edit-index').value = '-1';
    document.getElementById('tournament-preset-edit-name').value = '';
    const container = document.getElementById('tournament-preset-edit-teams');
    container.innerHTML = '';
    archive.forEach((team) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(team.id)}" /> ${escapeHtml(team.name)}`;
      container.appendChild(label);
    });
    document.getElementById('tournament-preset-edit-modal-title').textContent = 'Create preset';
    document.getElementById('tournament-preset-edit-modal').hidden = false;
  }

  function deletePreset(index, name) {
    if (!window.confirm(`Delete preset "${name || 'Preset'}"?`)) return;
    ipc.invoke('app:deleteDraftTeamPreset', index).then(() => loadTeamsPane());
  }

  async function loadPresetToDraft(idx, archive, presets) {
    if (!activeTournamentId) {
      if (window.alert) window.alert('Select an active tournament first, then load a preset.');
      return;
    }
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    const preset = presets[idx];
    if (!preset) return;
    let toAdd = [];
    if (preset.teamIds && preset.teamIds.length > 0) {
      const byId = archive.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
      toAdd = preset.teamIds.map((id) => byId[id]).filter(Boolean).map((t) => ({ name: t.name, discordRoleId: t.discordRoleId }));
    } else if (preset.teams && Array.isArray(preset.teams)) {
      toAdd = preset.teams.filter((t) => t && t.name);
    }
    if (toAdd.length === 0) return;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    const existing = (t && t.teamConfig) || [];
    const existingNames = new Set(existing.map((e) => (e.name || '').toLowerCase()));
    const added = toAdd.filter((team) => !existingNames.has((team.name || '').toLowerCase()));
    if (added.length === 0) return;
    const merged = [...existing, ...added];
    await ipc.invoke('tournament:updateTeams', activeTournamentId, merged);
    await pushBracketConfigToSync();
    loadDraftPane();
  }

  function loadDraftPane() {
    if (!activeTournamentId) return;
    const teamsListEl = document.getElementById('tournament-draft-teams-list');
    const boardEl = document.getElementById('tournament-draft-board');
    const availableTbody = document.getElementById('tournament-draft-available-tbody');
    if (!teamsListEl || !boardEl) return;

    if (!boardEl._draftDropCaptureDone) {
      boardEl._draftDropCaptureDone = true;
      boardEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }, true);
      boardEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const zone = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList && el.classList.contains('draft-drop-zone'));
        boardEl.querySelectorAll('.draft-drop-zone').forEach((z) => z.classList.toggle('drag-over', z === zone));
      }, true);
      boardEl.addEventListener('drop', async (e) => {
        const zone = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList && el.classList.contains('draft-drop-zone'));
        if (!zone) return;
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
        const payload = parseDraftDropData(e.dataTransfer);
        if (!payload) return;
        if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
        const teamName = zone.dataset.dropTeam;
        const dropType = zone.dataset.dropType;
        const ids = payload.playerIds.filter((id) => id && !isNaN(id));
        if (ids.length === 0) return;
        const sameTeamSameType = payload.sourceTeam === teamName &&
          ((payload.source === 'roster' && dropType === 'roster') || (payload.source === 'sub' && dropType === 'subs'));
        if (sameTeamSameType) return;
        for (const playerId of ids) {
          if (payload.source === 'sub' && payload.sourceTeam) {
            await ipc.invoke('tournament:removeTeamSub', activeTournamentId, payload.sourceTeam, playerId);
          } else if (payload.source === 'roster' && payload.sourceTeam) {
            await ipc.invoke('tournament:unassignPlayerFromTeam', playerId);
          }
        }
        for (const playerId of ids) {
          if (dropType === 'roster') {
            await ipc.invoke('tournament:assignPlayerToTeam', activeTournamentId, playerId, teamName);
          } else {
            await ipc.invoke('tournament:addTeamSub', activeTournamentId, teamName, playerId);
          }
        }
        ids.forEach((id) => window._draftSelectedPlayerIds.delete(id));
        await pushBracketConfigToSync();
        loadDraftPane();
      }, true);
    }

    loadDraftPresetSelect();
    ipc.invoke('tournament:get', activeTournamentId).then((t) => {
      if (!t) return;
      const teamConfig = t.teamConfig || [];
      const teamSize = Number(t.teamSize) || 3;
      const salaryCap = Number(t.salaryCap) || 0;
      Promise.all([
        ipc.invoke('players:getAll', { status: null, tournamentId: activeTournamentId }),
        ipc.invoke('players:getAll', { status: 'Approved' }),
        ipc.invoke('tournament:getAllTeamSubsByTeam', activeTournamentId),
        ipc.invoke('players:getAll', { status: null, tournamentId: null }),
      ]).then(([rosterPlayers, approved, teamSubsByTeam, allPlayers]) => {
        const byTeam = {};
        (rosterPlayers || []).forEach((p) => {
          const team = p.draftedToTeam || '';
          if (!byTeam[team]) byTeam[team] = [];
          byTeam[team].push(p);
        });
        const onTeamIds = new Set((rosterPlayers || []).filter((p) => p.draftedToTeam).map((p) => p.id));
        const subIds = new Set();
        Object.values(teamSubsByTeam || {}).forEach((ids) => { (ids || []).forEach((id) => subIds.add(id)); });
        draftAvailableList = (approved || []).filter((p) => !onTeamIds.has(p.id) && !subIds.has(p.id));
        const subPlayerMap = (allPlayers || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

        teamsListEl.innerHTML = '';
        teamConfig.forEach((team, idx) => {
          const name = team.name || 'Team';
          const roleId = team.discordRoleId || '';
          const chip = document.createElement('div');
          chip.className = 'tournament-draft-team-chip';
          chip.innerHTML =
            `<span class="team-name">${escapeHtml(name)}</span>` +
            (roleId ? `<span class="team-role">${escapeHtml(roleId)}</span>` : '') +
            `<button type="button" class="secondary" data-draft-remove-team-idx="${idx}">Remove</button>`;
          chip.querySelector('[data-draft-remove-team-idx]').addEventListener('click', async () => {
            if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
            const teamsNew = teamConfig.filter((_, i) => i !== idx);
            const playersOnTeam = (byTeam[name] || []).map((p) => p.id);
            const subIdsForTeam = teamSubsByTeam[name] || [];
            for (const pid of playersOnTeam) {
              await ipc.invoke('tournament:unassignPlayerFromTeam', pid);
            }
            for (const pid of subIdsForTeam) {
              await ipc.invoke('tournament:removeTeamSub', activeTournamentId, name, pid);
            }
            await ipc.invoke('tournament:updateTeams', activeTournamentId, teamsNew);
            await pushBracketConfigToSync();
            loadDraftPane();
          });
          teamsListEl.appendChild(chip);
        });

        renderDraftAvailableTable();

        boardEl.innerHTML = '';
        teamConfig.forEach((team) => {
          const name = team.name || 'Team';
          const players = byTeam[name] || [];
          const subIds = teamSubsByTeam[name] || [];
          const subs = subIds.map((pid) => subPlayerMap[pid]).filter(Boolean);
          const totalSalary = players.reduce((sum, p) => sum + (Number(p.salary) || 0), 0);
          const overCap = salaryCap > 0 && totalSalary > salaryCap;
          const overSize = players.length > teamSize;
          const card = document.createElement('div');
          card.className = 'tournament-draft-team-card';
          card.innerHTML =
            `<div class="tournament-draft-team-card-header">` +
            `<span class="tournament-draft-team-card-title">${escapeHtml(name)}</span>` +
            `<span class="tournament-draft-team-card-meta ${overSize ? 'over-size' : ''}">${players.length}/${teamSize} players</span>` +
            (salaryCap > 0 ? `<span class="tournament-draft-team-card-meta ${overCap ? 'over-cap' : ''}">$${totalSalary}/${salaryCap} salary</span>` : '') +
            `</div>` +
            `<span class="draft-team-roster-label">Roster</span>` +
            `<ul class="tournament-draft-team-players"></ul>` +
            `<div class="draft-drop-zone" data-drop-team="${escapeHtml(name)}" data-drop-type="roster">Drop here for roster</div>` +
            `<span class="draft-team-subs-label">Subs</span>` +
            `<ul class="tournament-draft-team-subs"></ul>` +
            `<div class="draft-drop-zone" data-drop-team="${escapeHtml(name)}" data-drop-type="subs">Drop here for subs</div>` +
            `<div class="tournament-draft-team-card-actions">` +
            `<button type="button" class="secondary" data-draft-add-selected data-draft-team="${escapeHtml(name)}">Add selected</button>` +
            `<button type="button" class="secondary" data-draft-add-sub data-draft-team="${escapeHtml(name)}">Add as sub</button>` +
            `<button type="button" class="secondary tournament-draft-add-player-btn" data-draft-team="${escapeHtml(name)}">+ Add player</button>` +
            `</div>`;
          const ul = card.querySelector('.tournament-draft-team-players');
          players.forEach((p) => {
            const li = document.createElement('li');
            li.className = 'tournament-draft-team-player draft-draggable-player';
            li.draggable = true;
            li.dataset.playerId = String(p.id);
            const sal = Number(p.salary) || 0;
            li.innerHTML = `<span class="player-info">${escapeHtml(p.ign)}</span><span class="player-salary">$${sal}</span> <button type="button" class="secondary" data-draft-remove-player-id="${p.id}">Remove</button>`;
            li.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                playerIds: [p.id],
                source: 'roster',
                sourceTeam: name,
              }));
              e.dataTransfer.effectAllowed = 'move';
            });
            li.querySelector('[data-draft-remove-player-id]').addEventListener('click', async () => {
              if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
              await ipc.invoke('tournament:unassignPlayerFromTeam', p.id);
              await pushBracketConfigToSync();
              loadDraftPane();
            });
            ul.appendChild(li);
          });
          const subsUl = card.querySelector('.tournament-draft-team-subs');
          subs.forEach((p) => {
            const li = document.createElement('li');
            li.className = 'tournament-draft-team-sub draft-draggable-player';
            li.draggable = true;
            li.dataset.playerId = String(p.id);
            const subSal = Number(p.salary) || 0;
            li.innerHTML = `<span class="player-info">${escapeHtml(p.ign)}</span><span class="player-salary">$${subSal}</span> <button type="button" class="secondary" data-draft-remove-sub data-draft-team="${escapeHtml(name)}" data-player-id="${p.id}">Remove</button>`;
            li.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                playerIds: [p.id],
                source: 'sub',
                sourceTeam: name,
              }));
              e.dataTransfer.effectAllowed = 'move';
            });
            li.querySelector('[data-draft-remove-sub]').addEventListener('click', async () => {
              if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
              await ipc.invoke('tournament:removeTeamSub', activeTournamentId, name, p.id);
              await pushBracketConfigToSync();
              loadDraftPane();
            });
            subsUl.appendChild(li);
          });
          card.querySelector('.tournament-draft-add-player-btn').addEventListener('click', () => openDraftAddPlayerModal(name));
          card.querySelector('[data-draft-add-selected]').addEventListener('click', async () => {
            if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
            const ids = Array.from(window._draftSelectedPlayerIds);
            for (const playerId of ids) {
              await ipc.invoke('tournament:assignPlayerToTeam', activeTournamentId, playerId, name);
            }
            window._draftSelectedPlayerIds.clear();
            await pushBracketConfigToSync();
            loadDraftPane();
          });
          card.querySelector('[data-draft-add-sub]').addEventListener('click', async () => {
            if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
            const ids = Array.from(window._draftSelectedPlayerIds);
            for (const playerId of ids) {
              await ipc.invoke('tournament:addTeamSub', activeTournamentId, name, playerId);
            }
            window._draftSelectedPlayerIds.clear();
            await pushBracketConfigToSync();
            loadDraftPane();
          });
          card.querySelectorAll('.draft-drop-zone').forEach((zone) => {
            const teamName = zone.dataset.dropTeam;
            const dropType = zone.dataset.dropType;
            zone.addEventListener('dragenter', (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              zone.classList.add('drag-over');
            });
            zone.addEventListener('dragover', (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', (e) => {
              if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
            });
            zone.addEventListener('drop', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              zone.classList.remove('drag-over');
              const payload = parseDraftDropData(e.dataTransfer);
              if (!payload) return;
              if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
              const ids = payload.playerIds.filter((id) => id && !isNaN(id));
              if (ids.length === 0) return;
              const sameTeamSameType = payload.sourceTeam === teamName &&
                ((payload.source === 'roster' && dropType === 'roster') || (payload.source === 'sub' && (dropType === 'sub' || dropType === 'subs')));
              if (sameTeamSameType) return;
              for (const playerId of ids) {
                if (payload.source === 'sub' && payload.sourceTeam) {
                  await ipc.invoke('tournament:removeTeamSub', activeTournamentId, payload.sourceTeam, playerId);
                } else if (payload.source === 'roster') {
                  await ipc.invoke('tournament:unassignPlayerFromTeam', playerId);
                }
              }
              for (const playerId of ids) {
                if (dropType === 'roster') {
                  await ipc.invoke('tournament:assignPlayerToTeam', activeTournamentId, playerId, teamName);
                } else {
                  await ipc.invoke('tournament:addTeamSub', activeTournamentId, teamName, playerId);
                }
              }
              ids.forEach((id) => window._draftSelectedPlayerIds.delete(id));
              await pushBracketConfigToSync();
              loadDraftPane();
            });
          });
          boardEl.appendChild(card);
        });
      });
    }).catch(() => {});
  }

  window._draftAddPlayerTeamName = null;
  async function openDraftAddPlayerModal(teamName) {
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    window._draftAddPlayerTeamName = teamName;
    document.getElementById('tournament-draft-add-player-team-name').textContent = teamName || 'Team';
    Promise.all([
      ipc.invoke('players:getAll', { status: 'Approved' }),
      ipc.invoke('players:getAll', { status: null, tournamentId: activeTournamentId }),
      ipc.invoke('tournament:getAllTeamSubsByTeam', activeTournamentId),
    ]).then(([approved, drafted, teamSubsByTeam]) => {
        const onTeam = new Set((drafted || []).filter((p) => p.draftedToTeam).map((p) => p.id));
        const subSet = new Set();
        Object.values(teamSubsByTeam || {}).forEach((ids) => { (ids || []).forEach((id) => subSet.add(id)); });
        const available = (approved || []).filter((p) => !onTeam.has(p.id) && !subSet.has(p.id));
        const selectEl = document.getElementById('tournament-draft-add-player-select');
        if (!selectEl) return;
        selectEl.innerHTML = '';
        available.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.ign} (${p.rank || '—'}) $${Number(p.salary) || 0}`;
          selectEl.appendChild(opt);
        });
        selectEl.value = available[0]?.id ?? '';
    });
    document.getElementById('tournament-draft-add-player-modal').hidden = false;
  }

  let lastSyncData = null;
  const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000; // 24h
  const LAST_SEEN_KEY = 'motion-hub-lastSeenSections';

  function getLastSeenSections() {
    try {
      const raw = localStorage.getItem(LAST_SEEN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function setSectionSeen(sectionId) {
    const o = getLastSeenSections();
    o[sectionId] = new Date().toISOString();
    try {
      localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(o));
    } catch (_) {}
  }

  async function withRecentChange(payload, sectionId) {
    const handle = await ipc.invoke('app:getStaffHandle');
    const by = (handle && String(handle).trim()) || 'Staff';
    return {
      ...payload,
      recentChanges: {
        ...(payload.recentChanges || lastSyncData?.recentChanges || {}),
        [sectionId]: { by, at: new Date().toISOString() },
      },
    };
  }

  function updateChangeIndicators(recentChanges) {
    if (!recentChanges || typeof recentChanges !== 'object') return;
    const now = Date.now();
    const isRecent = (at) => at && now - new Date(at).getTime() < RECENT_CHANGE_MS;
    const lastSeen = getLastSeenSections();
    const sections = ['tournament-bracket', 'tournament-results', 'tournament-schedule'];
    let tournamentHasChange = false;
    sections.forEach((sectionId) => {
      const info = recentChanges[sectionId];
      const changeTime = info && info.at ? new Date(info.at).getTime() : 0;
      const seenTime = lastSeen[sectionId] ? new Date(lastSeen[sectionId]).getTime() : 0;
      const unseen = changeTime > seenTime;
      const recent = info && isRecent(info.at) && unseen;
      if (recent) tournamentHasChange = true;
      document.querySelectorAll(`[data-change-section="${sectionId}"]`).forEach((el) => {
        el.classList.toggle('has-change', !!recent);
      });
    });
    const tourNav = document.getElementById('nav-item-tournament');
    if (tourNav) tourNav.classList.toggle('has-change', tournamentHasChange);
  }

  window.refreshTournamentChangeIndicators = function () {
    ipc.invoke('tournamentSync:fetch').then((result) => {
      if (result.ok && result.data) {
        lastSyncData = result.data;
        updateChangeIndicators(result.data.recentChanges);
      }
    }).catch(() => {});
  };

  function setLastEditedInPane(paneId, sectionId, recentChanges) {
    const pane = document.getElementById(paneId);
    if (!pane) return;
    let el = pane.querySelector('.last-edited-muted');
    const info = recentChanges && recentChanges[sectionId];
    if (!info || !info.by) {
      if (el) el.textContent = '';
      return;
    }
    const at = info.at ? new Date(info.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '';
    if (!el) {
      el = document.createElement('p');
      el.className = 'last-edited-muted';
      const title = pane.querySelector('.tournament-pane-title');
      if (title && title.parentNode) title.parentNode.insertBefore(el, title.nextSibling);
      else pane.insertBefore(el, pane.firstChild);
    }
    el.textContent = at ? `Last edited by ${info.by} at ${at}` : `Last edited by ${info.by}`;
  }

  function loadMatchResults() {
    const statusEl = document.getElementById('tournament-results-status');
    const tbody = document.getElementById('tournament-results-tbody');
    const emptyEl = document.getElementById('tournament-results-empty');
    if (statusEl) statusEl.textContent = 'Loading…';
    ipc.invoke('tournamentSync:fetch').then((result) => {
      if (!result.ok) {
        if (statusEl) statusEl.textContent = result.error || 'Failed to load';
        return;
      }
      lastSyncData = result.data;
      const list = Array.isArray(result.data?.matchResults) ? result.data.matchResults : [];
      const filtered = activeTournamentId
        ? list.filter((m) => m.tournamentId == null || m.tournamentId === activeTournamentId)
        : list;
      if (statusEl) statusEl.textContent = '';
      if (tbody) {
        tbody.innerHTML = '';
        filtered.forEach((m) => {
          const teamAName = (m.teamA && m.teamA.name) || '—';
          const teamBName = (m.teamB && m.teamB.name) || '—';
          const winner = m.winner === 'A' ? teamAName : m.winner === 'B' ? teamBName : '—';
          const score = m.score != null ? String(m.score) : '—';
          const games = m.gamesPlayed != null ? String(m.gamesPlayed) : '—';
          const updated = (m.lastUpdated && m.lastUpdated.slice(0, 16).replace('T', ' ')) || '—';
          const tr = document.createElement('tr');
          tr.dataset.matchId = m.id;
          tr.innerHTML =
            `<td>${escapeHtml(m.round || '—')}</td>` +
            `<td>${escapeHtml(m.matchSlot || '—')}</td>` +
            `<td>${escapeHtml(teamAName)}</td>` +
            `<td>${escapeHtml(teamBName)}</td>` +
            `<td>${escapeHtml(score)}</td>` +
            `<td>${escapeHtml(winner)}</td>` +
            `<td>${escapeHtml(games)}</td>` +
            `<td>${escapeHtml(m.status || 'pending')}</td>` +
            `<td>${escapeHtml(updated)}</td>` +
            '<td><button type="button" class="secondary tournament-result-override-btn">Override</button> ' +
            '<button type="button" class="secondary tournament-result-replay-btn">Replay</button></td>';
          tr.querySelector('.tournament-result-override-btn').addEventListener('click', () => openResultOverrideModal(m));
          tr.querySelector('.tournament-result-replay-btn').addEventListener('click', () => setResultStatus(m.id, 'replay'));
          tbody.appendChild(tr);
        });
      }
      if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'block';
      updateChangeIndicators(lastSyncData.recentChanges);
      setLastEditedInPane('tournament-results-pane', 'tournament-results', lastSyncData.recentChanges);
    });
  }

  function extractReplayMatchInfo(parsed) {
    const info = { team0Score: 0, team1Score: 0, teamAName: '', teamBName: '' };
    if (!parsed || typeof parsed !== 'object') return info;
    const props = parsed.header?.properties ?? parsed.properties;
    if (Array.isArray(props)) {
      props.forEach((p) => {
        if (p && typeof p === 'object') {
          const name = (p.Name ?? p.name ?? '').toString();
          const val = p.Value ?? p.value;
          if (name === 'Team0Score' || name === 'Team1Score') {
            const v = parseInt(val, 10);
            if (name === 'Team0Score') info.team0Score = isNaN(v) ? 0 : v;
            else info.team1Score = isNaN(v) ? 0 : v;
          }
        }
      });
    } else if (props && typeof props === 'object') {
      if (props.Team0Score != null) info.team0Score = parseInt(props.Team0Score, 10) || 0;
      if (props.Team1Score != null) info.team1Score = parseInt(props.Team1Score, 10) || 0;
    }
    return info;
  }

  async function handleReplayFiles(paths) {
    if (!paths || paths.length === 0) return;
    const ipc = getIpc();
    if (!ipc || typeof ipc.invoke !== 'function') return;
    const parsedList = [];
    for (const path of paths) {
      if (!path || typeof path !== 'string') continue;
      try {
        const parsed = await ipc.invoke('replay:parse', path, true);
        if (parsed) parsedList.push(parsed);
      } catch (_) { /* skip failed */ }
    }
    if (parsedList.length === 0) {
      if (window.toast) window.toast('Could not parse .replay files (parser missing?). Opening form so you can enter the result manually.');
      openResultOverrideModal(null, null);
      return;
    }
    const last = extractReplayMatchInfo(parsedList[parsedList.length - 1]);
    const scoreStr = `${last.team0Score}-${last.team1Score}`;
    const winner = last.team0Score > last.team1Score ? 'A' : last.team1Score > last.team0Score ? 'B' : null;
    const replayPrefill = {
      score: scoreStr,
      gamesPlayed: parsedList.length,
      teamAName: last.teamAName || '',
      teamBName: last.teamBName || '',
      winner: winner || '',
      status: 'confirmed',
    };
    openResultOverrideModal(null, replayPrefill);
  }

  function openResultOverrideModal(m, replayPrefill) {
    const modal = document.getElementById('tournament-result-override-modal');
    const titleEl = document.getElementById('tournament-result-override-title');
    const idInput = document.getElementById('tournament-result-override-id');
    const newFieldsWrap = document.getElementById('tournament-result-override-new-fields');
    const roundInput = document.getElementById('tournament-result-override-round');
    const slotInput = document.getElementById('tournament-result-override-slot');
    const teamAInput = document.getElementById('tournament-result-override-team-a');
    const teamBInput = document.getElementById('tournament-result-override-team-b');
    const winnerSelect = document.getElementById('tournament-result-override-winner');
    const scoreInput = document.getElementById('tournament-result-override-score');
    const gamesInput = document.getElementById('tournament-result-override-games-played');
    const statusSelect = document.getElementById('tournament-result-override-status');
    const noteInput = document.getElementById('tournament-result-override-note');
    if (!modal || !idInput) return;
    const isNew = !m || !m.id;
    if (titleEl) titleEl.textContent = isNew ? (replayPrefill ? 'Add match result from replay' : 'Add match result (manual)') : 'Override / adjust result';
    if (newFieldsWrap) newFieldsWrap.style.display = isNew ? 'block' : 'none';
    idInput.value = (m && m.id) || '';
    if (roundInput) roundInput.value = (m && m.round) || '';
    if (slotInput) slotInput.value = (m && m.matchSlot) || '';
    teamAInput.value = (m && m.teamA && m.teamA.name) || (replayPrefill && replayPrefill.teamAName) || '';
    teamBInput.value = (m && m.teamB && m.teamB.name) || (replayPrefill && replayPrefill.teamBName) || '';
    winnerSelect.value = (m && m.winner) || (replayPrefill && replayPrefill.winner) || '';
    scoreInput.value = (replayPrefill && replayPrefill.score != null) ? String(replayPrefill.score) : (m && m.score != null ? String(m.score) : '');
    gamesInput.value = (replayPrefill && replayPrefill.gamesPlayed != null) ? String(replayPrefill.gamesPlayed) : (m && m.gamesPlayed != null ? String(m.gamesPlayed) : '0');
    statusSelect.value = (m && m.status) || (replayPrefill && replayPrefill.status) || 'confirmed';
    noteInput.value = (m && m.overrideNote) || '';
    modal.hidden = false;
  }


  function setResultStatus(matchId, status) {
    if (!lastSyncData || !Array.isArray(lastSyncData.matchResults)) return;
    const list = lastSyncData.matchResults.map((m) => (m.id === matchId ? { ...m, status, lastUpdated: new Date().toISOString() } : m));
    withRecentChange({ ...lastSyncData, matchResults: list }, 'tournament-results').then((payload) => {
      ipc.invoke('tournamentSync:update', payload).then((result) => {
        if (result.ok) {
          lastSyncData = payload;
          loadMatchResults();
        }
      });
    });
  }

  function saveResultOverride() {
    const idInput = document.getElementById('tournament-result-override-id');
    const roundInput = document.getElementById('tournament-result-override-round');
    const slotInput = document.getElementById('tournament-result-override-slot');
    const matchId = (idInput?.value || '').trim();
    const isNewResult = !matchId;
    if (isNewResult && (!lastSyncData || !Array.isArray(lastSyncData.matchResults))) {
      ipc.invoke('tournamentSync:fetch').then((result) => {
        if (result.ok && result.data) {
          lastSyncData = result.data;
          if (!Array.isArray(lastSyncData.matchResults)) lastSyncData.matchResults = [];
          saveResultOverride();
        } else if (window.toast) window.toast('Could not load tournament data. Set Notes sync URL and try Refresh first.');
      });
      return;
    }
    if (!lastSyncData || !Array.isArray(lastSyncData.matchResults)) return;
    const teamAInput = document.getElementById('tournament-result-override-team-a');
    const teamBInput = document.getElementById('tournament-result-override-team-b');
    const winnerSelect = document.getElementById('tournament-result-override-winner');
    const scoreInput = document.getElementById('tournament-result-override-score');
    const gamesInput = document.getElementById('tournament-result-override-games-played');
    const statusSelect = document.getElementById('tournament-result-override-status');
    const noteInput = document.getElementById('tournament-result-override-note');
    const teamAName = (teamAInput?.value || '').trim() || 'Team A';
    const teamBName = (teamBInput?.value || '').trim() || 'Team B';
    const winner = (winnerSelect?.value || '').trim() || null;
    const score = (scoreInput?.value || '').trim() || null;
    const gamesPlayed = parseInt(gamesInput?.value, 10) || 0;
    const status = statusSelect?.value || 'pending';
    const overrideNote = (noteInput?.value || '').trim() || null;
    const now = new Date().toISOString();

    if (!matchId) {
      const round = (roundInput?.value || '').trim() || 'Unknown';
      const matchSlot = (slotInput?.value || '').trim() || '1';
      const newId = 'match-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      const newMatch = {
        id: newId,
        tournamentId: activeTournamentId || null,
        round,
        matchSlot,
        teamA: { name: teamAName },
        teamB: { name: teamBName },
        winner,
        score,
        gamesPlayed,
        status,
        overrideNote,
        lastUpdated: now,
      };
      const list = [...lastSyncData.matchResults, newMatch];
      withRecentChange({ ...lastSyncData, matchResults: list }, 'tournament-results').then((payload) => {
        ipc.invoke('tournamentSync:update', payload).then((result) => {
          if (result.ok) {
            document.getElementById('tournament-result-override-modal').hidden = true;
            lastSyncData = payload;
            loadMatchResults();
            if (window.toast) window.toast('Result saved. It should appear in the list above.');
          } else {
            if (window.toast) window.toast(result.error || 'Could not save. Set Notes sync URL in Staff Notes and try again.');
          }
        }).catch(() => {
          if (window.toast) window.toast('Could not save. Check Notes sync URL and connection.');
        });
      });
      return;
    }

    const existing = lastSyncData.matchResults.find((m) => m.id === matchId);
    if (!existing) return;
    const updated = {
      ...existing,
      teamA: typeof existing.teamA === 'object' && existing.teamA ? { ...existing.teamA, name: teamAName } : { name: teamAName },
      teamB: typeof existing.teamB === 'object' && existing.teamB ? { ...existing.teamB, name: teamBName } : { name: teamBName },
      winner,
      score,
      gamesPlayed,
      status,
      overrideNote,
      lastUpdated: now,
    };
    const list = lastSyncData.matchResults.map((m) => (m.id === matchId ? updated : m));
    withRecentChange({ ...lastSyncData, matchResults: list }, 'tournament-results').then((payload) => {
      ipc.invoke('tournamentSync:update', payload).then((result) => {
        if (result.ok) {
          document.getElementById('tournament-result-override-modal').hidden = true;
          lastSyncData = payload;
          loadMatchResults();
        } else if (window.toast) window.toast(result.error || 'Could not save.');
      }).catch(() => {
        if (window.toast) window.toast('Could not save. Check Notes sync URL and connection.');
      });
    });
  }

  function loadSchedule() {
    const statusEl = document.getElementById('tournament-schedule-status');
    const tbody = document.getElementById('tournament-schedule-tbody');
    const emptyEl = document.getElementById('tournament-schedule-empty');
    if (statusEl) statusEl.textContent = 'Loading…';
    ipc.invoke('tournamentSync:fetch').then((result) => {
      if (!result.ok) {
        if (statusEl) statusEl.textContent = result.error || 'Failed to load';
        return;
      }
      lastSyncData = result.data;
      const list = Array.isArray(result.data?.scheduledMatches) ? result.data.scheduledMatches : [];
      const filtered = activeTournamentId
        ? list.filter((s) => s.tournamentId == null || s.tournamentId === activeTournamentId)
        : list;
      if (statusEl) statusEl.textContent = '';
      if (tbody) {
        tbody.innerHTML = '';
        filtered.forEach((s) => {
          const teamA = (s.teamA && s.teamA.name) || '—';
          const teamB = (s.teamB && s.teamB.name) || '—';
          const startAt = s.startAt ? new Date(s.startAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
          const tr = document.createElement('tr');
          tr.dataset.scheduleId = s.id;
          tr.innerHTML =
            `<td>${escapeHtml(s.round || '—')}</td>` +
            `<td>${escapeHtml(s.matchSlot || '—')}</td>` +
            `<td>${escapeHtml(teamA)}</td>` +
            `<td>${escapeHtml(teamB)}</td>` +
            `<td>${escapeHtml(startAt)}</td>` +
            `<td>${escapeHtml(s.status || 'scheduled')}</td>` +
            '<td><button type="button" class="primary tournament-schedule-start-btn">Start now</button> ' +
            '<button type="button" class="secondary tournament-schedule-edit-btn">Edit</button> ' +
            '<button type="button" class="secondary tournament-schedule-remove-btn">Remove</button></td>';
          tr.querySelector('.tournament-schedule-start-btn').addEventListener('click', () => startScheduledMatch(s.id));
          tr.querySelector('.tournament-schedule-edit-btn').addEventListener('click', () => openScheduleModal(s));
          tr.querySelector('.tournament-schedule-remove-btn').addEventListener('click', () => removeScheduledMatch(s.id));
          tbody.appendChild(tr);
        });
      }
      if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'block';
      updateChangeIndicators(lastSyncData.recentChanges);
      setLastEditedInPane('tournament-schedule-pane', 'tournament-schedule', lastSyncData.recentChanges);
    });
  }

  function toggleScheduleCustomVisibility() {
    const roundSelect = document.getElementById('tournament-schedule-round-select');
    const roundCustom = document.getElementById('tournament-schedule-round-custom');
    const slotSelect = document.getElementById('tournament-schedule-slot-select');
    const slotCustom = document.getElementById('tournament-schedule-slot-custom');
    const teamASelect = document.getElementById('tournament-schedule-team-a-select');
    const teamACustom = document.getElementById('tournament-schedule-team-a-custom');
    const roleA = document.getElementById('tournament-schedule-role-a');
    const teamBSelect = document.getElementById('tournament-schedule-team-b-select');
    const teamBCustom = document.getElementById('tournament-schedule-team-b-custom');
    const roleB = document.getElementById('tournament-schedule-role-b');
    if (roundCustom) roundCustom.style.display = roundSelect?.value === '__custom__' ? 'block' : 'none';
    if (slotCustom) slotCustom.style.display = slotSelect?.value === '__custom__' ? 'block' : 'none';
    if (teamACustom) teamACustom.style.display = teamASelect?.value === '__custom__' ? 'block' : 'none';
    if (roleA) roleA.style.display = teamASelect?.value === '__custom__' ? 'block' : 'none';
    if (teamBCustom) teamBCustom.style.display = teamBSelect?.value === '__custom__' ? 'block' : 'none';
    if (roleB) roleB.style.display = teamBSelect?.value === '__custom__' ? 'block' : 'none';
  }

  async function openScheduleModal(editItem) {
    const modal = document.getElementById('tournament-schedule-modal');
    const titleEl = document.getElementById('tournament-schedule-modal-title');
    const idInput = document.getElementById('tournament-schedule-edit-id');
    const roundSelect = document.getElementById('tournament-schedule-round-select');
    const roundCustom = document.getElementById('tournament-schedule-round-custom');
    const slotSelect = document.getElementById('tournament-schedule-slot-select');
    const slotCustom = document.getElementById('tournament-schedule-slot-custom');
    const teamASelect = document.getElementById('tournament-schedule-team-a-select');
    const teamACustom = document.getElementById('tournament-schedule-team-a-custom');
    const teamBSelect = document.getElementById('tournament-schedule-team-b-select');
    const teamBCustom = document.getElementById('tournament-schedule-team-b-custom');
    const datetimeInput = document.getElementById('tournament-schedule-datetime');
    const roleAInput = document.getElementById('tournament-schedule-role-a');
    const roleBInput = document.getElementById('tournament-schedule-role-b');
    const forceNowCheck = document.getElementById('tournament-schedule-force-now');
    if (!modal || !idInput) return;

    const teams = [];
    if (activeTournamentId) {
      try {
        const t = await ipc.invoke('tournament:get', activeTournamentId);
        if (t && Array.isArray(t.teamConfig)) teams.push(...t.teamConfig);
      } catch (_) {}
    }

    // Build team dropdown options: existing "Select" and "Custom", then tournament teams
    const clearTeamOptions = (selectEl) => {
      if (!selectEl) return;
      while (selectEl.options.length > 0) selectEl.options.remove(0);
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Select team —';
      selectEl.appendChild(opt0);
      const optCustom = document.createElement('option');
      optCustom.value = '__custom__';
      optCustom.textContent = '— Custom name —';
      selectEl.appendChild(optCustom);
    };
    clearTeamOptions(teamASelect);
    clearTeamOptions(teamBSelect);
    teams.forEach((team) => {
      const name = (team && team.name) ? String(team.name).trim() : '';
      if (!name) return;
      const oA = document.createElement('option');
      oA.value = name;
      oA.textContent = name;
      oA.setAttribute('data-discord-role-id', (team.discordRoleId != null && team.discordRoleId !== '') ? String(team.discordRoleId) : '');
      teamASelect.appendChild(oA);
      const oB = document.createElement('option');
      oB.value = name;
      oB.textContent = name;
      oB.setAttribute('data-discord-role-id', (team.discordRoleId != null && team.discordRoleId !== '') ? String(team.discordRoleId) : '');
      teamBSelect.appendChild(oB);
    });

    if (editItem) {
      if (titleEl) titleEl.textContent = 'Edit scheduled match';
      idInput.value = editItem.id || '';
      const roundVal = (editItem.round || '').trim();
      const slotVal = (editItem.matchSlot || '').trim();
      const roundOpt = ROUND_SERIES_OPTIONS.find((o) => o.value === roundVal);
      if (roundOpt && roundSelect) {
        roundSelect.value = roundOpt.value;
        if (roundCustom) roundCustom.value = '';
      } else {
        if (roundSelect) roundSelect.value = '__custom__';
        if (roundCustom) roundCustom.value = roundVal;
      }
      const slotPresets = ['1', '2', '3', 'QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'Finals'];
      if (slotPresets.includes(slotVal) && slotSelect) {
        slotSelect.value = slotVal;
        if (slotCustom) slotCustom.value = '';
      } else {
        if (slotSelect) slotSelect.value = '__custom__';
        if (slotCustom) slotCustom.value = slotVal;
      }
      const teamAName = (editItem.teamA && editItem.teamA.name) ? String(editItem.teamA.name).trim() : '';
      const teamBName = (editItem.teamB && editItem.teamB.name) ? String(editItem.teamB.name).trim() : '';
      if (teamAName && teamASelect) {
        const hasTeam = Array.from(teamASelect.options).some((o) => o.value === teamAName);
        if (hasTeam) teamASelect.value = teamAName; else { teamASelect.value = '__custom__'; if (teamACustom) teamACustom.value = teamAName; if (roleAInput) roleAInput.value = (editItem.teamA && editItem.teamA.discordRoleId) || ''; }
      } else if (teamASelect) teamASelect.value = '';
      if (teamBName && teamBSelect) {
        const hasTeam = Array.from(teamBSelect.options).some((o) => o.value === teamBName);
        if (hasTeam) teamBSelect.value = teamBName; else { teamBSelect.value = '__custom__'; if (teamBCustom) teamBCustom.value = teamBName; if (roleBInput) roleBInput.value = (editItem.teamB && editItem.teamB.discordRoleId) || ''; }
      } else if (teamBSelect) teamBSelect.value = '';
      if (editItem.startAt) {
        const d = new Date(editItem.startAt);
        datetimeInput.value = d.toISOString().slice(0, 16);
      } else datetimeInput.value = '';
      if (forceNowCheck) forceNowCheck.checked = editItem.status === 'calling' || !!editItem.startRequestedAt;
    } else {
      if (titleEl) titleEl.textContent = 'Add scheduled match';
      idInput.value = '';
      if (roundSelect) roundSelect.value = 'quarterfinals';
      if (roundCustom) roundCustom.value = '';
      if (slotSelect) slotSelect.value = '1';
      if (slotCustom) slotCustom.value = '';
      if (teamASelect) teamASelect.value = '';
      if (teamACustom) teamACustom.value = '';
      if (teamBSelect) teamBSelect.value = '';
      if (teamBCustom) teamBCustom.value = '';
      datetimeInput.value = '';
      if (roleAInput) roleAInput.value = '';
      if (roleBInput) roleBInput.value = '';
      if (forceNowCheck) forceNowCheck.checked = false;
    }
    toggleScheduleCustomVisibility();
    modal.hidden = false;
  }

  function saveSchedule() {
    const idInput = document.getElementById('tournament-schedule-edit-id');
    const roundSelect = document.getElementById('tournament-schedule-round-select');
    const roundCustom = document.getElementById('tournament-schedule-round-custom');
    const slotSelect = document.getElementById('tournament-schedule-slot-select');
    const slotCustom = document.getElementById('tournament-schedule-slot-custom');
    const teamASelect = document.getElementById('tournament-schedule-team-a-select');
    const teamACustom = document.getElementById('tournament-schedule-team-a-custom');
    const teamBSelect = document.getElementById('tournament-schedule-team-b-select');
    const teamBCustom = document.getElementById('tournament-schedule-team-b-custom');
    const datetimeInput = document.getElementById('tournament-schedule-datetime');
    const roleAInput = document.getElementById('tournament-schedule-role-a');
    const roleBInput = document.getElementById('tournament-schedule-role-b');
    const forceNowCheck = document.getElementById('tournament-schedule-force-now');

    const round = (roundSelect?.value === '__custom__' ? (roundCustom?.value || '').trim() : (roundSelect?.value || '').trim()) || null;
    const matchSlot = (slotSelect?.value === '__custom__' ? (slotCustom?.value || '').trim() : (slotSelect?.value || '').trim()) || null;
    let teamAName = 'Team A';
    let roleA = null;
    if (teamASelect?.value === '__custom__') {
      teamAName = (teamACustom?.value || '').trim() || 'Team A';
      roleA = (roleAInput?.value || '').trim() || null;
    } else if (teamASelect?.value) {
      teamAName = teamASelect.value.trim() || 'Team A';
      const optA = teamASelect.selectedOptions?.[0];
      roleA = (optA?.getAttribute('data-discord-role-id') || '').trim() || null;
    }
    let teamBName = 'Team B';
    let roleB = null;
    if (teamBSelect?.value === '__custom__') {
      teamBName = (teamBCustom?.value || '').trim() || 'Team B';
      roleB = (roleBInput?.value || '').trim() || null;
    } else if (teamBSelect?.value) {
      teamBName = teamBSelect.value.trim() || 'Team B';
      const optB = teamBSelect.selectedOptions?.[0];
      roleB = (optB?.getAttribute('data-discord-role-id') || '').trim() || null;
    }

    const forceNow = forceNowCheck?.checked === true;
    const now = new Date().toISOString();
    let startAt = datetimeInput?.value ? new Date(datetimeInput.value).toISOString() : null;
    if (forceNow) startAt = now;

    if (!lastSyncData) lastSyncData = { queue: [], verified: [], stagingApproved: [], matchResults: [], scheduledMatches: [] };
    if (!Array.isArray(lastSyncData.scheduledMatches)) lastSyncData.scheduledMatches = [];
    let list = lastSyncData.scheduledMatches;

    const basePayload = {
      round,
      matchSlot,
      teamA: { name: teamAName, discordRoleId: roleA || undefined },
      teamB: { name: teamBName, discordRoleId: roleB || undefined },
      startAt,
      tournamentId: activeTournamentId ?? undefined,
      lastUpdated: now,
    };
    if (forceNow) {
      basePayload.status = 'calling';
      basePayload.startRequestedAt = now;
    }

    if (idInput?.value) {
      const existing = list.find((s) => s.id === idInput.value);
      if (existing) {
        list = list.map((s) =>
          s.id === idInput.value ? { ...s, ...basePayload } : s
        );
      }
    } else {
      const id = 'sched-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      list = [
        ...list,
        {
          id,
          ...basePayload,
          status: forceNow ? 'calling' : 'scheduled',
          discordChannelId: null,
          createdAt: now,
        },
      ];
    }
    withRecentChange({ ...lastSyncData, scheduledMatches: list }, 'tournament-schedule').then((payload) => {
      ipc.invoke('tournamentSync:update', payload).then((result) => {
        if (result.ok) {
          document.getElementById('tournament-schedule-modal').hidden = true;
          lastSyncData = payload;
          loadSchedule();
        }
      });
    });
  }

  function startScheduledMatch(scheduleId) {
    if (!lastSyncData || !Array.isArray(lastSyncData.scheduledMatches)) return;
    const now = new Date().toISOString();
    const list = lastSyncData.scheduledMatches.map((s) =>
      s.id === scheduleId ? { ...s, status: 'calling', startRequestedAt: now, lastUpdated: now } : s
    );
    withRecentChange({ ...lastSyncData, scheduledMatches: list }, 'tournament-schedule').then((payload) => {
      ipc.invoke('tournamentSync:update', payload).then((result) => {
        if (result.ok) {
          lastSyncData = payload;
          loadSchedule();
        }
      });
    });
  }

  function removeScheduledMatch(scheduleId) {
    if (!lastSyncData || !Array.isArray(lastSyncData.scheduledMatches)) return;
    const list = lastSyncData.scheduledMatches.filter((s) => s.id !== scheduleId);
    withRecentChange({ ...lastSyncData, scheduledMatches: list }, 'tournament-schedule').then((payload) => {
      ipc.invoke('tournamentSync:update', payload).then((result) => {
        if (result.ok) {
          lastSyncData = payload;
          loadSchedule();
        }
      });
    });
  }

  document.querySelectorAll('.tournament-subnav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const sub = item.dataset.tournamentSub;
      document.querySelectorAll('.tournament-subnav-item').forEach((i) => i.classList.toggle('active', i === item));
      document.querySelectorAll('.tournament-main .tournament-pane').forEach((pane) => {
        pane.classList.toggle('visible', pane.id === `tournament-${sub}-pane`);
      });
      if (sub === 'settings') loadSettingsIntoPane();
      if (sub === 'bracket') {
        setSectionSeen('tournament-bracket');
        loadBracketPane();
      }
      if (sub === 'results') {
        setSectionSeen('tournament-results');
        loadMatchResults();
      }
      if (sub === 'schedule') {
        setSectionSeen('tournament-schedule');
        loadSchedule();
      }
      if (sub === 'draft') {
        setSectionSeen('tournament-draft');
        loadDraftPane();
      }
      if (sub === 'teams') loadTeamsPane();
      if (sub === 'archive') loadArchivePane();
    });
  });

  const teamSizeEl = document.getElementById('tournament-team-size');
  const bracketTypeEl = document.getElementById('tournament-bracket-type');
  const seriesFormatEl = document.getElementById('tournament-series-format');
  const saveFormatBtn = document.getElementById('tournament-save-format-btn');
  const lockFormatBtn = document.getElementById('tournament-lock-format-btn');
  const formatStatusEl = document.getElementById('tournament-format-status');
  const addSubBtn = document.getElementById('tournament-add-sub-btn');
  const addSubModal = document.getElementById('tournament-add-sub-modal');
  const addSubSelect = document.getElementById('tournament-add-sub-select');
  const addSubConfirmBtn = document.getElementById('tournament-add-sub-confirm-btn');
  const addSubCancelBtn = document.getElementById('tournament-add-sub-cancel-btn');

  async function openAddTeamModal() {
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    const nameInput = document.getElementById('tournament-team-name-input');
    const roleInput = document.getElementById('tournament-team-role-input');
    if (nameInput) {
      nameInput.value = '';
      nameInput.removeAttribute('readonly');
      nameInput.removeAttribute('disabled');
    }
    if (roleInput) {
      roleInput.value = '';
      roleInput.removeAttribute('readonly');
      roleInput.removeAttribute('disabled');
    }
    document.getElementById('tournament-add-team-modal').hidden = false;
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  async function openAddTeamSubModal(teamName) {
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    const titleEl = document.getElementById('tournament-add-team-sub-team-name');
    if (titleEl) titleEl.textContent = teamName;
    window._addTeamSubTeamName = teamName;
    ipc.invoke('tournament:getTeamSubs', activeTournamentId, teamName).then((subIds) => {
      ipc.invoke('players:getAll', { status: 'Approved', tournamentId: null }).then((approved) => {
        const available = approved.filter((p) => !subIds.includes(p.id));
        const selectEl = document.getElementById('tournament-add-team-sub-select');
        if (!selectEl) return;
        selectEl.innerHTML = '';
        available.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.ign} (${p.rank || '—'})`;
          selectEl.appendChild(opt);
        });
        selectEl.value = available[0]?.id ?? '';
      });
    });
    document.getElementById('tournament-add-team-sub-modal').hidden = false;
  }

  async function pushBracketConfigToSync() {
    if (!activeTournamentId) return;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    if (!t) return;
    const rosterPlayers = await ipc.invoke('players:getAll', { status: null, tournamentId: activeTournamentId });
    const roster = (rosterPlayers || []).map((p) => ({
      id: p.id,
      ign: p.ign,
      discordUsername: p.discordUsername || '',
      discordUserId: p.discordUserId || null,
      draftedToTeam: p.draftedToTeam || null,
    }));
    const fetchResult = await ipc.invoke('tournamentSync:fetch');
    if (!fetchResult.ok || !fetchResult.data) return;
    const payload = await withRecentChange(
      {
        ...fetchResult.data,
        bracketConfig: {
          tournamentId: activeTournamentId,
          teamSize: t.teamSize ?? 3,
          seriesFormat: t.seriesFormat ?? 'BestOf5',
          bracketType: t.bracketType ?? 'SingleElimination',
          roundSeriesFormats: t.roundSeriesFormats || [],
          teamConfig: t.teamConfig || [],
          roster,
          updatedAt: new Date().toISOString(),
        },
      },
      'tournament-bracket'
    );
    await ipc.invoke('tournamentSync:update', payload);
    if (lastSyncData) lastSyncData.recentChanges = payload.recentChanges;
  }

  if (saveFormatBtn && activeTournamentId !== undefined) {
    saveFormatBtn.addEventListener('click', async () => {
      if (!activeTournamentId) return;
      const t = await ipc.invoke('tournament:get', activeTournamentId);
      const isLocked = t && t.formatLocked;
      if (isLocked) {
        const ok = window.confirm(
          'Format is locked. Are you sure you want to override and change the format? The Discord bot will be updated with the new settings.'
        );
        if (!ok) return;
      }
      const teamSize = parseInt(teamSizeEl?.value, 10) || 3;
      const bracketType = bracketTypeEl?.value || 'SingleElimination';
      const seriesFormat = seriesFormatEl?.value || 'BestOf5';
      const roundSeriesFormats = getRoundFormatsFromList();
      await ipc.invoke('tournament:updateSettings', activeTournamentId, {
        teamSize,
        seriesFormat,
        bracketType,
        roundSeriesFormats,
        overrideLock: isLocked,
      });
      await pushBracketConfigToSync();
      loadBracketPane();
      if (formatStatusEl) formatStatusEl.textContent = isLocked ? 'Format overridden and saved. Discord bot has been updated.' : 'Format saved. Discord bot has been updated.';
    });
  }
  const addRoundFormatBtn = document.getElementById('tournament-add-round-format-btn');
  if (addRoundFormatBtn) {
    addRoundFormatBtn.addEventListener('click', () => {
      const listEl = document.getElementById('tournament-round-formats-list');
      if (!listEl) return;
      const used = new Set(getRoundFormatsFromList().map((r) => r.round));
      const round = ROUND_SERIES_OPTIONS.find((o) => !used.has(o.value))?.value ?? 'default';
      const li = document.createElement('li');
      li.className = 'tournament-round-format-row';
      const roundSelect = document.createElement('select');
      roundSelect.className = 'tournament-round-key tournament-select-inline';
      ROUND_SERIES_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === round) o.selected = true;
        roundSelect.appendChild(o);
      });
      const seriesSelect = document.createElement('select');
      seriesSelect.className = 'tournament-round-series tournament-select-inline';
      SERIES_FORMAT_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === 'BestOf3') o.selected = true;
        seriesSelect.appendChild(o);
      });
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'secondary tournament-remove-round-format-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => li.remove());
      li.append(roundSelect, ' ', seriesSelect, ' ', removeBtn);
      listEl.appendChild(li);
    });
  }
  if (lockFormatBtn) {
    lockFormatBtn.addEventListener('click', async () => {
      if (!activeTournamentId) return;
      const t = await ipc.invoke('tournament:get', activeTournamentId);
      const currentlyLocked = !!(t && t.formatLocked);
      await ipc.invoke('tournament:updateSettings', activeTournamentId, {
        formatLocked: !currentlyLocked,
        overrideLock: true,
      });
      await pushBracketConfigToSync();
      loadBracketPane();
      if (formatStatusEl) formatStatusEl.textContent = currentlyLocked ? 'Format unlocked. You can lock again anytime.' : 'Format locked. You can still edit; saving will ask for confirmation.';
    });
  }
  if (addSubBtn) {
    addSubBtn.addEventListener('click', async () => {
      if (!activeTournamentId) return;
      if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
      const subIds = await ipc.invoke('tournament:getSubs', activeTournamentId);
      const approved = await ipc.invoke('players:getAll', { status: 'Approved', tournamentId: null });
      const available = approved.filter((p) => !subIds.includes(p.id));
      if (!addSubSelect) return;
      addSubSelect.innerHTML = '';
      available.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.ign} (${p.rank || '—'})`;
        addSubSelect.appendChild(opt);
      });
      if (addSubModal) addSubModal.hidden = false;
      if (addSubSelect) addSubSelect.value = available[0]?.id ?? '';
    });
  }
  if (addSubConfirmBtn && addSubSelect) {
    addSubConfirmBtn.addEventListener('click', async () => {
      const playerId = parseInt(addSubSelect.value, 10);
      if (!playerId || !activeTournamentId) return;
      if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
      await ipc.invoke('tournament:addSub', activeTournamentId, playerId);
      if (addSubModal) addSubModal.hidden = true;
      loadBracketPane();
    });
  }
  if (addSubCancelBtn) {
    addSubCancelBtn.addEventListener('click', () => {
      if (addSubModal) addSubModal.hidden = true;
    });
  }

  document.getElementById('tournament-add-team-btn')?.addEventListener('click', () => openAddTeamModal());
  document.getElementById('tournament-add-team-save-btn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('tournament-team-name-input');
    const roleInput = document.getElementById('tournament-team-role-input');
    const name = (nameInput?.value || '').trim();
    if (!name) return;
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    const teams = [...(t?.teamConfig || []), { name, discordRoleId: (roleInput?.value || '').trim() || undefined }];
    await ipc.invoke('tournament:updateTeams', activeTournamentId, teams);
    await pushBracketConfigToSync();
    document.getElementById('tournament-add-team-modal').hidden = true;
    loadBracketPane();
    loadDraftPane();
  });
  document.getElementById('tournament-add-team-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-add-team-modal').hidden = true;
  });
  document.getElementById('tournament-add-team-sub-confirm-btn')?.addEventListener('click', async () => {
    const teamName = window._addTeamSubTeamName;
    const selectEl = document.getElementById('tournament-add-team-sub-select');
    const playerId = selectEl ? parseInt(selectEl.value, 10) : 0;
    if (!teamName || !playerId || !activeTournamentId) return;
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    await ipc.invoke('tournament:addTeamSub', activeTournamentId, teamName, playerId);
    document.getElementById('tournament-add-team-sub-modal').hidden = true;
    loadBracketPane();
  });
  document.getElementById('tournament-add-team-sub-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-add-team-sub-modal').hidden = true;
  });

  document.getElementById('tournament-draft-add-team-btn')?.addEventListener('click', () => openAddTeamModal());
  document.getElementById('tournament-draft-add-player-confirm-btn')?.addEventListener('click', async () => {
    const teamName = window._draftAddPlayerTeamName;
    const selectEl = document.getElementById('tournament-draft-add-player-select');
    const playerId = selectEl ? parseInt(selectEl.value, 10) : 0;
    if (!teamName || !playerId || !activeTournamentId) return;
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    await ipc.invoke('tournament:assignPlayerToTeam', activeTournamentId, playerId, teamName);
    await pushBracketConfigToSync();
    document.getElementById('tournament-draft-add-player-modal').hidden = true;
    loadDraftPane();
  });
  document.getElementById('tournament-draft-add-player-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-draft-add-player-modal').hidden = true;
  });

  const deleteTournamentNameInput = document.getElementById('tournament-delete-name-input');
  const deleteTournamentConfirmBtn = document.getElementById('tournament-delete-confirm-btn');
  if (deleteTournamentNameInput && deleteTournamentConfirmBtn) {
    deleteTournamentNameInput.addEventListener('input', () => {
      const payload = window._deleteTournamentPayload;
      const match = payload && (deleteTournamentNameInput.value || '').trim() === (payload.name || '');
      deleteTournamentConfirmBtn.disabled = !match;
    });
  }
  document.getElementById('tournament-delete-confirm-btn')?.addEventListener('click', async () => {
    const payload = window._deleteTournamentPayload;
    if (!payload || !payload.id) return;
    await ipc.invoke('tournament:delete', payload.id);
    document.getElementById('tournament-delete-modal').hidden = true;
    window._deleteTournamentPayload = null;
    if (activeTournamentId === payload.id) {
      activeTournamentId = null;
      loadTournamentList();
    }
    loadArchivePane();
  });
  document.getElementById('tournament-delete-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-delete-modal').hidden = true;
    window._deleteTournamentPayload = null;
  });

  const draftSearchInput = document.getElementById('tournament-draft-search');
  if (draftSearchInput) {
    draftSearchInput.addEventListener('input', () => {
      draftSearch = draftSearchInput.value || '';
      renderDraftAvailableTable();
    });
  }
  const draftTable = document.getElementById('tournament-draft-available-table');
  if (draftTable) {
    draftTable.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (!key) return;
        if (draftSortKey === key) draftSortDir *= -1;
        else { draftSortKey = key; draftSortDir = 1; }
        renderDraftAvailableTable();
      });
    });
  }
  document.getElementById('tournament-draft-add-preset-btn')?.addEventListener('click', async () => {
    const selectEl = document.getElementById('tournament-draft-preset-select');
    const idx = selectEl ? parseInt(selectEl.value, 10) : -1;
    if (!activeTournamentId || isNaN(idx) || idx < 0) return;
    if (!(await ensureFormatUnlockedForTeamsAndPlayers())) return;
    const [presets, archive] = await Promise.all([
      ipc.invoke('app:getDraftTeamPresets'),
      ipc.invoke('app:getTeamsArchive'),
    ]);
    const preset = presets[idx];
    if (!preset) return;
    let toAdd = [];
    if (preset.teamIds && preset.teamIds.length > 0) {
      const byId = archive.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
      toAdd = preset.teamIds.map((id) => byId[id]).filter(Boolean).map((t) => ({ name: t.name, discordRoleId: t.discordRoleId }));
    } else if (preset.teams && Array.isArray(preset.teams)) {
      toAdd = preset.teams.filter((t) => t && t.name);
    }
    if (toAdd.length === 0) return;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    const existing = (t && t.teamConfig) || [];
    const existingNames = new Set(existing.map((e) => (e.name || '').toLowerCase()));
    const added = toAdd.filter((team) => !existingNames.has((team.name || '').toLowerCase()));
    if (added.length === 0) return;
    const merged = [...existing, ...added];
    await ipc.invoke('tournament:updateTeams', activeTournamentId, merged);
    await pushBracketConfigToSync();
    loadDraftPane();
  });
  document.getElementById('tournament-draft-save-preset-btn')?.addEventListener('click', async () => {
    if (!activeTournamentId) return;
    const t = await ipc.invoke('tournament:get', activeTournamentId);
    const teamConfig = (t && t.teamConfig) || [];
    if (teamConfig.length === 0) {
      if (window.alert) window.alert('Add at least one team to the draft first, then save as preset.');
      return;
    }
    const archive = await ipc.invoke('app:getTeamsArchive');
    const presets = await ipc.invoke('app:getDraftTeamPresets');
    const teamIds = [];
    for (const team of teamConfig) {
      const n = (team.name || '').trim();
      if (!n) continue;
      let found = archive.find((a) => (a.name || '').toLowerCase() === n.toLowerCase());
      if (!found) {
        const id = await ipc.invoke('app:addTeamToArchive', { name: n, discordRoleId: team.discordRoleId });
        teamIds.push(id);
      } else {
        teamIds.push(found.id);
      }
    }
    const selectEl = document.getElementById('tournament-draft-preset-select');
    const selectedIndex = selectEl ? parseInt(selectEl.value, 10) : -1;
    const selectedPreset = selectedIndex >= 0 && presets[selectedIndex] ? presets[selectedIndex] : null;
    window._draftSavePresetPayload = { teamIds, teamCount: teamConfig.length, presetIndex: selectedIndex, presetName: selectedPreset ? selectedPreset.name : null };
    const countEl = document.getElementById('tournament-draft-save-preset-count');
    if (countEl) countEl.textContent = String(teamConfig.length);
    const overwriteBtn = document.getElementById('tournament-draft-save-preset-overwrite-btn');
    if (overwriteBtn) {
      if (selectedPreset) {
        overwriteBtn.style.display = '';
        overwriteBtn.textContent = `Overwrite "${selectedPreset.name || 'Preset'}"`;
      } else {
        overwriteBtn.style.display = 'none';
      }
    }
    document.getElementById('tournament-draft-save-preset-modal').hidden = false;
  });
  document.getElementById('tournament-draft-save-preset-overwrite-btn')?.addEventListener('click', async () => {
    const payload = window._draftSavePresetPayload;
    if (!payload || payload.presetIndex == null || payload.presetIndex < 0) return;
    const name = payload.presetName || 'Preset';
    if (!window.confirm(`Overwrite preset "${name}" with current ${payload.teamCount} team(s)? This will replace the preset's team list.`)) return;
    await ipc.invoke('app:updateDraftTeamPreset', payload.presetIndex, { teamIds: payload.teamIds });
    document.getElementById('tournament-draft-save-preset-modal').hidden = true;
    if (window.alert) window.alert(`Preset "${name}" has been overwritten.`);
    loadDraftPresetSelect();
    loadTeamsPane();
  });
  document.getElementById('tournament-draft-save-preset-new-btn')?.addEventListener('click', async () => {
    const payload = window._draftSavePresetPayload;
    if (!payload) return;
    document.getElementById('tournament-draft-save-preset-modal').hidden = true;
    const presets = await ipc.invoke('app:getDraftTeamPresets');
    const existingNames = new Set((presets || []).map((p) => (p.name || '').toLowerCase()));
    let defaultName = 'My teams (NEW)';
    for (let i = 1; i < 100; i++) {
      const candidate = i === 1 ? 'My teams (NEW)' : `My teams (NEW ${i})`;
      if (!existingNames.has(candidate.toLowerCase())) {
        defaultName = candidate;
        break;
      }
    }
    const name = window.prompt('New preset name (will be saved as a new preset, not overwrite):', defaultName);
    if (name == null || !name.trim()) return;
    if (!window.confirm(`Create new preset "${name.trim()}" with ${payload.teamCount} team(s)? This will add a new preset and not change any existing one.`)) return;
    await ipc.invoke('app:saveDraftTeamPreset', { name: name.trim(), teamIds: payload.teamIds });
    if (window.alert) window.alert(`Preset "${name.trim()}" has been created.`);
    loadDraftPresetSelect();
    loadTeamsPane();
  });
  document.getElementById('tournament-draft-save-preset-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-draft-save-preset-modal').hidden = true;
  });

  document.getElementById('tournament-locked-goto-bracket-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('tournament-locked-modal');
    if (modal) modal.hidden = true;
    switchSection('tournament');
    setTimeout(() => {
      const bracketBtn = document.querySelector('.tournament-subnav-item[data-tournament-sub="bracket"]');
      if (bracketBtn) bracketBtn.click();
    }, 0);
  });
  document.getElementById('tournament-locked-dismiss-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('tournament-locked-modal');
    if (modal) modal.hidden = true;
  });

  document.getElementById('tournament-teams-add-btn')?.addEventListener('click', () => openTeamEditModal(null));
  document.getElementById('tournament-team-edit-save-btn')?.addEventListener('click', async () => {
    const idInput = document.getElementById('tournament-team-edit-id');
    const nameInput = document.getElementById('tournament-team-edit-name');
    const roleInput = document.getElementById('tournament-team-edit-role');
    const id = idInput?.value?.trim();
    const name = (nameInput?.value || '').trim();
    if (!name) return;
    if (id) {
      await ipc.invoke('app:updateTeamInArchive', id, { name, discordRoleId: roleInput?.value?.trim() || undefined });
    } else {
      await ipc.invoke('app:addTeamToArchive', { name, discordRoleId: roleInput?.value?.trim() || undefined });
    }
    document.getElementById('tournament-team-edit-modal').hidden = true;
    loadTeamsPane();
    loadDraftPresetSelect();
  });
  document.getElementById('tournament-team-edit-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-team-edit-modal').hidden = true;
  });
  document.getElementById('tournament-teams-create-preset-btn')?.addEventListener('click', async () => {
    const archive = await ipc.invoke('app:getTeamsArchive');
    openPresetCreateModal(archive);
  });
  document.getElementById('tournament-preset-edit-save-btn')?.addEventListener('click', async () => {
    const indexInput = document.getElementById('tournament-preset-edit-index');
    const nameInput = document.getElementById('tournament-preset-edit-name');
    const container = document.getElementById('tournament-preset-edit-teams');
    const index = parseInt(indexInput?.value ?? '-1', 10);
    const name = (nameInput?.value || '').trim();
    const teamIds = Array.from(container?.querySelectorAll('input[type=checkbox]:checked') || []).map((cb) => cb.value).filter(Boolean);
    if (!name) return;
    if (index >= 0) {
      await ipc.invoke('app:updateDraftTeamPreset', index, { name, teamIds });
    } else {
      await ipc.invoke('app:saveDraftTeamPreset', { name, teamIds });
    }
    document.getElementById('tournament-preset-edit-modal').hidden = true;
    loadTeamsPane();
    loadDraftPresetSelect();
  });
  document.getElementById('tournament-preset-edit-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-preset-edit-modal').hidden = true;
  });

  const resultsRefreshBtn = document.getElementById('tournament-results-refresh-btn');
  if (resultsRefreshBtn) resultsRefreshBtn.addEventListener('click', () => loadMatchResults());
  document.getElementById('tournament-result-override-save-btn')?.addEventListener('click', () => saveResultOverride());
  document.getElementById('tournament-result-override-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-result-override-modal').hidden = true;
  });

  const replayAddBtn = document.getElementById('tournament-results-add-replay-btn');
  if (replayAddBtn) {
    replayAddBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc || typeof ipc.invoke !== 'function') return;
      const paths = await ipc.invoke('replay:selectFiles');
      await handleReplayFiles(paths || []);
    });
  }
  const addManualBtn = document.getElementById('tournament-results-add-manual-btn');
  if (addManualBtn) {
    addManualBtn.addEventListener('click', () => {
      if (typeof openResultOverrideModal === 'function') openResultOverrideModal(null, null);
    });
  }
  const replayDrop = document.getElementById('tournament-results-replay-drop');
  if (replayDrop) {
    replayDrop.addEventListener('dragover', (e) => { e.preventDefault(); replayDrop.classList.add('drag-over'); });
    replayDrop.addEventListener('dragleave', () => replayDrop.classList.remove('drag-over'));
    replayDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      replayDrop.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = f.path || f.filePath;
        const name = (f.name || '').toLowerCase();
        if (name.endsWith('.replay') && path) paths.push(path);
      }
      if (paths.length === 0 && typeof window.toast === 'function') window.toast('No .replay file paths from drop. Use "Select .replay files" for local files.');
      else handleReplayFiles(paths);
    });
  }

  document.getElementById('tournament-schedule-add-btn')?.addEventListener('click', () => openScheduleModal(null));
  document.getElementById('tournament-schedule-refresh-btn')?.addEventListener('click', () => loadSchedule());
  document.getElementById('tournament-schedule-save-btn')?.addEventListener('click', () => saveSchedule());
  document.getElementById('tournament-schedule-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-schedule-modal').hidden = true;
  });
  ['tournament-schedule-round-select', 'tournament-schedule-slot-select', 'tournament-schedule-team-a-select', 'tournament-schedule-team-b-select'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', toggleScheduleCustomVisibility);
  });

  if (editPlayerBtn) {
    editPlayerBtn.addEventListener('click', () => {
      const selected = document.querySelector('#tournament-players-tbody tr.selected');
      if (!selected) return;
      const id = parseInt(selected.dataset.playerId, 10);
      if (id) openEditModal(id);
    });
  }
  if (removePlayerBtn) {
    removePlayerBtn.addEventListener('click', async () => {
      const selected = document.querySelector('#tournament-players-tbody tr.selected');
      if (!selected || !window.confirm(`Remove ${selected.dataset.ign} from the roster?`)) return;
      const id = parseInt(selected.dataset.playerId, 10);
      if (!id) return;
      await ipc.invoke('players:delete', id);
      loadRegistrations();
      loadPlayers();
    });
  }
  if (playerSaveBtn) {
    playerSaveBtn.addEventListener('click', async () => {
      const id = parseInt(playerEditId?.value, 10);
      if (!id) return;
      const salary = parseInt(playerSalaryInput?.value, 10) || 10;
      const discordUserId = (playerDiscordIdInput?.value || '').trim() || null;
      const notes = playerNotesInput?.value ?? '';
      const smurf = playerSmurfInput?.checked ?? false;
      await ipc.invoke('players:updateSalary', { id, salary });
      await ipc.invoke('players:updateDiscordUserId', { id, discordUserId });
      await ipc.invoke('players:updateNotesAndSmurfing', { id, notes, smurfingSuspicious: smurf });
      closeEditModal();
      loadRegistrations();
      loadPlayers();
    });
  }
  if (playerCancelBtn) playerCancelBtn.addEventListener('click', closeEditModal);

  loadTournamentList();
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
  const loadSyncedBtn = document.getElementById('notes-load-synced');
  const syncedList = document.getElementById('notes-synced-items');
  if (!form) return;

  const ipc = getIpc();
  if (ipc) {
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
      const result = await ipc.invoke('notes:submit', { topic, body, createdAt: note.createdAt });
      if (status) {
        status.textContent = result.ok
          ? 'Note saved and synced to the team.'
          : 'Note saved locally. Sync failed: ' + (result.error || 'unknown');
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
    if (tab === 'preview') {
      const previewIframe = document.getElementById('rules-preview-iframe');
      if (previewIframe && previewIframe.src) {
        const base = previewIframe.src.split('?')[0];
        previewIframe.src = base + '?t=' + Date.now();
      }
    }
    if (paneEasy) {
      paneEasy.classList.toggle('visible', tab === 'easy');
      if (tab === 'easy') {
        if (typeof refreshSuggestionsList === 'function') refreshSuggestionsList();
        if (!_rulesState.model && RulesEditorAPI) {
          _rulesState = { model: RulesEditorAPI.defaultModel(), fullHtml: '', replaceStart: 0, replaceEnd: 0, heroStart: null, heroEnd: null };
          _rulesEasyDirty = false;
          renderStructuredEditor(_rulesState.model);
        } else {
          updatePreview();
        }
      }
    }
    paneSource.classList.toggle('visible', tab === 'source');
  }

  document.querySelectorAll('.rules-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchRulesTab(btn.dataset.rulesTab));
  });

  const rulesPreviewRefreshBtn = document.getElementById('rules-preview-refresh-btn');
  if (rulesPreviewRefreshBtn) {
    rulesPreviewRefreshBtn.addEventListener('click', () => {
      const iframe = document.getElementById('rules-preview-iframe');
      if (iframe && iframe.src) {
        const base = iframe.src.split('?')[0];
        iframe.src = base + '?t=' + Date.now();
      }
    });
  }

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
      let sha = currentSha;
      if (!sha) {
        const res = await ipc.invoke('github:getRulesFile');
        sha = res.sha || null;
      }
      await ipc.invoke('github:putRulesFile', {
        content,
        message: 'Update rules from Motion Hub',
        sha,
      });
      const { sha: newSha } = await ipc.invoke('github:getRulesFile');
      currentSha = newSha;
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
              const { sha } = await ipc.invoke('github:getRulesFile');
              currentSha = sha;
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
  let _rulesEasySha = null;
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
  const suggestionsDropdown = document.getElementById('rules-suggestions-dropdown');
  const refreshSuggestionsBtn = document.getElementById('rules-easy-refresh-suggestions-btn');
  const diffBtn = document.getElementById('rules-easy-diff-btn');
  const diffModal = document.getElementById('rules-diff-modal');
  const diffBody = document.getElementById('rules-diff-body');
  const diffCloseBtn = document.getElementById('rules-diff-close');

  let _suggestionsItems = [];

  function formatSuggestionLabel(item) {
    if (!item) return '';
    const d = item.submittedAt ? new Date(item.submittedAt) : null;
    const dateStr = d ? d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown date';
    return item.submittedBy ? `${dateStr} – ${item.submittedBy}` : dateStr;
  }

  async function refreshSuggestionsList() {
    const ipc = getIpc();
    if (!ipc) return;
    const result = await ipc.invoke('notes:fetchSuggestedRules');
    if (!result.ok || !Array.isArray(result.items)) {
      _suggestionsItems = [];
      if (suggestionsDropdown) {
        suggestionsDropdown.innerHTML = '<option value="">— Staff suggestions —</option>';
      }
      return;
    }
    _suggestionsItems = result.items;
    if (suggestionsDropdown) {
      suggestionsDropdown.innerHTML = '<option value="">— Staff suggestions —</option>';
      _suggestionsItems.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id || '';
        opt.textContent = formatSuggestionLabel(item);
        suggestionsDropdown.appendChild(opt);
      });
    }
  }

  function simpleLineDiff(liveHtml, suggestedHtml) {
    const a = (liveHtml || '').split(/\r?\n/);
    const b = (suggestedHtml || '').split(/\r?\n/);
    const out = [];
    const n = a.length;
    const m = b.length;
    const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    let i = n, j = m;
    const seq = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        seq.push({ type: 'common', line: a[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        seq.push({ type: 'add', line: b[j - 1] });
        j--;
      } else {
        seq.push({ type: 'remove', line: a[i - 1] });
        i--;
      }
    }
    seq.reverse();
    return seq;
  }

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
        const { content, sha } = await ipc.invoke('github:getRulesFile');
        _rulesEasySha = sha || null;
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

  function autoLoadRulesFromGitHub() {
    const ipc = getIpc();
    if (!ipc || !RulesEditorAPI) return;
    ipc.invoke('github:getRulesFile').then(({ content, sha }) => {
      if (!content) return;
      const parsed = RulesEditorAPI.parseRulesHtml(content);
      _rulesState = { model: parsed.model || RulesEditorAPI.defaultModel(), fullHtml: parsed.fullHtml || content, replaceStart: parsed.replaceStart ?? 0, replaceEnd: parsed.replaceEnd ?? content.length, heroStart: parsed.heroStart ?? null, heroEnd: parsed.heroEnd ?? null };
      _rulesEasySha = sha || null;
      _rulesEasyDirty = false;
      renderStructuredEditor(_rulesState.model);
      const sourceEl = document.getElementById('rules-source-editor');
      if (sourceEl) sourceEl.value = content;
    }).catch(() => {});
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
      const submittedBy = await ipc.invoke('app:getStaffHandle').catch(() => '');
      const result = await ipc.invoke('notes:submitSuggestedRules', { html, submittedBy: (submittedBy && String(submittedBy).trim()) || '' });
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
      const html = RulesEditorAPI && RulesEditorAPI.patchRulesIntoOriginalHtml
        ? RulesEditorAPI.patchRulesIntoOriginalHtml(model, _rulesState.fullHtml, _rulesState.replaceStart, _rulesState.replaceEnd, _rulesState.heroStart, _rulesState.heroEnd)
        : (RulesEditorAPI ? RulesEditorAPI.renderRulesHtml(model, _rulesState.fullHtml, _rulesState.replaceStart, _rulesState.replaceEnd, _rulesState.heroStart, _rulesState.heroEnd) : '');
      if (!html) return setEasyStatus('Could not build HTML.', true);
      setEasyStatus('Publishing…');
      try {
        let sha = _rulesEasySha;
        if (!sha) {
          const { sha: currentSha } = await ipc.invoke('github:getRulesFile');
          sha = currentSha;
        }
        await ipc.invoke('github:putRulesFile', { content: html, message: 'Update rules from Motion Hub (Easy Edit)', sha });
        _rulesEasyDirty = false;
        const { sha: newSha } = await ipc.invoke('github:getRulesFile');
        _rulesEasySha = newSha || null;
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
      const selectedId = suggestionsDropdown && suggestionsDropdown.value;
      let html = null;
      if (selectedId && _suggestionsItems.length) {
        const item = _suggestionsItems.find((s) => s.id === selectedId);
        if (item) html = item.html;
      }
      if (!html) {
        setEasyStatus('Refreshing list…');
        await refreshSuggestionsList();
        if (_suggestionsItems.length) {
          html = _suggestionsItems[0].html;
          if (suggestionsDropdown) suggestionsDropdown.value = _suggestionsItems[0].id || '';
        }
      }
      if (!html) return setEasyStatus('No suggestion selected. Pick one from the dropdown or refresh the list.', true);
      setEasyStatus('Loading staff suggestion…');
      const parsed = RulesEditorAPI ? RulesEditorAPI.parseRulesHtml(html) : { model: RulesEditorAPI.defaultModel(), fullHtml: html, replaceStart: 0, replaceEnd: html.length, heroStart: null, heroEnd: null };
      _rulesState = { model: parsed.model, fullHtml: parsed.fullHtml, replaceStart: parsed.replaceStart ?? 0, replaceEnd: parsed.replaceEnd ?? html.length, heroStart: parsed.heroStart ?? null, heroEnd: parsed.heroEnd ?? null };
      _rulesEasyDirty = false;
      renderStructuredEditor(_rulesState.model);
      setEasyStatus('Loaded staff suggestion. Review and click Publish to make it live.');
    });
  }

  if (refreshSuggestionsBtn) {
    refreshSuggestionsBtn.addEventListener('click', async () => {
      setEasyStatus('Refreshing suggestions…');
      await refreshSuggestionsList();
      setEasyStatus(_suggestionsItems.length ? `Loaded ${_suggestionsItems.length} suggestion(s). Pick one and click Load selected.` : 'No staff suggestions yet.');
    });
  }

  if (diffBtn) {
    diffBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setEasyStatus('Not available.', true);
      let suggestedHtml = null;
      const selectedId = suggestionsDropdown && suggestionsDropdown.value;
      if (selectedId && _suggestionsItems.length) {
        const item = _suggestionsItems.find((s) => s.id === selectedId);
        if (item) suggestedHtml = item.html;
      }
      if (!suggestedHtml && _rulesState.fullHtml) suggestedHtml = RulesEditorAPI ? RulesEditorAPI.renderRulesHtml(collectModelFromEditor() || _rulesState.model, _rulesState.fullHtml, _rulesState.replaceStart, _rulesState.replaceEnd, _rulesState.heroStart, _rulesState.heroEnd) : _rulesState.fullHtml;
      if (!suggestedHtml) return setEasyStatus('Load a suggestion first or select one from the dropdown.', true);
      setEasyStatus('Loading live rules for comparison…');
      try {
        const { content: liveHtml } = await ipc.invoke('github:getRulesFile');
        const seq = simpleLineDiff(liveHtml || '', suggestedHtml);
        if (!diffBody) return;
        diffBody.innerHTML = '';
        seq.forEach(({ type, line }) => {
          const div = document.createElement('div');
          div.className = 'diff-line diff-' + (type === 'add' ? 'add' : type === 'remove' ? 'remove' : 'common');
          div.textContent = (type === 'add' ? '+ ' : type === 'remove' ? '- ' : '  ') + (line || '');
          diffBody.appendChild(div);
        });
        if (diffModal) {
          diffModal.hidden = false;
        }
        setEasyStatus('');
      } catch (e) {
        setEasyStatus(e.message || 'Failed to load live rules.', true);
      }
    });
  }

  if (diffCloseBtn && diffModal) {
    diffCloseBtn.addEventListener('click', () => { diffModal.hidden = true; });
  }
  if (diffModal) {
    diffModal.addEventListener('click', (e) => { if (e.target === diffModal) diffModal.hidden = true; });
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

  autoLoadRulesFromGitHub();
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}

function parseStatsEditableRegions(content) {
  const result = { hero: '', upcoming: '', highlights: '', leaderboards: '', footer: '', fullContent: content, useMarkers: false, heroStart: -1, heroEnd: -1, upcomingStart: -1, upcomingEnd: -1, highlightsStart: -1, highlightsEnd: -1, leaderboardsStart: -1, leaderboardsEnd: -1, footerStart: -1, footerEnd: -1 };
  const markerHeroStart = '<!-- MOTION-HUB-EDIT hero -->';
  const markerHeroEnd = '<!-- /MOTION-HUB-EDIT hero -->';
  const markerUpcomingStart = '<!-- MOTION-HUB-EDIT upcoming -->';
  const markerUpcomingEnd = '<!-- /MOTION-HUB-EDIT upcoming -->';
  const markerHighlightsStart = '<!-- MOTION-HUB-EDIT highlights -->';
  const markerHighlightsEnd = '<!-- /MOTION-HUB-EDIT highlights -->';
  const markerLeaderboardsStart = '<!-- MOTION-HUB-EDIT leaderboards -->';
  const markerLeaderboardsEnd = '<!-- /MOTION-HUB-EDIT leaderboards -->';
  const markerFooterStart = '<!-- MOTION-HUB-EDIT footer -->';
  const markerFooterEnd = '<!-- /MOTION-HUB-EDIT footer -->';
  const i1 = content.indexOf(markerHeroStart);
  const i2 = content.indexOf(markerHeroEnd, i1);
  const i3 = content.indexOf(markerUpcomingStart);
  const i4 = content.indexOf(markerUpcomingEnd, i3);
  const i5 = content.indexOf(markerHighlightsStart);
  const i6 = content.indexOf(markerHighlightsEnd, i5);
  const i7 = content.indexOf(markerLeaderboardsStart);
  const i8 = content.indexOf(markerLeaderboardsEnd, i7);
  const i9 = content.indexOf(markerFooterStart);
  const i10 = content.indexOf(markerFooterEnd, i9);
  if (i1 !== -1 && i2 !== -1 && i3 !== -1 && i4 !== -1) {
    result.hero = content.substring(i1 + markerHeroStart.length, i2).replace(/^\n|\n$/g, '');
    result.upcoming = content.substring(i3 + markerUpcomingStart.length, i4).replace(/^\n|\n$/g, '');
    result.useMarkers = true;
    result.heroStart = i1;
    result.heroEnd = i2 + markerHeroEnd.length;
    result.upcomingStart = i3;
    result.upcomingEnd = i4 + markerUpcomingEnd.length;
    if (i5 !== -1 && i6 !== -1) {
      result.highlights = content.substring(i5 + markerHighlightsStart.length, i6).replace(/^\n|\n$/g, '');
      result.highlightsStart = i5;
      result.highlightsEnd = i6 + markerHighlightsEnd.length;
    }
    if (i7 !== -1 && i8 !== -1) {
      result.leaderboards = content.substring(i7 + markerLeaderboardsStart.length, i8).replace(/^\n|\n$/g, '');
      result.leaderboardsStart = i7;
      result.leaderboardsEnd = i8 + markerLeaderboardsEnd.length;
    }
    if (i9 !== -1 && i10 !== -1) {
      result.footer = content.substring(i9 + markerFooterStart.length, i10).replace(/^\n|\n$/g, '');
      result.footerStart = i9;
      result.footerEnd = i10 + markerFooterEnd.length;
    }
    return result;
  }
  const tournHeroIdx = content.indexOf("tourn-hero");
  if (tournHeroIdx !== -1) {
    const heroBlockStart = content.lastIndexOf('<div', tournHeroIdx);
    let shIdx = content.indexOf("<div class='sh'", tournHeroIdx);
    if (shIdx === -1) shIdx = content.indexOf('<div class="sh"', tournHeroIdx);
    if (shIdx !== -1 && shIdx > tournHeroIdx) {
      const beforeSh = content.substring(0, shIdx);
      const lastClose = beforeSh.lastIndexOf('</div>');
      if (lastClose > heroBlockStart) {
        result.hero = content.substring(heroBlockStart, lastClose + 6).trim();
        result.heroStart = heroBlockStart;
        result.heroEnd = lastClose + 6;
      }
    }
  }
  const tabUpcomingIdx = content.indexOf("id='tab-upcoming'");
  const tabUpcomingIdx2 = content.indexOf('id="tab-upcoming"');
  const upId = tabUpcomingIdx !== -1 ? tabUpcomingIdx : tabUpcomingIdx2;
  if (upId !== -1) {
    const sectionStart = content.lastIndexOf('<section', upId);
    const sectionEndIdx = content.indexOf('</section>', upId);
    if (sectionStart !== -1 && sectionEndIdx !== -1) {
      result.upcoming = content.substring(sectionStart, sectionEndIdx + '</section>'.length).trim();
      result.upcomingStart = sectionStart;
      result.upcomingEnd = sectionEndIdx + '</section>'.length;
    }
  }
  return result;
}

function buildStatsContentFromEdits(fullContent, heroHtml, upcomingHtml, highlightsHtml, leaderboardsHtml, footerHtml, parsed) {
  const markerHeroStart = '<!-- MOTION-HUB-EDIT hero -->';
  const markerHeroEnd = '<!-- /MOTION-HUB-EDIT hero -->';
  const markerUpcomingStart = '<!-- MOTION-HUB-EDIT upcoming -->';
  const markerUpcomingEnd = '<!-- /MOTION-HUB-EDIT upcoming -->';
  const markerHighlightsStart = '<!-- MOTION-HUB-EDIT highlights -->';
  const markerHighlightsEnd = '<!-- /MOTION-HUB-EDIT highlights -->';
  const markerLeaderboardsStart = '<!-- MOTION-HUB-EDIT leaderboards -->';
  const markerLeaderboardsEnd = '<!-- /MOTION-HUB-EDIT leaderboards -->';
  const markerFooterStart = '<!-- MOTION-HUB-EDIT footer -->';
  const markerFooterEnd = '<!-- /MOTION-HUB-EDIT footer -->';
  if (parsed.useMarkers) {
    let out = fullContent;
    if (parsed.footerStart >= 0 && parsed.footerEnd > parsed.footerStart) {
      out = out.substring(0, parsed.footerStart + markerFooterStart.length) + '\n' + (footerHtml != null ? footerHtml : parsed.footer) + '\n' + markerFooterEnd + out.substring(parsed.footerEnd);
    }
    if (parsed.leaderboardsStart >= 0 && parsed.leaderboardsEnd > parsed.leaderboardsStart) {
      out = out.substring(0, parsed.leaderboardsStart + markerLeaderboardsStart.length) + '\n' + (leaderboardsHtml != null ? leaderboardsHtml : parsed.leaderboards) + '\n' + markerLeaderboardsEnd + out.substring(parsed.leaderboardsEnd);
    }
    if (parsed.highlightsStart >= 0 && parsed.highlightsEnd > parsed.highlightsStart) {
      out = out.substring(0, parsed.highlightsStart + markerHighlightsStart.length) + '\n' + (highlightsHtml != null ? highlightsHtml : parsed.highlights) + '\n' + markerHighlightsEnd + out.substring(parsed.highlightsEnd);
    }
    out = out.substring(0, parsed.upcomingStart + markerUpcomingStart.length) + '\n' + (upcomingHtml != null ? upcomingHtml : parsed.upcoming) + '\n' + markerUpcomingEnd + out.substring(parsed.upcomingEnd);
    out = out.substring(0, parsed.heroStart + markerHeroStart.length) + '\n' + (heroHtml != null ? heroHtml : parsed.hero) + '\n' + markerHeroEnd + out.substring(parsed.heroEnd);
    return out;
  }
  let out = fullContent;
  if (parsed.footerStart >= 0 && parsed.footerEnd > parsed.footerStart && footerHtml != null) {
    out = out.substring(0, parsed.footerStart) + footerHtml + out.substring(parsed.footerEnd);
  }
  if (parsed.leaderboardsStart >= 0 && parsed.leaderboardsEnd > parsed.leaderboardsStart && leaderboardsHtml != null) {
    out = out.substring(0, parsed.leaderboardsStart) + leaderboardsHtml + out.substring(parsed.leaderboardsEnd);
  }
  if (parsed.highlightsStart >= 0 && parsed.highlightsEnd > parsed.highlightsStart && highlightsHtml != null) {
    out = out.substring(0, parsed.highlightsStart) + highlightsHtml + out.substring(parsed.highlightsEnd);
  }
  if (parsed.upcomingStart >= 0 && parsed.upcomingEnd > parsed.upcomingStart && upcomingHtml != null) {
    out = out.substring(0, parsed.upcomingStart) + upcomingHtml + out.substring(parsed.upcomingEnd);
  }
  if (parsed.heroStart >= 0 && parsed.heroEnd > parsed.heroStart && heroHtml != null) {
    out = out.substring(0, parsed.heroStart) + heroHtml + out.substring(parsed.heroEnd);
  }
  return out;
}

function setupStatsEditor() {
  const tabPreview = document.querySelector('.stats-tab[data-stats-tab="preview"]');
  const tabEdit = document.querySelector('.stats-tab[data-stats-tab="edit"]');
  const panePreview = document.getElementById('stats-preview-pane');
  const paneEdit = document.getElementById('stats-edit-pane');
  const paneSource = document.getElementById('stats-source-pane');
  const loadBtn = document.getElementById('stats-load-btn');
  const publishBtn = document.getElementById('stats-publish-btn');
  const statusEl = document.getElementById('stats-edit-status');
  const insertMarkersBtn = document.getElementById('stats-insert-markers-btn');
  const previewWrap = document.getElementById('stats-easy-preview-wrap');
  const previewIframe = document.getElementById('stats-easy-preview-iframe');
  const splitEl = document.getElementById('stats-easy-split');
  const resizerEl = document.getElementById('stats-easy-resizer');
  if (!tabEdit || !paneEdit) return;

  let statsFullContent = '';
  let statsSha = null;
  let statsParsed = null;
  let _statsPreviewDebounce = null;
  const STATS_PREVIEW_DEBOUNCE_MS = 200;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#f87171' : '';
  }

  /** Show only Easy Edit sections that exist in the loaded stats HTML. */
  function updateStatsEditorSectionVisibility(parsed) {
    const hint = document.getElementById('stats-easy-load-hint');
    const sectionsContainer = document.getElementById('stats-easy-sections');
    if (!sectionsContainer) return;
    const sections = sectionsContainer.querySelectorAll('.stats-edit-section[data-stats-section]');
    const has = (name) => {
      if (!parsed) return false;
      if (name === 'hero') return parsed.heroStart >= 0 && parsed.heroEnd > parsed.heroStart;
      if (name === 'upcoming') return parsed.upcomingStart >= 0 && parsed.upcomingEnd > parsed.upcomingStart;
      if (name === 'highlights') return parsed.highlightsStart >= 0 && parsed.highlightsEnd > parsed.highlightsStart;
      if (name === 'leaderboards') return parsed.leaderboardsStart >= 0 && parsed.leaderboardsEnd > parsed.leaderboardsStart;
      if (name === 'footer') return parsed.footerStart >= 0 && parsed.footerEnd > parsed.footerStart;
      return false;
    };
    if (!parsed || (parsed.heroStart < 0 && parsed.upcomingStart < 0 && parsed.highlightsStart < 0 && parsed.leaderboardsStart < 0 && parsed.footerStart < 0)) {
      if (hint) hint.style.display = '';
      sections.forEach((el) => { el.style.display = 'none'; });
      return;
    }
    if (hint) hint.style.display = 'none';
    sections.forEach((el) => {
      const name = el.getAttribute('data-stats-section');
      el.style.display = has(name) ? '' : 'none';
    });
    // Within hero section, show only fields that exist in the loaded HTML
    const heroSection = sectionsContainer.querySelector('.stats-edit-section[data-stats-section="hero"]');
    if (heroSection && parsed && has('hero') && typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.getHeroShape && parsed.hero) {
      const shape = StatsEditorAPI.getHeroShape(parsed.hero);
      const badgeOrder = ['season', 'formats', 'game', 'open'];
      heroSection.querySelectorAll('[data-stats-hero-field]').forEach((el) => {
        const field = el.getAttribute('data-stats-hero-field');
        let show = true;
        if (field === 'tagline') show = shape.hasTagline;
        else if (field === 'title') show = shape.hasTitle;
        else if (field === 'subtitle') show = shape.hasSubtitle;
        else if (badgeOrder.includes(field)) show = badgeOrder.indexOf(field) < shape.badgeCount;
        el.style.display = show ? '' : 'none';
      });
    } else if (heroSection) {
      heroSection.querySelectorAll('[data-stats-hero-field]').forEach((el) => { el.style.display = ''; });
    }
    if (parsed && (has('hero') || has('upcoming') || has('highlights') || has('leaderboards') || has('footer'))) {
      debouncedUpdateStatsPreview();
    }
  }

  function collectStatsModelFromEditor() {
    const def = typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.defaultStatsModel ? StatsEditorAPI.defaultStatsModel() : { hero: {}, upcoming: {}, leaderboards: {}, footer: {} };
    const g = (id) => { const el = document.getElementById(id); return el && el.value != null ? el.value.trim() : ''; };
    return {
      hero: {
        tagline: g('stats-hero-tagline') || (def.hero && def.hero.tagline) || '',
        title: g('stats-hero-title') || (def.hero && def.hero.title) || 'MOTION',
        subtitle: g('stats-hero-subtitle') || (def.hero && def.hero.subtitle) || '',
        seasonLabel: g('stats-hero-season') || (def.hero && def.hero.seasonLabel) || '',
        formatsLabel: g('stats-hero-formats') || (def.hero && def.hero.formatsLabel) || '',
        gameLabel: g('stats-hero-game') || (def.hero && def.hero.gameLabel) || '',
        openLabel: g('stats-hero-open') || (def.hero && def.hero.openLabel) || ''
      },
      upcoming: {
        title: g('stats-upcoming-title') || (def.upcoming && def.upcoming.title) || 'Upcoming',
        bodyText: g('stats-upcoming-body') || (def.upcoming && def.upcoming.bodyText) || ''
      },
      highlights: {
        title: g('stats-highlights-title') || (def.highlights && def.highlights.title) || '',
        bodyText: g('stats-highlights-body') || (def.highlights && def.highlights.bodyText) || ''
      },
      leaderboards: {
        title: g('stats-leaderboards-title') || (def.leaderboards && def.leaderboards.title) || '',
        description: g('stats-leaderboards-description') || (def.leaderboards && def.leaderboards.description) || ''
      },
      footer: {
        text: g('stats-footer-text') || (def.footer && def.footer.text) || ''
      }
    };
  }

  function fillStatsEditorFromModel(model) {
    if (!model) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
    if (model.hero) {
      set('stats-hero-tagline', model.hero.tagline);
      set('stats-hero-title', model.hero.title);
      set('stats-hero-subtitle', model.hero.subtitle);
      set('stats-hero-season', model.hero.seasonLabel);
      set('stats-hero-formats', model.hero.formatsLabel);
      set('stats-hero-game', model.hero.gameLabel);
      set('stats-hero-open', model.hero.openLabel);
    }
    if (model.upcoming) {
      set('stats-upcoming-title', model.upcoming.title);
      set('stats-upcoming-body', model.upcoming.bodyText);
    }
    if (model.highlights) {
      set('stats-highlights-title', model.highlights.title);
      set('stats-highlights-body', model.highlights.bodyText);
    }
    if (model.leaderboards) {
      set('stats-leaderboards-title', model.leaderboards.title);
      set('stats-leaderboards-description', model.leaderboards.description);
    }
    if (model.footer) {
      set('stats-footer-text', model.footer.text);
    }
  }

  const StatsEditorAPI = typeof StatsEditor !== 'undefined' ? StatsEditor : (typeof StatsEditorAPI !== 'undefined' ? StatsEditorAPI : null);

  function updateStatsPreview() {
    if (!previewIframe || !previewWrap || !StatsEditorAPI) return;
    try {
      const model = collectStatsModelFromEditor();
      // Same pattern as rules: always use minimal preview in iframe (renderStatsHtml with empty fullHtml returns minimal page)
      const html = StatsEditorAPI.renderStatsHtml(model, '', 0, 0);
      if (html) {
        previewIframe.srcdoc = html;
        previewWrap.classList.add('has-preview');
      }
    } catch (_) {}
  }

  function debouncedUpdateStatsPreview() {
    if (_statsPreviewDebounce) clearTimeout(_statsPreviewDebounce);
    _statsPreviewDebounce = setTimeout(updateStatsPreview, STATS_PREVIEW_DEBOUNCE_MS);
  }

  ['stats-hero-tagline', 'stats-hero-title', 'stats-hero-subtitle', 'stats-hero-season', 'stats-hero-formats', 'stats-hero-game', 'stats-hero-open', 'stats-upcoming-title', 'stats-upcoming-body', 'stats-highlights-title', 'stats-highlights-body', 'stats-leaderboards-title', 'stats-leaderboards-description', 'stats-footer-text'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', debouncedUpdateStatsPreview);
      el.addEventListener('change', debouncedUpdateStatsPreview);
    }
  });

  if (splitEl && resizerEl) {
    resizerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizerEl.classList.add('resizing');
      const startX = e.clientX;
      const editorEl = splitEl.querySelector('.stats-easy-editor');
      const startWidth = editorEl ? editorEl.getBoundingClientRect().width : splitEl.getBoundingClientRect().width / 2;
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

  const statsTokenInput = document.getElementById('stats-token-input');
  const statsTokenSave = document.getElementById('stats-token-save');
  if (statsTokenSave && statsTokenInput) {
    statsTokenSave.addEventListener('click', () => {
      const ipc = getIpc();
      if (!ipc) return;
      const token = (statsTokenInput.value || '').trim();
      ipc.invoke('github:setToken', token).then(() => {
        setStatus(token ? 'Token saved.' : 'Token cleared.');
      }).catch(() => setStatus('Failed to save token.', true));
    });
  }

  const statsPreviewRefreshBtn = document.getElementById('stats-preview-refresh-btn');
  if (statsPreviewRefreshBtn) {
    statsPreviewRefreshBtn.addEventListener('click', () => {
      const iframe = document.getElementById('stats-preview-iframe');
      if (iframe && iframe.src) {
        const base = iframe.src.split('?')[0];
        iframe.src = base + '?t=' + Date.now();
      }
    });
  }

  document.querySelectorAll('.stats-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.statsTab;
      document.querySelectorAll('.stats-tab').forEach((b) => b.classList.toggle('active', b.dataset.statsTab === tab));
      if (panePreview) panePreview.classList.toggle('visible', tab === 'preview');
      if (tab === 'preview') {
        const previewIframe = document.getElementById('stats-preview-iframe');
        if (previewIframe && previewIframe.src) {
          const base = previewIframe.src.split('?')[0];
          previewIframe.src = base + '?t=' + Date.now();
        }
      }
      if (paneEdit) paneEdit.classList.toggle('visible', tab === 'edit');
      if (paneSource) paneSource.classList.toggle('visible', tab === 'source');
      if (tab === 'edit') {
        updateStatsPreview(); // show preview immediately when switching to Easy Edit
      }
    });
  });

  // Show minimal preview as soon as Easy Edit is available (no GitHub load required)
  updateStatsPreview();
  updateStatsEditorSectionVisibility(statsParsed);

  if (insertMarkersBtn) {
    insertMarkersBtn.addEventListener('click', () => {
      if (!statsParsed || !statsFullContent) {
        setStatus('Load from GitHub first.', true);
        return;
      }
      if (statsParsed.useMarkers) {
        setStatus('Markers already present.', false);
        return;
      }
      if (statsParsed.heroStart < 0 || statsParsed.upcomingStart < 0) {
        setStatus('Could not find hero or upcoming in the file. Add them manually or check the HTML.', true);
        return;
      }
      const markerHeroStart = '<!-- MOTION-HUB-EDIT hero -->';
      const markerHeroEnd = '<!-- /MOTION-HUB-EDIT hero -->';
      const markerUpcomingStart = '<!-- MOTION-HUB-EDIT upcoming -->';
      const markerUpcomingEnd = '<!-- /MOTION-HUB-EDIT upcoming -->';
      const heroHtml = (typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.renderStatsHero)
        ? StatsEditorAPI.renderStatsHero(collectStatsModelFromEditor().hero)
        : (statsParsed.hero || '');
      const upcomingHtml = (typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.renderStatsUpcoming)
        ? StatsEditorAPI.renderStatsUpcoming(collectStatsModelFromEditor().upcoming)
        : (statsParsed.upcoming || '');
      const newContent =
        statsFullContent.substring(0, statsParsed.heroStart) +
        markerHeroStart + '\n' + heroHtml + '\n' + markerHeroEnd +
        statsFullContent.substring(statsParsed.heroEnd, statsParsed.upcomingStart) +
        markerUpcomingStart + '\n' + upcomingHtml + '\n' + markerUpcomingEnd +
        statsFullContent.substring(statsParsed.upcomingEnd);
      statsFullContent = newContent;
      statsParsed = parseStatsEditableRegions(newContent);
      setStatus('Markers inserted. Click Publish to save to GitHub.');
      updateStatsEditorSectionVisibility(statsParsed);
      updateStatsPreview();
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setStatus('Not available.', true);
      if (statsFullContent && !window.confirm('Load from GitHub? This will replace your current edits.')) return;
      setStatus('Loading…');
      try {
        const { content, sha } = await ipc.invoke('github:getStatsFile');
        statsFullContent = content;
        statsSha = sha;
        statsParsed = parseStatsEditableRegions(content);
        updateStatsEditorSectionVisibility(statsParsed);
        const model = (typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.parseStatsFromRegions)
          ? StatsEditorAPI.parseStatsFromRegions(statsParsed.hero || '', statsParsed.upcoming || '', statsParsed.highlights || '', statsParsed.leaderboards || '', statsParsed.footer || '')
          : (StatsEditorAPI && StatsEditorAPI.defaultStatsModel ? StatsEditorAPI.defaultStatsModel() : null);
        if (model) fillStatsEditorFromModel(model);
        if (!statsParsed.useMarkers && (statsParsed.heroStart < 0 || statsParsed.upcomingStart < 0)) {
          setStatus('Editable regions found (hero/upcoming). If sections are wrong, add MOTION-HUB-EDIT comments to the stats index.html.', false);
        } else {
          setStatus('Loaded. Edit fields, then Submit or Publish.');
        }
        updateStatsPreview();
      } catch (err) {
        setStatus(err.message || 'Load failed', true);
        statsSha = null;
        statsParsed = null;
        updateStatsEditorSectionVisibility(null);
      }
    });
  }

  const statsSubmitBtn = document.getElementById('stats-submit-btn');
  if (statsSubmitBtn) {
    statsSubmitBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setStatus('Not available.', true);
      if (!statsParsed || !statsFullContent) return setStatus('Load from GitHub first, then edit and Submit.', true);
      if (typeof StatsEditorAPI === 'undefined' || !StatsEditorAPI.renderStatsHero) return setStatus('Stats editor not loaded.', true);
      setStatus('Submitting…');
      try {
        const model = collectStatsModelFromEditor();
        const heroHtml = StatsEditorAPI.renderStatsHero(model.hero);
        const upcomingHtml = StatsEditorAPI.renderStatsUpcoming(model.upcoming);
        const highlightsHtml = (StatsEditorAPI.renderStatsHighlights && model.highlights) ? StatsEditorAPI.renderStatsHighlights(model.highlights) : null;
        const leaderboardsHtml = (StatsEditorAPI.renderStatsLeaderboards && model.leaderboards) ? StatsEditorAPI.renderStatsLeaderboards(model.leaderboards) : null;
        const footerHtml = (StatsEditorAPI.renderStatsFooter && model.footer) ? StatsEditorAPI.renderStatsFooter(model.footer) : null;
        const newContent = buildStatsContentFromEdits(statsFullContent, heroHtml, upcomingHtml, highlightsHtml, leaderboardsHtml, footerHtml, statsParsed);
        const result = await ipc.invoke('notes:submitSuggestedStats', newContent);
        setStatus(result.ok ? 'Suggested changes submitted. Master can review and publish.' : (result.error || 'Submit failed'), !result.ok);
      } catch (err) {
        setStatus(err.message || 'Submit failed', true);
      }
    });
  }

  const statsLoadSuggestedBtn = document.getElementById('stats-load-suggested-btn');
  if (statsLoadSuggestedBtn) {
    statsLoadSuggestedBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setStatus('Not available.', true);
      setStatus('Loading…');
      try {
        const result = await ipc.invoke('notes:fetchSuggestedStats');
        if (!result.ok || !result.html) return setStatus(result.error || 'No suggestion found.', true);
        statsFullContent = result.html;
        statsParsed = parseStatsEditableRegions(result.html);
        updateStatsEditorSectionVisibility(statsParsed);
        const model = (typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.parseStatsFromRegions)
          ? StatsEditorAPI.parseStatsFromRegions(statsParsed.hero || '', statsParsed.upcoming || '', statsParsed.highlights || '', statsParsed.leaderboards || '', statsParsed.footer || '')
          : (StatsEditorAPI && StatsEditorAPI.defaultStatsModel ? StatsEditorAPI.defaultStatsModel() : null);
        if (model) fillStatsEditorFromModel(model);
        setStatus('Loaded staff suggestion. Review and click Publish to make it live.');
        updateStatsPreview();
      } catch (err) {
        setStatus(err.message || 'Load failed', true);
      }
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setStatus('Not available.', true);
      if (!statsParsed || !statsFullContent) {
        setStatus('Load from GitHub first, then edit and Publish.', true);
        return;
      }
      if (typeof StatsEditorAPI === 'undefined' || !StatsEditorAPI.renderStatsHero || !StatsEditorAPI.renderStatsUpcoming) {
        setStatus('Stats editor not loaded.', true);
        return;
      }
      setStatus('Publishing…');
      try {
        const model = collectStatsModelFromEditor();
        // Patch model into original region HTML so published page keeps current format
        const heroHtml = (StatsEditorAPI.patchStatsHeroIntoOriginal && statsParsed.hero)
          ? StatsEditorAPI.patchStatsHeroIntoOriginal(statsParsed.hero, model.hero)
          : StatsEditorAPI.renderStatsHero(model.hero);
        const upcomingHtml = (StatsEditorAPI.patchStatsUpcomingIntoOriginal && statsParsed.upcoming)
          ? StatsEditorAPI.patchStatsUpcomingIntoOriginal(statsParsed.upcoming, model.upcoming)
          : StatsEditorAPI.renderStatsUpcoming(model.upcoming);
        const highlightsHtml = (StatsEditorAPI.patchStatsHighlightsIntoOriginal && statsParsed.highlights && model.highlights)
          ? StatsEditorAPI.patchStatsHighlightsIntoOriginal(statsParsed.highlights, model.highlights)
          : (StatsEditorAPI.renderStatsHighlights && model.highlights) ? StatsEditorAPI.renderStatsHighlights(model.highlights) : null;
        const leaderboardsHtml = (StatsEditorAPI.patchStatsLeaderboardsIntoOriginal && statsParsed.leaderboards && model.leaderboards)
          ? StatsEditorAPI.patchStatsLeaderboardsIntoOriginal(statsParsed.leaderboards, model.leaderboards)
          : (StatsEditorAPI.renderStatsLeaderboards && model.leaderboards) ? StatsEditorAPI.renderStatsLeaderboards(model.leaderboards) : null;
        const footerHtml = (StatsEditorAPI.patchStatsFooterIntoOriginal && statsParsed.footer && model.footer)
          ? StatsEditorAPI.patchStatsFooterIntoOriginal(statsParsed.footer, model.footer)
          : (StatsEditorAPI.renderStatsFooter && model.footer) ? StatsEditorAPI.renderStatsFooter(model.footer) : null;
        const newContent = buildStatsContentFromEdits(statsFullContent, heroHtml, upcomingHtml, highlightsHtml, leaderboardsHtml, footerHtml, statsParsed);
        await ipc.invoke('github:putStatsFile', {
          content: newContent,
          message: 'Update stats page (hero + upcoming) from Motion Hub',
          sha: statsSha,
        });
        const { sha } = await ipc.invoke('github:getStatsFile');
        statsSha = sha;
        statsFullContent = newContent;
        statsParsed = parseStatsEditableRegions(newContent);
        updateStatsEditorSectionVisibility(statsParsed);
        setStatus('Published. Live site may take a minute to update.');
        updateStatsPreview();
      } catch (err) {
        setStatus(err.message || 'Publish failed', true);
      }
    });
  }

  // Stats Source pane (same pattern as rules source)
  let statsSourceSha = null;
  const statsSourceLoadBtn = document.getElementById('stats-source-load-btn');
  const statsSourcePublishBtn = document.getElementById('stats-source-publish-btn');
  const statsSourceEditor = document.getElementById('stats-source-editor');
  const statsSourceStatus = document.getElementById('stats-source-status');
  const statsSourceTokenSave = document.getElementById('stats-source-token-save');
  const statsSourceTokenInput = document.getElementById('stats-source-token-input');

  function setSourceStatus(msg, isError) {
    if (statsSourceStatus) {
      statsSourceStatus.textContent = msg || '';
      statsSourceStatus.style.color = isError ? '#f87171' : '';
    }
  }

  if (statsSourceLoadBtn) {
    statsSourceLoadBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setSourceStatus('Not available.', true);
      setSourceStatus('Loading…');
      try {
        const { content, sha } = await ipc.invoke('github:getStatsFile');
        statsSourceSha = sha;
        if (statsSourceEditor) statsSourceEditor.value = content;
        setSourceStatus('Loaded. Edit the HTML and click Publish to save.');
      } catch (err) {
        setSourceStatus(err.message || 'Load failed', true);
      }
    });
  }

  if (statsSourcePublishBtn && statsSourceEditor) {
    statsSourcePublishBtn.addEventListener('click', async () => {
      const ipc = getIpc();
      if (!ipc) return setSourceStatus('Not available.', true);
      setSourceStatus('Publishing…');
      try {
        await ipc.invoke('github:putStatsFile', {
          content: statsSourceEditor.value,
          message: 'Update stats page from Motion Hub (source edit)',
          sha: statsSourceSha,
        });
        const { sha } = await ipc.invoke('github:getStatsFile');
        statsSourceSha = sha;
        setSourceStatus('Published. Live site may take a minute to update.');
      } catch (err) {
        setSourceStatus(err.message || 'Publish failed', true);
      }
    });
  }

  if (statsSourceTokenSave && statsSourceTokenInput) {
    statsSourceTokenSave.addEventListener('click', () => {
      const ipc = getIpc();
      if (!ipc) return;
      const token = (statsSourceTokenInput.value || '').trim();
      ipc.invoke('github:setToken', token).then(() => {
        setSourceStatus(token ? 'Token saved.' : 'Token cleared.');
      }).catch(() => setSourceStatus('Failed to save token.', true));
    });
  }

  function autoLoadStatsFromGitHub() {
    const ipc = getIpc();
    if (!ipc) return;
    ipc.invoke('github:getStatsFile').then(({ content, sha }) => {
      if (!content) return;
      statsFullContent = content;
      statsSha = sha;
      statsParsed = parseStatsEditableRegions(content);
      updateStatsEditorSectionVisibility(statsParsed);
      const model = (typeof StatsEditorAPI !== 'undefined' && StatsEditorAPI.parseStatsFromRegions)
        ? StatsEditorAPI.parseStatsFromRegions(statsParsed.hero || '', statsParsed.upcoming || '', statsParsed.highlights || '', statsParsed.leaderboards || '', statsParsed.footer || '')
        : (StatsEditorAPI && StatsEditorAPI.defaultStatsModel ? StatsEditorAPI.defaultStatsModel() : null);
      if (model) fillStatsEditorFromModel(model);
      updateStatsPreview();
      if (statsSourceEditor) statsSourceEditor.value = content;
      statsSourceSha = sha;
    }).catch(() => {});
  }
  autoLoadStatsFromGitHub();
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.MOTION_HUB_BUILD === 'master') {
    document.body.classList.add('is-master');
    document.title = 'Motion Hub — Master';
    const brandSub = document.getElementById('brand-subtitle');
    if (brandSub) brandSub.textContent = 'Master Hub';
    const homeHeadline = document.getElementById('home-headline');
    if (homeHeadline) homeHeadline.textContent = 'Welcome to Motion Master Hub';
    const homeLead = document.getElementById('home-lead');
    if (homeLead) homeLead.textContent = 'Admin tools. Publish rules & stats, archive tournaments.';
  }
  setupNavigation();
  setupExternalLinks();
  applyDiscordLink();
  setupCheckForUpdates();
  setupStaffHandle();
  setupTournamentApp();
  setupNotesForm();
  setupRulesEditor();
  setupStatsEditor();
});


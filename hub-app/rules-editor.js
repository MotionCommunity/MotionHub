/**
 * Rules page: data model, parse HTML → model, render model → HTML.
 * Model supports: sections, rules (with num like "01" or "11.1"), formats, prizes, staff (with imageUrl).
 * Content allows: <strong>, <span class="flag"> (red), <span class="good"> (green).
 */
(function (global) {
  function defaultModel() {
    return {
      hero: { tagline: '// ROCKET LEAGUE ESPORTS COMMUNITY', title: 'MOTION', subtitle: 'Official Rules, Formats & Info — Read before you compete.', seasonLabel: 'SEASON 1 ACTIVE', formatsLabel: '2V2 · 3V3 · 4V4', gameLabel: 'ROCKET LEAGUE', openLabel: 'OPEN TO ALL RANKS' },
      formats: [
        { id: 'f1', icon: '⚡', name: '2V2', type: 'DOUBLES', detail: 'High-speed doubles. BO3 early rounds, BO5 semis and finals. Teams of 2 + 1 registered sub.' },
        { id: 'f2', icon: '🚀', name: '3V3', type: 'STANDARD', detail: 'The flagship format. Full team coordination. BO3 → BO5 finals. Our most common tournament.' },
        { id: 'f3', icon: '🔥', name: '4V4', type: 'CHAOS', detail: 'High chaos, high fun. BO3 throughout. Teams of 4 — all must be registered. No mid-series subs.' }
      ],
      seriesFormatText: 'Round 1 / QF: BO3\nSemifinals: BO5\nGrand Finals: BO5',
      bracketTypeText: 'Regular cups: Single Elim\nSeason finals: Double Elim\nWeekly cups: Single Elim\nCheck Discord for current event type.',
      serverSettingsText: 'Mutators: OFF\nRumble/Heatseeker: OFF\nServer region: Closest mutual\nLobby: Private / Password',
      ruleSections: [
        { id: 'rs1', categoryLabel: 'REGISTRATION & ELIGIBILITY', rules: [
          { id: 'r1', num: '01', title: 'Account Verification', contentHtml: 'All players must submit a <strong>Tracker.gg profile link</strong> during registration. Your account is verified by admins before the tournament. No link = no entry. No exceptions.' },
          { id: 'r2', num: '02', title: 'Main Accounts Only', contentHtml: '<span class="flag">Smurfing is an immediate permanent ban.</span> You must compete on the exact account you registered. Alt accounts, boosted accounts, or accounts with misrepresented ranks are forbidden across all formats.' },
          { id: 'r3', num: '03', title: 'One Team Per Player', contentHtml: 'Players may only be on <strong>one roster per tournament</strong>. Players found on multiple rosters are removed from both teams. Rosters lock at the registration deadline — no additions after that point.' },
          { id: 'r4', num: '04', title: 'Substitutes', contentHtml: 'Teams may register <strong>1 sub per team</strong> during sign-up. Sub must be registered before the tournament — no day-of additions unless an admin approves in writing before the first match.' }
        ]},
        { id: 'rs2', categoryLabel: 'MATCH RULES', rules: [
          { id: 'r5', num: '05', title: 'Lobby Creation', contentHtml: 'The <strong>higher seeded team</strong> creates the private lobby. Password is shared via Discord DM to opponent captain only. Default: closest mutual region. Region disputes go to admin before match starts.' },
          { id: 'r6', num: '06', title: 'Ready-Up Window', contentHtml: 'Teams have <strong>5 minutes</strong> after their match is called to be in the lobby. After 5 minutes, the opposing team may request a forfeit win. <span class="flag">This is strictly enforced.</span> Be ready before your match is called.' },
          { id: 'r7', num: '07', title: 'Substitutions Mid-Series', contentHtml: 'Subs may only swap <strong>between games</strong> in a series — never during a live game. For 4v4: all 4 players must be registered. No mid-series swaps in 4v4 under any circumstance.' },
          { id: 'r8', num: '08', title: 'Disconnections', contentHtml: 'If a player disconnects <strong>before a goal is scored</strong>, both teams may agree to replay that game. If a goal was already scored, the game continues. Full lobby crashes are reviewed by admin only.' }
        ]},
        { id: 'rs3', categoryLabel: 'SCORE REPORTING & DISPUTES', rules: [
          { id: 'r9', num: '09', title: 'Reporting Results', contentHtml: 'Winning team captain posts the final score + <strong>screenshot</strong> in <strong>#match-results</strong> within 5 minutes of the series ending. Losing captain confirms with ✅. Admin updates bracket.' },
          { id: 'r10', num: '10', title: 'Disputes', contentHtml: 'Disputes must be raised in <strong>#disputes within 10 minutes</strong> of result. Evidence required from both teams. Admin reviews and rules — decision is <span class="flag">final and immediate</span>. No further appeals.' }
        ]},
        { id: 'rs4', categoryLabel: 'CONDUCT', rules: [
          { id: 'r11', num: '11', title: 'Sportsmanship', contentHtml: 'Motion expects <span class="good">GGs</span>. Toxic behavior, harassment, slurs, or targeted abuse toward any player, admin, or spectator — in-game, Discord, or publicly — results in <span class="flag">immediate disqualification</span>.' },
          { id: 'r12', num: '12', title: 'Intentional Griefing', contentHtml: 'Intentional self-destruction, AFK play, or any deliberate attempt to throw a match is treated as a conduct violation. Admins may review replay footage. Confirmed griefers are <span class="flag">disqualified</span>.' },
          { id: 'r13', num: '13', title: 'Repeat Violations', contentHtml: 'First major violation = disqualification from current event. Repeated violations = <span class="flag">permanent server ban</span>. Motion is a community — protect it. Admins reserve the right to ban at any time for conduct deemed harmful to the community.' },
          { id: 'r14', num: '14', title: 'Admin Authority', contentHtml: 'All admin decisions are <strong>final</strong>. Continued public complaints after a final ruling may result in disciplinary action. Admins are volunteers — respect them. Contact an admin privately for any serious concerns.' }
        ]}
      ],
      prizes: { firstPlace: 'TBD — Check #announcements\nTrophy role + Champion role + Hall of Fame Status + any cash/prize for that event', secondPlace: 'TBD — Check #announcements\nRunner-up role', mvpText: 'The player with the highest Strength Rating across all matches (tracked via our stats system) receives the Tournament MVP role and a special callout in the results post.', eligibilityText: 'All team members on the registered roster are prize-eligible. Day-of additions or unregistered substitutes are not eligible for prizes. Prizes distributed within 72 hours of tournament completion.' },
      staff: [
        { id: 's1', role: 'HEAD ORGANIZER', name: 'Uncle Rico', discord: '@Uncle Rico', imageUrl: '' },
        { id: 's2', role: 'BRACKET ADMIN', name: 'Escanor', discord: '@Escanor', imageUrl: '' }
      ],
      contactProtocolText: 'For match disputes → DM Dispute Admin or post in #disputes. For bracket issues → DM Bracket Admin. For everything else → DM Head Organizer. Please do not spam multiple admins with the same issue.',
      socialsIntro: 'Every tournament is run through Discord. Join to register, get match updates, and connect with the Motion community.',
      footerText: 'Rules subject to change — check Discord for updates.\n© Motion Rules · All rights reserved.'
    };
  }

  function sanitizeContentHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    function keep(el) {
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'strong' || tag === 'b') return true;
      if (tag === 'span' && (el.className === 'flag' || el.className === 'good')) return true;
      return false;
    }
    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (keep(node)) {
          const out = node.cloneNode(false);
          node.childNodes.forEach(c => out.appendChild(sanitizeNode(c)));
          return out;
        }
        const frag = document.createDocumentFragment();
        node.childNodes.forEach(c => frag.appendChild(sanitizeNode(c)));
        return frag;
      }
      return document.createDocumentFragment();
    }
    const out = document.createDocumentFragment();
    div.childNodes.forEach(c => out.appendChild(sanitizeNode(c)));
    const o = document.createElement('div');
    o.appendChild(out);
    return o.innerHTML;
  }

  function parseRulesHtml(html) {
    const model = defaultModel();
    let heroStart = null;
    let heroEnd = null;
    if (!html || typeof html !== 'string') return { model, fullHtml: '', replaceStart: 0, replaceEnd: 0, heroStart, heroEnd };
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    if (!doc.body) return { model, fullHtml: html, replaceStart: 0, replaceEnd: html.length, heroStart, heroEnd };

    const fullHtml = html;
    let replaceStart = fullHtml.length;
    let replaceEnd = 0;

    const heroSectionEl = doc.querySelector('section.hero, .hero');
    if (heroSectionEl) {
      const heroOpen = fullHtml.indexOf('<section class="hero"');
      if (heroOpen < 0) {
        const alt = fullHtml.indexOf('<section class=\'hero\'');
        if (alt >= 0) {
          heroStart = alt;
          heroEnd = fullHtml.indexOf('</section>', fullHtml.indexOf('>', alt) + 1) + 10;
        }
      } else {
        heroStart = heroOpen;
        heroEnd = fullHtml.indexOf('</section>', fullHtml.indexOf('>', heroOpen) + 1) + 10;
      }
      const eyebrow = doc.querySelector('.hero-eyebrow');
      const titleEl = doc.querySelector('.hero-title');
      const subEl = doc.querySelector('.hero-sub');
      const badges = doc.querySelectorAll('.hero-badges .badge');
      model.hero = {
        tagline: (eyebrow && eyebrow.textContent.trim()) || model.hero.tagline || '',
        title: (titleEl && titleEl.textContent.trim().replace(/\s+/g, '')) || 'MOTION',
        subtitle: (subEl && subEl.textContent.trim()) || model.hero.subtitle || '',
        seasonLabel: (badges[0] && badges[0].textContent.trim()) || model.hero.seasonLabel || '',
        formatsLabel: (badges[1] && badges[1].textContent.trim()) || model.hero.formatsLabel || '',
        gameLabel: (badges[2] && badges[2].textContent.trim()) || model.hero.gameLabel || '',
        openLabel: (badges[3] && badges[3].textContent.trim()) || model.hero.openLabel || ''
      };
    } else {
      const taglineEl = doc.querySelector('.hero-tagline, .tagline');
      const titleEl = doc.querySelector('.hero-title, .hero h1, main h1');
      if (taglineEl || titleEl) {
        const subtitleEl = doc.querySelector('.hero-subtitle, .hero-sub, .hero p, .subtitle');
        const seasonEl = doc.querySelector('.hero-season-label, .season-label');
        const formatsEl = doc.querySelector('.hero-formats-label, .formats-label');
        const gameEl = doc.querySelector('.hero-game-label, .game-label');
        const openEl = doc.querySelector('.hero-open-label, .open-label');
        model.hero = {
          tagline: (taglineEl && taglineEl.textContent.trim()) || model.hero.tagline || '',
          title: (titleEl && titleEl.textContent.trim().replace(/\s+/g, '')) || 'MOTION',
          subtitle: (subtitleEl && subtitleEl.textContent.trim()) || model.hero.subtitle || '',
          seasonLabel: (seasonEl && seasonEl.textContent.trim()) || model.hero.seasonLabel || '',
          formatsLabel: (formatsEl && formatsEl.textContent.trim()) || model.hero.formatsLabel || '',
          gameLabel: (gameEl && gameEl.textContent.trim()) || model.hero.gameLabel || '',
          openLabel: (openEl && openEl.textContent.trim()) || model.hero.openLabel || ''
        };
      }
    }

    const formatCards = doc.querySelectorAll('.format-card');
    if (formatCards.length) {
      model.formats = [];
      formatCards.forEach((card, idx) => {
        const nameEl = card.querySelector('.format-name, .format-name span');
        const typeEl = card.querySelector('.format-type');
        const detailEl = card.querySelector('.format-detail');
        const iconEl = card.querySelector('.format-icon');
        model.formats.push({
          id: 'f' + (idx + 1),
          icon: (iconEl && iconEl.textContent.trim()) || ['⚡', '🚀', '🔥'][idx] || '',
          name: (nameEl && nameEl.textContent.trim()) || '',
          type: (typeEl && typeEl.textContent.trim()) || '',
          detail: (detailEl && detailEl.textContent.trim()) || ''
        });
      });
    }

    const ruleCards = doc.querySelectorAll('.rule-card');
    const rulesCats = doc.querySelectorAll('.rules-cat');
    if (ruleCards.length) {
      model.ruleSections = [];
      const grid = doc.querySelector('.rules-grid');
      const children = grid ? Array.from(grid.children) : Array.from(doc.querySelectorAll('.rules-cat, .rule-card'));
      let currentSection = null;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.classList && child.classList.contains('rules-cat')) {
          currentSection = { id: 'rs' + (model.ruleSections.length + 1), categoryLabel: child.textContent.trim(), rules: [] };
          model.ruleSections.push(currentSection);
        } else if (child.classList && child.classList.contains('rule-card') && currentSection) {
          const numEl = child.querySelector('.rule-num');
          const titleEl = child.querySelector('.rule-title');
          const textEl = child.querySelector('.rule-text');
          currentSection.rules.push({
            id: 'r' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            num: (numEl && numEl.textContent.trim()) || '',
            title: (titleEl && titleEl.textContent.trim()) || '',
            contentHtml: (textEl && textEl.innerHTML) ? sanitizeContentHtml(textEl.innerHTML) : ''
          });
        }
      }
      if (!model.ruleSections.length && ruleCards.length) {
        currentSection = { id: 'rs1', categoryLabel: 'RULES', rules: [] };
        model.ruleSections.push(currentSection);
        ruleCards.forEach(function (card) {
          const numEl = card.querySelector('.rule-num');
          const titleEl = card.querySelector('.rule-title');
          const textEl = card.querySelector('.rule-text');
          currentSection.rules.push({
            id: 'r' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            num: (numEl && numEl.textContent.trim()) || '',
            title: (titleEl && titleEl.textContent.trim()) || '',
            contentHtml: (textEl && textEl.innerHTML) ? sanitizeContentHtml(textEl.innerHTML) : ''
          });
        });
      }
    }

    const staffCards = doc.querySelectorAll('.staff-card');
    if (staffCards.length) {
      model.staff = [];
      staffCards.forEach((card, idx) => {
        const roleEl = card.querySelector('.staff-role');
        const nameEl = card.querySelector('.staff-name');
        const discordEl = card.querySelector('.staff-discord');
        const imgEl = card.querySelector('.staff-avatar img');
        model.staff.push({
          id: 's' + (idx + 1),
          role: (roleEl && roleEl.textContent.trim()) || '',
          name: (nameEl && nameEl.textContent.trim()) || '',
          discord: (discordEl && discordEl.textContent.trim()) || '',
          imageUrl: (imgEl && imgEl.src) || ''
        });
      });
    }

    const main = doc.querySelector('main, .main');
    if (main) {
      const openTag = fullHtml.indexOf('<main');
      if (openTag >= 0) {
        const afterOpen = fullHtml.indexOf('>', openTag) + 1;
        const closeTag = fullHtml.indexOf('</main>', afterOpen);
        if (afterOpen > 0 && closeTag > afterOpen) {
          replaceStart = afterOpen;
          replaceEnd = closeTag;
        }
      }
    }

    return { model, fullHtml, replaceStart, replaceEnd, heroStart, heroEnd };
  }

  function renderRuleCard(rule) {
    const content = (rule.contentHtml || '').trim();
    return '<div class="rule-card"><div class="rule-num">' + escapeHtml(rule.num) + '</div><div class="rule-body"><div class="rule-title">' + escapeHtml(rule.title) + '</div><div class="rule-text">' + content + '</div></div></div>';
  }

  function renderRuleSection(section) {
    let html = '<div class="rules-cat">' + escapeHtml(section.categoryLabel) + '</div>';
    (section.rules || []).forEach(r => { html += renderRuleCard(r); });
    return html;
  }

  function renderFormats(formats) {
    return (formats || []).map(f => '<div class="format-card"><span class="format-icon">' + escapeHtml(f.icon) + '</span><div class="format-name">' + escapeHtml(f.name) + '</div><div class="format-type">' + escapeHtml(f.type) + '</div><div class="format-detail">' + escapeHtml(f.detail) + '</div></div>').join('');
  }

  function renderStaff(staff) {
    return (staff || []).map(s => {
      const img = s.imageUrl ? '<img src="' + escapeHtml(s.imageUrl) + '" alt="">' : '<div style="background:var(--border);color:var(--muted);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;">?</div>';
      const placeholder = !s.imageUrl && (s.name || '').toLowerCase().indexOf('recruiting') >= 0 ? ' style="border-style:dashed;opacity:.5"' : '';
      const nameClass = (s.name || '').toLowerCase().indexOf('recruiting') >= 0 ? 'staff-name staff-placeholder' : 'staff-name';
      return '<div class="staff-card"' + placeholder + '><div class="staff-avatar">' + img + '</div><div class="staff-info"><div class="staff-role">' + escapeHtml(s.role) + '</div><div class="' + nameClass + '">' + escapeHtml(s.name) + '</div><div class="staff-discord">' + escapeHtml(s.discord) + '</div></div></div>';
    }).join('\n        ');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderHero(hero) {
    if (!hero) return '';
    const h = hero;
    const title = (h.title || 'MOTION').replace(/\s+/g, '');
    const titleWithSpan = title === 'MOTION' ? 'MOT<span>I</span>ON' : escapeHtml(title);
    return '<section class="hero">\n  <div class="hero-eyebrow">' + escapeHtml(h.tagline || '') + '</div>\n  <div class="hero-title">' + titleWithSpan + '</div>\n  <div class="hero-sub">' + escapeHtml(h.subtitle || '') + '</div>\n  <div class="hero-badges">\n    <div class="badge hot"> ' + escapeHtml(h.seasonLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.formatsLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.gameLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.openLabel || '') + '</div>\n  </div>\n</section>';
  }

  function getMainContentHtml(model) {
    const firstPlace = (model.prizes && model.prizes.firstPlace) || '';
    const secondPlace = (model.prizes && model.prizes.secondPlace) || '';
    const firstLines = firstPlace.split('\n');
    const secondLines = secondPlace.split('\n');
    const firstReward = firstLines[0] || 'TBD — Check #announcements';
    const firstNote = firstLines.slice(1).join('\n').trim() || 'Trophy role + Champion role + Hall of Fame Status + any cash/prize for that event';
    const secondReward = secondLines[0] || 'TBD — Check #announcements';
    const secondNote = secondLines.slice(1).join('\n').trim() || 'Runner-up role';
    return [
      '<section class="section" id="formats">\n    <div class="section-inner">\n      <div class="section-header">\n        <div class="section-tag">// 01 — GAME MODES</div>\n        <div class="section-title">FORMATS <span>&</span> MODES</div>\n        <div class="section-desc">Motion runs three competitive formats. Each has its own bracket, rules, and prize pool. Check Discord for which formats are active in the current season.</div>\n      </div>\n\n      <div class="format-grid">',
      renderFormats(model.formats),
      '</div>\n\n      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;margin-top:2px;">\n        <div style="background:var(--card);border:1px solid var(--border);padding:20px 24px;">\n          <div style="font-family:\'Share Tech Mono\',monospace;font-size:9px;letter-spacing:3px;color:var(--blue-l);margin-bottom:8px;">SERIES FORMAT</div>\n          <div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-line">' + escapeHtml(model.seriesFormatText || '') + '</div>\n        </div>\n        <div style="background:var(--card);border:1px solid var(--border);padding:20px 24px;">\n          <div style="font-family:\'Share Tech Mono\',monospace;font-size:9px;letter-spacing:3px;color:var(--blue-l);margin-bottom:8px;">BRACKET TYPE</div>\n          <div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-line">' + escapeHtml(model.bracketTypeText || '') + '</div>\n        </div>\n        <div style="background:var(--card);border:1px solid var(--border);padding:20px 24px;">\n          <div style="font-family:\'Share Tech Mono\',monospace;font-size:9px;letter-spacing:3px;color:var(--blue-l);margin-bottom:8px;">SERVER SETTINGS</div>\n          <div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-line">' + escapeHtml(model.serverSettingsText || '') + '</div>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class="section" id="rules">\n    <div class="section-inner">\n      <div class="section-header">\n        <div class="section-tag">// 02 — OFFICIAL RULESET</div>\n        <div class="section-title">THE <span>RULES</span></div>\n        <div class="section-desc">By registering for any Motion event you agree to every rule below. Admin decisions are final. These apply to all formats — 2v2, 3v3, and 4v4.</div>\n      </div>\n\n      <div class="rules-grid">\n\n',
      (model.ruleSections || []).map(renderRuleSection).join('\n        '),
      '\n      </div>\n    </div>\n  </section>\n\n  <section class="section" id="prizes">\n    <div class="section-inner">\n      <div class="section-header">\n        <div class="section-tag">// 03 — REWARDS</div>\n        <div class="section-title">PRIZE <span>POOL</span></div>\n        <div class="section-desc">Prize structure varies by event. Season finals will have a larger prize pool. Check #announcements for the exact prize breakdown for each tournament.</div>\n      </div>\n\n      <div class="prizes-wrap">\n        <div class="prize-card first">\n          <span class="prize-medal">🥇</span>\n          <div class="prize-place">1ST</div>\n          <div class="prize-name">GRAND CHAMPION</div>\n          <div class="prize-reward">' + escapeHtml(firstReward) + '</div>\n          <div class="prize-note">' + escapeHtml(firstNote) + '</div>\n        </div>\n        <div class="prize-card second">\n          <span class="prize-medal">🥈</span>\n          <div class="prize-place">2ND</div>\n          <div class="prize-name">RUNNER-UP</div>\n          <div class="prize-reward">' + escapeHtml(secondReward) + '</div>\n          <div class="prize-note">' + escapeHtml(secondNote) + '</div>\n        </div>\n      </div>\n\n      <div class="prize-info">\n        <strong>MVP Award:</strong> ' + escapeHtml((model.prizes && model.prizes.mvpText) || '') + '\n      </div>\n\n      <div class="prize-info" style="border-left-color:var(--gold);margin-top:2px;">\n        <strong style="color:var(--gold)">Prize Eligibility:</strong> ' + escapeHtml((model.prizes && model.prizes.eligibilityText) || '') + '\n      </div>\n    </div>\n  </section>\n\n  <section class="section" id="staff">\n    <div class="section-inner">\n      <div class="section-header">\n        <div class="section-tag">// 04 — THE TEAM</div>\n        <div class="section-title">STAFF <span>&</span> ADMINS</div>\n        <div class="section-desc">Our admin team runs every event. For match disputes or questions, DM the relevant admin directly. Do not post disputes in general chat.</div>\n      </div>\n\n      <div class="staff-grid">\n',
      renderStaff(model.staff),
      '\n      </div>\n\n      <div style="background:var(--card);border:1px solid var(--border);border-left:3px solid var(--blue-l);padding:16px 20px;margin-top:2px;font-size:14px;color:var(--text);line-height:1.7;">\n        <strong style="color:var(--blue-l)">Contact Protocol:</strong> ' + escapeHtml(model.contactProtocolText || '') + '\n      </div>\n    </div>\n  </section>'
    ].join('');
  }

  function getSectionsHtml(model) {
    return renderHero(model.hero) + '\n\n' + getMainContentHtml(model);
  }

  function getMinimalPreviewPage(sectionsHtml) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rules preview</title><style>' +
      'body{margin:0;background:#0a0e1a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;}' +
      '.section{padding:2rem 1.5rem;max-width:900px;margin:0 auto;}' +
      '.hero.section{padding:3rem 1.5rem 2rem;text-align:center;}' +
      '.hero-inner{max-width:640px;margin:0 auto;}' +
      '.hero-eyebrow,.hero-tagline{font-size:0.75rem;letter-spacing:0.15em;color:#38bdf8;margin-bottom:0.5rem;}' +
      '.hero-title{font-size:2.5rem;font-weight:800;margin:0 0 0.5rem;letter-spacing:0.2em;color:#f8fafc;}' +
      '.hero-sub,.hero-subtitle{font-size:1rem;color:#94a3b8;margin:0 0 1rem;}' +
      '.hero-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:1rem;}' +
      '.hero-badges .badge{font-size:0.8rem;letter-spacing:2px;padding:6px 12px;border:1px solid rgba(148,163,184,0.3);color:#94a3b8;}' +
      '.hero-badges .badge.hot{border-color:#38bdf8;color:#38bdf8;}' +
      '.hero-season-label,.hero-formats-label,.hero-game-label,.hero-open-label{font-size:0.8rem;color:#64748b;margin:0.25rem 0;}' +
      '.section-inner{background:rgba(15,23,42,0.8);border-radius:12px;padding:1.5rem;border:1px solid rgba(148,163,184,0.2);}' +
      '.section-tag{font-size:0.75rem;letter-spacing:0.1em;color:#38bdf8;margin-bottom:0.5rem;}' +
      '.section-title{font-size:1.5rem;margin:0 0 0.5rem;color:#f8fafc;}' +
      '.section-desc{color:#94a3b8;margin:0 0 1rem;font-size:0.95rem;}' +
      '.format-grid,.rules-grid,.staff-grid{display:grid;gap:1rem;}' +
      '.format-grid{grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}' +
      '.format-card{background:rgba(30,41,59,0.6);padding:1rem;border-radius:8px;border:1px solid rgba(148,163,184,0.15);}' +
      '.format-icon{font-size:1.5rem;}' +
      '.format-name{font-weight:700;color:#38bdf8;}' +
      '.format-type{font-size:0.85rem;color:#94a3b8;}' +
      '.format-detail{font-size:0.9rem;margin-top:0.25rem;}' +
      '.rules-cat{font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#38bdf8;margin:1rem 0 0.5rem;}' +
      '.rule-card{display:flex;gap:1rem;padding:0.75rem 0;border-bottom:1px solid rgba(148,163,184,0.15);}' +
      '.rule-num{flex-shrink:0;font-weight:700;color:#38bdf8;min-width:2.5rem;}' +
      '.rule-title{font-weight:600;margin-bottom:0.25rem;}' +
      '.rule-text{font-size:0.9rem;color:#cbd5e1;}' +
      '.rule-text .flag{color:#f87171;}' +
      '.rule-text .good{color:#22d98a;}' +
      '.prizes-wrap{display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;}' +
      '.prize-card{padding:1rem;border-radius:8px;min-width:180px;}' +
      '.prize-card.first{background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.05));border:1px solid rgba(34,197,94,0.4);}' +
      '.prize-card.second{background:rgba(148,163,184,0.1);border:1px solid rgba(148,163,184,0.2);}' +
      '.prize-place,.prize-name{font-weight:700;}' +
      '.prize-reward{font-size:0.9rem;white-space:pre-line;margin-top:0.5rem;}' +
      '.prize-info{margin-top:0.75rem;font-size:0.9rem;color:#94a3b8;}' +
      '.staff-card{display:flex;align-items:center;gap:1rem;padding:0.75rem;background:rgba(30,41,59,0.4);border-radius:8px;}' +
      '.staff-avatar img{width:48px;height:48px;border-radius:50%;object-fit:cover;}' +
      '.staff-role{font-size:0.8rem;color:#38bdf8;}' +
      '.staff-name{font-weight:600;}' +
      '.staff-discord{font-size:0.85rem;color:#94a3b8;}' +
      '</style></head><body><main>' + sectionsHtml + '</main></body></html>';
  }

  function renderRulesHtml(model, fullHtml, replaceStart, replaceEnd, heroStart, heroEnd) {
    if (replaceEnd > replaceStart && fullHtml) {
      let result = fullHtml.substring(0, replaceStart) + getMainContentHtml(model) + fullHtml.substring(replaceEnd);
      if (heroStart != null && heroEnd != null && heroStart >= 0 && heroEnd > heroStart) {
        result = result.substring(0, heroStart) + renderHero(model.hero) + result.substring(heroEnd);
      }
      return result;
    }
    return getMinimalPreviewPage(getSectionsHtml(model));
  }

  global.RulesEditor = {
    defaultModel,
    parseRulesHtml,
    renderRulesHtml,
    sanitizeContentHtml
  };
})(typeof window !== 'undefined' ? window : this);

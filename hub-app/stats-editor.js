/**
 * Stats page: data model, parse hero/upcoming HTML → model, render model → hero/upcoming HTML.
 * Editable parts only (hero + upcoming). Leaderboards and live stats are updated separately.
 */
(function (global) {
  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function defaultStatsModel() {
    return {
      hero: {
        tagline: '// TOURNAMENT STATS',
        title: 'MOTION',
        subtitle: 'Official tournament stats and Motion Rating™ leaderboards.',
        seasonLabel: 'SEASON 1 ACTIVE',
        formatsLabel: '2V2 · 3V3 · 4V4',
        gameLabel: 'ROCKET LEAGUE',
        openLabel: 'OPEN TO ALL RANKS'
      },
      upcoming: {
        title: 'Upcoming',
        bodyText: 'Next tournament TBD. Check Discord for dates and registration.'
      },
      highlights: {
        title: 'Tournament highlights',
        bodyText: 'Key stats and standings for the current event. Bracket and leaderboard data are updated automatically on the live site.'
      },
      leaderboards: {
        title: 'Motion Rating™ Leaderboard',
        description: 'Season standings. The table below is updated automatically.'
      },
      footer: {
        text: '© Motion · Join Discord for updates.\nStats subject to change — check Discord for the latest.'
      }
    };
  }

  function parseHeroHtml(heroHtml) {
    const hero = defaultStatsModel().hero;
    if (!heroHtml || typeof heroHtml !== 'string') return hero;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(heroHtml, 'text/html');
      if (!doc.body) return hero;
      const eyebrow = doc.querySelector('.hero-eyebrow, .hero-tagline, .tagline, [class*="eyebrow"]');
      const titleEl = doc.querySelector('.hero-title, .hero h1, h1');
      const subEl = doc.querySelector('.hero-sub, .hero-subtitle, .hero-sub, .hero p, .subtitle');
      const badges = doc.querySelectorAll('.hero-badges .badge, .badge, .hero-badges span, [class*="badge"]');
      hero.tagline = (eyebrow && eyebrow.textContent.trim()) || hero.tagline;
      hero.title = (titleEl && titleEl.textContent.trim().replace(/\s+/g, ' ').trim()) || hero.title;
      hero.subtitle = (subEl && subEl.textContent.trim()) || hero.subtitle;
      if (badges.length >= 1) hero.seasonLabel = badges[0].textContent.trim() || hero.seasonLabel;
      if (badges.length >= 2) hero.formatsLabel = badges[1].textContent.trim() || hero.formatsLabel;
      if (badges.length >= 3) hero.gameLabel = badges[2].textContent.trim() || hero.gameLabel;
      if (badges.length >= 4) hero.openLabel = badges[3].textContent.trim() || hero.openLabel;
    } catch (_) {}
    return hero;
  }

  function parseUpcomingHtml(upcomingHtml) {
    const upcoming = defaultStatsModel().upcoming;
    if (!upcomingHtml || typeof upcomingHtml !== 'string') return upcoming;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(upcomingHtml, 'text/html');
      if (!doc.body) return upcoming;
      const titleEl = doc.querySelector('h2, .section-title, .upcoming-title, h3');
      const bodyEl = doc.querySelector('p, .section-desc, .upcoming-body, .section-desc');
      const allText = doc.body.textContent || '';
      upcoming.title = (titleEl && titleEl.textContent.trim()) || upcoming.title;
      if (bodyEl) {
        upcoming.bodyText = bodyEl.textContent.trim() || upcoming.bodyText;
      } else if (titleEl && titleEl.nextElementSibling) {
        upcoming.bodyText = titleEl.nextElementSibling.textContent.trim() || upcoming.bodyText;
      } else {
        const p = doc.querySelector('p');
        upcoming.bodyText = (p && p.textContent.trim()) || allText.trim().slice(0, 500) || upcoming.bodyText;
      }
    } catch (_) {}
    return upcoming;
  }

  function parseHighlightsHtml(html) {
    const h = defaultStatsModel().highlights;
    if (!html || typeof html !== 'string') return h;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (!doc.body) return h;
      const titleEl = doc.querySelector('h2, .section-title, .highlights-title, h3');
      const bodyEl = doc.querySelector('.section-desc, p, .highlights-body');
      h.title = (titleEl && titleEl.textContent.trim()) || h.title;
      if (bodyEl) h.bodyText = bodyEl.textContent.trim() || h.bodyText;
      else h.bodyText = (doc.body.textContent || '').trim().slice(0, 800) || h.bodyText;
    } catch (_) {}
    return h;
  }

  function parseLeaderboardsHtml(html) {
    const lb = defaultStatsModel().leaderboards;
    if (!html || typeof html !== 'string') return lb;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (!doc.body) return lb;
      const titleEl = doc.querySelector('h2, .section-title, .leaderboard-title, h3');
      const descEl = doc.querySelector('.section-desc, .leaderboard-desc, p');
      lb.title = (titleEl && titleEl.textContent.trim()) || lb.title;
      if (descEl) lb.description = descEl.textContent.trim() || lb.description;
    } catch (_) {}
    return lb;
  }

  function parseFooterHtml(html) {
    const f = defaultStatsModel().footer;
    if (!html || typeof html !== 'string') return f;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (!doc.body) return f;
      f.text = (doc.body.textContent || '').trim().slice(0, 1000) || f.text;
    } catch (_) {}
    return f;
  }

  function parseStatsFromRegions(heroHtml, upcomingHtml, highlightsHtml, leaderboardsHtml, footerHtml) {
    const model = defaultStatsModel();
    model.hero = parseHeroHtml(heroHtml || '');
    model.upcoming = parseUpcomingHtml(upcomingHtml || '');
    model.highlights = parseHighlightsHtml(highlightsHtml || '');
    model.leaderboards = parseLeaderboardsHtml(leaderboardsHtml || '');
    model.footer = parseFooterHtml(footerHtml || '');
    return model;
  }

  function renderStatsHero(hero) {
    if (!hero) return '';
    const h = hero;
    const title = (h.title || 'MOTION').replace(/\s+/g, ' ').trim();
    const titleWithSpan = title === 'MOTION' ? 'MOT<span>I</span>ON' : escapeHtml(title);
    return '<section class="hero">\n  <div class="hero-eyebrow">' + escapeHtml(h.tagline || '') + '</div>\n  <div class="hero-title">' + titleWithSpan + '</div>\n  <div class="hero-sub">' + escapeHtml(h.subtitle || '') + '</div>\n  <div class="hero-badges">\n    <div class="badge hot">' + escapeHtml(h.seasonLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.formatsLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.gameLabel || '') + '</div>\n    <div class="badge">' + escapeHtml(h.openLabel || '') + '</div>\n  </div>\n</section>';
  }

  function renderStatsUpcoming(upcoming) {
    if (!upcoming) return '';
    const u = upcoming;
    const title = escapeHtml(u.title || 'Upcoming');
    const body = escapeHtml((u.bodyText || '').trim()).replace(/\n/g, '<br>\n');
    return '<section class="section" id="tab-upcoming">\n  <div class="section-inner">\n    <div class="section-header">\n      <div class="section-title">' + title + '</div>\n      <div class="section-desc">' + body + '</div>\n    </div>\n  </div>\n</section>';
  }

  function renderStatsHighlights(highlights) {
    if (!highlights) return '';
    const h = highlights;
    const title = escapeHtml(h.title || 'Tournament highlights');
    const body = escapeHtml((h.bodyText || '').trim()).replace(/\n/g, '<br>\n');
    return '<section class="section" id="tab-highlights">\n  <div class="section-inner">\n    <div class="section-header">\n      <div class="section-title">' + title + '</div>\n      <div class="section-desc">' + body + '</div>\n    </div>\n  </div>\n</section>';
  }

  function renderStatsLeaderboards(leaderboards) {
    if (!leaderboards) return '';
    const lb = leaderboards;
    const title = escapeHtml(lb.title || 'Leaderboard');
    const desc = escapeHtml((lb.description || '').trim()).replace(/\n/g, '<br>\n');
    return '<section class="section" id="tab-leaderboard">\n  <div class="section-inner">\n    <div class="section-header">\n      <div class="section-title">' + title + '</div>\n      <div class="section-desc">' + desc + '</div>\n    </div>\n  </div>\n</section>';
  }

  function renderStatsFooter(footer) {
    if (!footer || !footer.text) return '';
    const text = escapeHtml((footer.text || '').trim()).replace(/\n/g, '<br>\n');
    return '<footer class="stats-footer">\n  <div class="section-inner">\n    <div class="section-desc">' + text + '</div>\n  </div>\n</footer>';
  }

  function getSectionsHtml(model) {
    return renderStatsHero(model && model.hero) + '\n\n' +
      renderStatsUpcoming(model && model.upcoming) + '\n\n' +
      renderStatsHighlights(model && model.highlights) + '\n\n' +
      renderStatsLeaderboards(model && model.leaderboards) + '\n\n' +
      renderStatsFooter(model && model.footer);
  }

  function getMinimalStatsPreviewPage(sectionsHtml) {
    const content = sectionsHtml != null && sectionsHtml !== '' ? sectionsHtml : getSectionsHtml(defaultStatsModel());
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stats preview</title><style>' +
      'body{margin:0;background:#0a0e1a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;}' +
      '.section{padding:2rem 1.5rem;max-width:900px;margin:0 auto;}' +
      '.hero.section{padding:3rem 1.5rem 2rem;text-align:center;}' +
      '.hero-inner{max-width:640px;margin:0 auto;}' +
      '.hero-eyebrow,.hero-tagline{font-size:0.75rem;letter-spacing:0.15em;color:#38bdf8;margin-bottom:0.5rem;}' +
      '.hero-title{font-size:2.5rem;font-weight:800;margin:0 0 0.5rem;letter-spacing:0.2em;color:#f8fafc;}' +
      '.hero-title span{color:#38bdf8;}' +
      '.hero-sub,.hero-subtitle{font-size:1rem;color:#94a3b8;margin:0 0 1rem;}' +
      '.hero-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:1rem;}' +
      '.hero-badges .badge{font-size:0.8rem;letter-spacing:2px;padding:6px 12px;border:1px solid rgba(148,163,184,0.3);color:#94a3b8;border-radius:4px;}' +
      '.hero-badges .badge.hot{border-color:#38bdf8;color:#38bdf8;}' +
      '.section-inner{background:rgba(15,23,42,0.8);border-radius:12px;padding:1.5rem;border:1px solid rgba(148,163,184,0.2);}' +
      '.section-tag{font-size:0.75rem;letter-spacing:0.1em;color:#38bdf8;margin-bottom:0.5rem;}' +
      '.section-title{font-size:1.5rem;margin:0 0 0.5rem;color:#f8fafc;}' +
      '.section-desc{color:#94a3b8;margin:0 0 1rem;font-size:0.95rem;}' +
      '.section-desc br{margin:0.25em 0;}' +
      '.stats-footer{margin-top:2rem;padding:1.5rem;text-align:center;border-top:1px solid rgba(148,163,184,0.2);}' +
      '.stats-footer .section-desc{font-size:0.85rem;margin:0;}' +
      '</style></head><body><main>' + content + '</main></body></html>';
  }

  function renderStatsHtml(model, fullHtml, replaceStart, replaceEnd, heroStart, heroEnd) {
    if (replaceEnd > replaceStart && fullHtml) {
      let result = fullHtml.substring(0, replaceStart) + renderStatsUpcoming(model && model.upcoming) + fullHtml.substring(replaceEnd);
      if (heroStart != null && heroEnd != null && heroStart >= 0 && heroEnd > heroStart) {
        result = result.substring(0, heroStart) + renderStatsHero(model && model.hero) + result.substring(heroEnd);
      }
      return result;
    }
    return getMinimalStatsPreviewPage(getSectionsHtml(model));
  }

  /** Detect which hero elements exist in the loaded HTML so Easy Edit only shows those fields. */
  function getHeroShape(heroHtml) {
    const out = { hasTagline: true, hasTitle: true, hasSubtitle: true, badgeCount: 4 };
    if (!heroHtml || typeof heroHtml !== 'string') return out;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(heroHtml, 'text/html');
      if (!doc.body) return out;
      out.hasTagline = !!doc.querySelector('.hero-eyebrow, .hero-tagline, .tagline, [class*="eyebrow"], [class*="tagline"]');
      out.hasTitle = !!doc.querySelector('.hero-title, .hero h1, h1, [class*="title"]');
      out.hasSubtitle = !!doc.querySelector('.hero-sub, .hero-subtitle, .hero p, .subtitle, [class*="subtitle"], [class*="hero-sub"]');
      const badges = doc.querySelectorAll('.hero-badges .badge, .badge, .hero-badges span, [class*="badge"]');
      out.badgeCount = Math.min(badges.length, 4);
    } catch (_) {}
    return out;
  }

  /** Patch model values into original region HTML to preserve format when publishing. */
  function patchStatsHeroIntoOriginal(heroHtml, hero) {
    if (!heroHtml || !hero) return heroHtml;
    const parser = new DOMParser();
    const doc = parser.parseFromString(heroHtml, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return heroHtml;
    const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val != null ? val : ''; };
    const eyebrow = root.querySelector('.hero-eyebrow, .hero-tagline, .tagline, [class*="eyebrow"]');
    if (eyebrow) eyebrow.textContent = hero.tagline || '';
    const titleEl = root.querySelector('.hero-title, .hero h1, h1');
    if (titleEl) titleEl.textContent = (hero.title || 'MOTION').replace(/\s+/g, ' ').trim();
    const subEl = root.querySelector('.hero-sub, .hero-subtitle, .hero p, .subtitle');
    if (subEl) subEl.textContent = hero.subtitle || '';
    const badges = root.querySelectorAll('.hero-badges .badge, .badge, .hero-badges span, [class*="badge"]');
    if (badges.length >= 1) badges[0].textContent = hero.seasonLabel || '';
    if (badges.length >= 2) badges[1].textContent = hero.formatsLabel || '';
    if (badges.length >= 3) badges[2].textContent = hero.gameLabel || '';
    if (badges.length >= 4) badges[3].textContent = hero.openLabel || '';
    return root.outerHTML;
  }

  function patchStatsUpcomingIntoOriginal(upcomingHtml, upcoming) {
    if (!upcomingHtml || !upcoming) return upcomingHtml;
    const parser = new DOMParser();
    const doc = parser.parseFromString(upcomingHtml, 'text/html');
    const titleEl = doc.querySelector('h2, .section-title, .upcoming-title, h3');
    const bodyEl = doc.querySelector('p, .section-desc, .upcoming-body');
    if (titleEl) titleEl.textContent = upcoming.title != null ? upcoming.title : '';
    if (bodyEl) bodyEl.textContent = upcoming.bodyText != null ? upcoming.bodyText : '';
    return doc.body.innerHTML;
  }

  function patchStatsHighlightsIntoOriginal(html, highlights) {
    if (!html || !highlights) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const titleEl = doc.querySelector('h2, .section-title, .highlights-title, h3');
    const bodyEl = doc.querySelector('.section-desc, p, .highlights-body');
    if (titleEl) titleEl.textContent = highlights.title != null ? highlights.title : '';
    if (bodyEl) bodyEl.textContent = highlights.bodyText != null ? highlights.bodyText : '';
    return doc.body.innerHTML;
  }

  function patchStatsLeaderboardsIntoOriginal(html, leaderboards) {
    if (!html || !leaderboards) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const titleEl = doc.querySelector('h2, .section-title, .leaderboard-title, h3');
    const descEl = doc.querySelector('.section-desc, .leaderboard-desc, p');
    if (titleEl) titleEl.textContent = leaderboards.title != null ? leaderboards.title : '';
    if (descEl) descEl.textContent = leaderboards.description != null ? leaderboards.description : '';
    return doc.body.innerHTML;
  }

  function patchStatsFooterIntoOriginal(html, footer) {
    if (!html || !footer) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const el = doc.querySelector('.section-desc, p, [class*="footer"]') || doc.body;
    if (el) el.textContent = footer.text != null ? footer.text : '';
    return doc.body.innerHTML;
  }

  global.StatsEditor = {
    defaultStatsModel,
    parseStatsFromRegions,
    renderStatsHero,
    renderStatsUpcoming,
    renderStatsHighlights,
    renderStatsLeaderboards,
    renderStatsFooter,
    getSectionsHtml,
    getMinimalStatsPreviewPage,
    renderStatsHtml,
    getHeroShape,
    patchStatsHeroIntoOriginal,
    patchStatsUpcomingIntoOriginal,
    patchStatsHighlightsIntoOriginal,
    patchStatsLeaderboardsIntoOriginal,
    patchStatsFooterIntoOriginal
  };
  global.StatsEditorAPI = global.StatsEditor;
})(typeof window !== 'undefined' ? window : this);

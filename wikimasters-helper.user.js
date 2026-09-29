// ==UserScript==
// @name         Wikimasters Helper
// @namespace    wikimasters.helper
// @version      1.2.9
// @description  Affiche le prix moyen des cartes, tendances, halos de favoris/tags et aide à la décision sur le marketplace.
// @match        https://www.wiki-masters.com/*
// @grant        none
// @run-at       document-idle
// @author       nicof79
// @license      MIT
// @homepageURL  https://github.com/nicof79/wikimasters-helper
// @supportURL   https://github.com/nicof79/wikimasters-helper/issues
// @updateURL    https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/wikimasters-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/wikimasters-helper.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '1.2.9';

  /* =========================================================
   *             INTERCEPTION FETCH (avant tout)
   * ========================================================= */
  const FETCH_INTERCEPT = { lastMarketplaceQ: null };

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (url.includes('/api/marketplace?')) {
        const u = new URL(url, location.origin);
        if (u.searchParams.has('q')) {
          FETCH_INTERCEPT.lastMarketplaceQ = u.searchParams.get('q') || null;
        }
      }
    } catch {}
    return originalFetch.apply(this, args);
  };

  /* =========================================================
   *             CONFIGURATION GLOBALE
   * ========================================================= */
  const CONFIG = {
    CACHE_KEY: 'wikimasters-helper-cache',
    CACHE_MAX_AGE: 24 * 60 * 60 * 1000,
    CACHE_REFRESH_AGE: 6 * 60 * 60 * 1000,

    HISTORY_MIN_INTERVAL: 6 * 60 * 60 * 1000,
    HISTORY_MAX_POINTS: 100,

    TREND_WINDOWS: {
      d1: { target: 24 * 60 * 60 * 1000,      tolerance: 6 * 60 * 60 * 1000 },
      d7: { target: 7 * 24 * 60 * 60 * 1000, tolerance: 24 * 60 * 60 * 1000 }
    },

    TREND_THRESHOLDS: {
      strong: 10,
      light: 3
    },

    CONCURRENCY: 5,
    DELAY_MIN: 250,
    DELAY_MAX: 5000,
    DELAY_START: 400,
    BACKOFF_MULT: 2.2,
    RECOVERY_MULT: 0.9,
    MAX_CONSECUTIVE_LIMITS: 8,

    FRESHNESS_COLORS: [
      { maxAge: 3 * 60 * 60 * 1000,  bg: 'rgba(34,197,94,0.35)',  border: 'rgba(34,197,94,0.65)'  },
      { maxAge: 6 * 60 * 60 * 1000,  bg: 'rgba(234,179,8,0.35)',  border: 'rgba(234,179,8,0.65)'  },
      { maxAge: 12 * 60 * 60 * 1000, bg: 'rgba(249,115,22,0.35)', border: 'rgba(249,115,22,0.65)' },
      { maxAge: 24 * 60 * 60 * 1000, bg: 'rgba(239,68,68,0.35)',  border: 'rgba(239,68,68,0.65)'  },
      { maxAge: Infinity,            bg: 'rgba(30,30,30,0.60)',   border: 'rgba(80,80,80,0.65)'   }
    ],

    RARITIES: ['C', 'PC', 'R', 'SR', 'UR', 'L']
  };

  /* =========================================================
   *             ÉTAT GLOBAL
   * ========================================================= */
  const STATE = {
    priceCache: {},
    pageCardCache: new Map(),

    queue: [],
    queued: new Set(),
    inFlight: new Set(),
    fetched: new Set(),
    workersRunning: 0,
    delay: CONFIG.DELAY_START,
    consecutiveLimits: 0,
    stopped: false,
    cacheSaveScheduled: false,

    activePriceControllers: new Set(),
    collectionLoadController: null,
    marketplaceController: null,

    currentRoute: null,
    routeGeneration: 0,
    routeCheckTimer: null,

    collectionObserver: null,
    collectionClickHandler: null,
    collectionSyncTimer: null,
    collectionGeneration: 0,
    currentCollectionPage: null,
    currentCollectionCards: [],

    marketplaceObserver: null,
    marketplaceEnsureTimer: null,
    marketplaceContext: null,

    marketplaceListObserver: null,
    marketplaceListEnsureTimer: null,
    marketplaceListController: null,
    marketplaceListAuctions: null,
    marketplaceListPending: [],
    marketplaceListProcessing: false,
    marketplaceListLastSearch: null,

    noSalesRefresh: {}
  };

  /* =========================================================
   *             CSS INJECTÉ
   * ========================================================= */
  const injectStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .wm-halo-favorite {
        box-shadow:
          0 0 0 2px rgba(250,204,21,1),
          0 0 12px rgba(250,204,21,.90),
          0 0 26px rgba(250,204,21,.60),
          0 0 45px rgba(250,204,21,.30) !important;
        transition: box-shadow .2s ease !important;
      }
      .wm-halo-favorite:hover {
        box-shadow:
          0 0 0 2px rgba(253,224,71,1),
          0 0 16px rgba(253,224,71,1),
          0 0 34px rgba(253,224,71,.72),
          0 0 55px rgba(253,224,71,.40) !important;
      }
      .wm-halo-tag {
        box-shadow:
          0 0 0 2px var(--wm-tag-color),
          0 0 12px var(--wm-tag-color),
          0 0 26px color-mix(in srgb, var(--wm-tag-color) 65%, transparent),
          0 0 45px color-mix(in srgb, var(--wm-tag-color) 32%, transparent) !important;
        transition: box-shadow .2s ease !important;
      }
      .wm-halo-tag:hover {
        box-shadow:
          0 0 0 2px var(--wm-tag-color),
          0 0 16px var(--wm-tag-color),
          0 0 34px color-mix(in srgb, var(--wm-tag-color) 75%, transparent),
          0 0 55px color-mix(in srgb, var(--wm-tag-color) 42%, transparent) !important;
      }

      .wm-price-badge.wm-loading {
        animation: wm-pulse 1s infinite;
      }
      @keyframes wm-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .wm-market-comparison {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.10);
        font: 600 13px/1.2 system-ui, sans-serif;
      }
      .wm-seller-average {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
        color: rgba(255,255,255,.50);
        font: 600 12px/1.2 system-ui, sans-serif;
        white-space: nowrap;
      }

      .wm-version-badge {
        position: fixed;
        left: 8px;
        bottom: 8px;
        z-index: 9999;
        font: 500 10px/1.2 system-ui, sans-serif;
        color: rgba(255,255,255,.35);
        pointer-events: none;
        user-select: none;
        letter-spacing: 0.3px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const injectVersionBadge = () => {
    if (document.querySelector('.wm-version-badge')) return;
    const badge = document.createElement('div');
    badge.className = 'wm-version-badge';
    badge.textContent = `Wikimasters Helper • v${VERSION}`;
    document.body.appendChild(badge);
  };

  /* =========================================================
   *             UTILITAIRES
   * ========================================================= */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const formatNumber = (value) =>
    new Intl.NumberFormat('fr-FR').format(value);

  const formatAge = (ms) => {
    if (ms < 60 * 1000) return "à l'instant";
    const totalMinutes = Math.floor(ms / (60 * 1000));
    if (totalMinutes < 60) return `il y a ${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `il y a ${days}j ${remHours}h` : `il y a ${days}j`;
  };

  const isRarityText = (text) =>
    CONFIG.RARITIES.includes((text || '').trim().toUpperCase());

  const getFreshnessStyle = (ageMs) => {
    for (const tier of CONFIG.FRESHNESS_COLORS) {
      if (ageMs < tier.maxAge) return tier;
    }
    return CONFIG.FRESHNESS_COLORS[CONFIG.FRESHNESS_COLORS.length - 1];
  };

  /* =========================================================
   *             TENDANCE
   * ========================================================= */
  const classifyTrend = (deltaPct) => {
    const { strong, light } = CONFIG.TREND_THRESHOLDS;
    if (deltaPct <= -strong) return { symbol: '▼▼', color: '#f87171', label: 'Forte baisse' };
    if (deltaPct <= -light)  return { symbol: '▼',  color: '#fb923c', label: 'Baisse' };
    if (deltaPct < light)    return { symbol: '=',  color: '#d1d5db', label: 'Stable' };
    if (deltaPct < strong)   return { symbol: '▲',  color: '#4ade80', label: 'Hausse' };
    return { symbol: '▲▲', color: '#22c55e', label: 'Forte hausse' };
  };

  const getTrend = (cardId, windowConfig) => {
    const entry = STATE.priceCache[cardId];
    if (!entry || !Array.isArray(entry.history) || entry.history.length < 2) return null;

    const now = Date.now();
    const target = now - windowConfig.target;
    const minTime = target - windowConfig.tolerance;
    const maxTime = target + windowConfig.tolerance;

    let best = null;
    let bestDist = Infinity;
    for (const p of entry.history) {
      if (p.timestamp < minTime || p.timestamp > maxTime) continue;
      const dist = Math.abs(p.timestamp - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }

    if (!best || !best.price) return null;

    const deltaPct = ((entry.price - best.price) / best.price) * 100;
    return {
      deltaPct,
      referencePrice: best.price,
      referenceAge: now - best.timestamp
    };
  };

  const buildBadgeTitle = (cardId, card = null) => {
    const entry = STATE.priceCache[cardId];
    if (!entry) return '';

    const lines = [];
    const rarity = card?.card?.rarity || card?.rarity || '';
    lines.push(`Prix moyen${rarity ? ' • ' + rarity : ''} : ${formatNumber(entry.price)}`);

    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    lines.push(`Actualisé : ${dateStr} à ${timeStr} (${formatAge(Date.now() - entry.timestamp)})`);

    const t24 = getTrend(cardId, CONFIG.TREND_WINDOWS.d1);
    const t7d = getTrend(cardId, CONFIG.TREND_WINDOWS.d7);

    if (t24) {
      const c = classifyTrend(t24.deltaPct);
      const sign = t24.deltaPct >= 0 ? '+' : '';
      lines.push(`Tendance 24h : ${c.symbol} ${sign}${t24.deltaPct.toFixed(1)} %`);
    } else {
      lines.push(`Tendance 24h : — (données insuffisantes)`);
    }

    if (t7d) {
      const c = classifyTrend(t7d.deltaPct);
      const sign = t7d.deltaPct >= 0 ? '+' : '';
      lines.push(`Tendance 7j : ${c.symbol} ${sign}${t7d.deltaPct.toFixed(1)} %`);
    } else {
      lines.push(`Tendance 7j : — (données insuffisantes)`);
    }

    lines.push('');
    lines.push('Clic droit pour actualiser');
    return lines.join('\n');
  };

  /* =========================================================
   *             ICÔNE WIKIBIDOU
   * ========================================================= */
  const createWikibidouIcon = (size, color) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    Object.assign(svg.style, {
      width: `${size}px`,
      height: `${size}px`,
      flexShrink: '0',
      color
    });

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '9');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M7.5 8.5 9.5 15.5 12 10 14.5 15.5 16.5 8.5');

    svg.append(circle, path);
    return svg;
  };

  /* =========================================================
   *             CACHE
   * ========================================================= */
  const loadCache = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
      if (saved.expiresAt > Date.now() && saved.prices) {
        for (const id in saved.prices) {
          const e = saved.prices[id];
          if (e && typeof e.price === 'number' && typeof e.timestamp === 'number') {
            if (!Array.isArray(e.history)) {
              e.history = [{ price: e.price, timestamp: e.timestamp }];
            }
          }
        }
        return saved.prices;
      }
      return {};
    } catch {
      return {};
    }
  };

  const saveCache = () => {
    try {
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
        expiresAt: Date.now() + CONFIG.CACHE_MAX_AGE,
        prices: STATE.priceCache
      }));
    } catch (e) {
      console.warn('[Wikimasters Helper] Erreur sauvegarde cache:', e);
    }
  };

  const saveCacheLater = () => {
    if (STATE.cacheSaveScheduled) return;
    STATE.cacheSaveScheduled = true;
    const run = () => {
      STATE.cacheSaveScheduled = false;
      saveCache();
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1000 });
    } else {
      setTimeout(run, 0);
    }
  };

  const getCachedPrice = (cardId) => {
    const entry = STATE.priceCache[cardId];
    if (!entry || typeof entry.price !== 'number') return null;
    if (Date.now() - entry.timestamp > CONFIG.CACHE_MAX_AGE) return null;
    return entry;
  };

  const setCachedPrice = (cardId, price) => {
    const now = Date.now();
    let entry = STATE.priceCache[cardId];

    if (!entry) {
      entry = { price, timestamp: now, history: [] };
      STATE.priceCache[cardId] = entry;
    }

    entry.price = price;
    entry.timestamp = now;

    if (!Array.isArray(entry.history)) entry.history = [];

    const last = entry.history[entry.history.length - 1];
    const shouldRecord = !last
      || last.price !== price
      || (now - last.timestamp) > CONFIG.HISTORY_MIN_INTERVAL;

    if (shouldRecord) {
      entry.history.push({ price, timestamp: now });
      if (entry.history.length > CONFIG.HISTORY_MAX_POINTS) {
        entry.history.shift();
      }
    }

    saveCacheLater();
  };

  /* =========================================================
   *             API
   * ========================================================= */
  const fetchJson = async (url, { signal } = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'default',
      signal
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  };

  const fetchPriceForCard = async (cardId, rarity, { signal, forceRefresh = false } = {}) => {
    const cached = getCachedPrice(cardId);

    if (!forceRefresh && cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CONFIG.CACHE_REFRESH_AGE) {
        return cached.price;
      }
      refreshPriceInBackground(cardId, rarity);
      return cached.price;
    }

    try {
      const data = await fetchJson(
        `/api/marketplace/cards/${cardId}/sales?scope=summary`,
        { signal }
      );
      const average = data?.summary?.[rarity]?.average
        ?? Object.values(data?.summary || {})[0]?.average;
      if (typeof average === 'number') {
        setCachedPrice(cardId, average);
        return average;
      }
      return null;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      return cached?.price ?? null;
    }
  };

  const refreshPriceInBackground = async (cardId, rarity) => {
    try {
      const data = await fetchJson(
        `/api/marketplace/cards/${cardId}/sales?scope=summary`
      );
      const average = data?.summary?.[rarity]?.average
        ?? Object.values(data?.summary || {})[0]?.average;
      if (typeof average === 'number') {
        setCachedPrice(cardId, average);
      }
    } catch {
      // Silencieux
    }
  };

  /* =========================================================
   *             DÉTECTION CARTE (Fiber fallback)
   * ========================================================= */
  const getCardDataFromFiber = (domEl) => {
    if (!domEl) return null;
    const fiberKey = Object.keys(domEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;

    const fiber = domEl[fiberKey];

    const directCard = fiber.memoizedProps?.card || fiber.return?.memoizedProps?.card;
    if (directCard) {
      return {
        id: directCard.id || directCard.card_id || directCard.cardId,
        rarity: directCard.rarity || directCard.grade,
        card: directCard
      };
    }

    let child = fiber.child;
    let depth = 0;
    while (child && depth < 4) {
      if (child.memoizedProps?.card) {
        const card = child.memoizedProps.card;
        return {
          id: card.id || card.card_id || card.cardId,
          rarity: card.rarity || card.grade,
          card
        };
      }
      child = child.child;
      depth++;
    }
    return null;
  };

  const getVisibleCardRoots = () => {
    const roots = new Set();
    for (const sword of document.querySelectorAll('svg.lucide-swords')) {
      let element = sword;
      for (let i = 0; i < 10 && element.parentElement; i++) {
        element = element.parentElement;
        const rect = element.getBoundingClientRect();
        if (
          rect.width >= 110 && rect.width <= 260 &&
          rect.height >= 180 && rect.height <= 500 &&
          element.offsetParent !== null
        ) {
          roots.add(element);
          break;
        }
      }
    }
    return [...roots];
  };

  const getStatsRow = (root) =>
    root.querySelector('svg.lucide-swords')?.closest('.border-t') || null;

  const findCardInListByText = (root, cards) => {
    const text = root.innerText || '';
    return cards.find(item =>
      text.includes(item.card?.wikipedia_title || item.card?.title) &&
      text.includes(item.card?.rarity)
    );
  };

  /* =========================================================
   *             FAVORIS
   * ========================================================= */
  const isSvgActuallyFilled = (svg) => {
    const elements = [svg, ...svg.querySelectorAll('path, polygon, circle')];
    for (const element of elements) {
      const fill = element.getAttribute('fill');
      if (fill && fill !== 'none' && fill !== 'transparent') return true;
      const classes = element.getAttribute('class') || '';
      if (/\bfill-(?!none\b)[^\s]+/i.test(classes)) return true;
    }
    return false;
  };

  const getFavoriteStateFromDom = (root) => {
    const star = root.querySelector('svg.lucide-star, svg[class*="star" i]');
    if (!star) return null;

    const button = star.closest('button, [role="button"]');
    if (button) {
      const label = [
        button.getAttribute('aria-label') || '',
        button.getAttribute('title') || '',
        button.textContent || ''
      ].join(' ').trim().toLowerCase();

      if (/retirer.*favori|remove.*favorite|unfavorite/.test(label)) return true;
      if (/ajouter.*favori|add.*favorite/.test(label)) return false;

      const pressed = button.getAttribute('aria-pressed');
      if (pressed === 'true') return true;
      if (pressed === 'false') return false;

      const state = button.getAttribute('data-state');
      if (['on', 'checked', 'active'].includes(state)) return true;
      if (['off', 'unchecked', 'inactive'].includes(state)) return false;
    }

    return isSvgActuallyFilled(star);
  };

  const getFavoriteStateFromApi = (card) => {
    if (typeof card?.starred === 'boolean') return card.starred;

    const keys = ['favorite', 'is_favorite', 'isFavorite', 'favorited', 'is_favorited', 'pinned', 'is_pinned', 'starred'];
    const sources = [card, card?.card].filter(Boolean);
    for (const source of sources) {
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if ([true, 1, '1', 'true'].includes(value)) return true;
        if ([false, 0, '0', 'false', null].includes(value)) return false;
      }
    }
    return null;
  };

  const isFavoriteCard = (card, root) => {
    if (typeof card?.starred === 'boolean') return card.starred;
    const api = getFavoriteStateFromApi(card);
    if (typeof api === 'boolean') return api;
    return getFavoriteStateFromDom(root) === true;
  };

  /* =========================================================
   *             TAGS
   * ========================================================= */
  const isVisibleColor = (color) => {
    if (!color) return false;
    const normalized = color.replace(/\s+/g, '').toLowerCase();
    if (normalized === 'transparent' || normalized === 'none' || normalized === 'rgba(0,0,0,0)') return false;
    const rgbaMatch = normalized.match(/^rgba\([^,]+,[^,]+,[^,]+,([0-9.]+)\)$/);
    if (rgbaMatch && Number(rgbaMatch[1]) === 0) return false;
    return true;
  };

  const getElementBackgroundColor = (element) => {
    try {
      const color = getComputedStyle(element).backgroundColor;
      return isVisibleColor(color) ? color : null;
    } catch {
      return null;
    }
  };

  const getColoredPillCandidate = (element, root) => {
    let current = element;
    for (let level = 0; level < 4 && current && current !== root; level++) {
      const rect = current.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const style = getComputedStyle(current);
      const color = getElementBackgroundColor(current);
      const radius = parseFloat(style.borderRadius) || 0;
      const validSize =
        rect.width >= 18 && rect.width <= Math.min(150, rootRect.width * 0.85) &&
        rect.height >= 12 && rect.height <= 34;
      const inside =
        rect.top >= rootRect.top - 3 && rect.left >= rootRect.left - 3 &&
        rect.right <= rootRect.right + 3 && rect.bottom <= rootRect.bottom + 3;

      if (color && radius >= 3 && validSize && inside) {
        return { element: current, color };
      }
      current = current.parentElement;
    }
    return null;
  };

  const getTagFromExplicitSelectors = (root) => {
    const selectors = [
      '[data-tag-id]', '[data-label-id]', '[data-tag]', '[data-label]',
      '[data-collection-tag]', '[class*="collection-tag" i]',
      '[class*="tag-badge" i]', '[class*="tag-chip" i]'
    ];
    let elements = [];
    try {
      elements = [...root.querySelectorAll(selectors.join(', '))];
    } catch { elements = []; }

    for (const element of elements) {
      const text = (element.textContent || '').trim();
      if (!text || isRarityText(text)) continue;
      const pill = getColoredPillCandidate(element, root);
      if (pill) return { present: true, color: pill.color, text };
    }
    return null;
  };

  const getTagFromVisualDetection = (root) => {
    const rootRect = root.getBoundingClientRect();
    const statsRow = getStatsRow(root);
    let best = null;

    for (const element of root.querySelectorAll('span, div, button')) {
      if (element.classList.contains('wm-price-badge')) continue;
      if (statsRow && statsRow.contains(element)) continue;

      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 45 || isRarityText(text)) continue;

      const pill = getColoredPillCandidate(element, root);
      if (!pill) continue;

      const rect = pill.element.getBoundingClientRect();
      const relativeTop = rect.top - rootRect.top;
      if (relativeTop < rootRect.height * 0.25) continue;

      const metadata = [
        pill.element.getAttribute('class') || '',
        pill.element.getAttribute('aria-label') || '',
        element.getAttribute('class') || ''
      ].join(' ').toLowerCase();

      let score = 0;
      if (metadata.includes('tag')) score += 100;
      if (metadata.includes('label')) score += 80;
      if (metadata.includes('badge')) score += 30;
      if (rect.height <= 24) score += 20;
      if (rect.width <= 90) score += 15;
      if (relativeTop > rootRect.height * 0.45) score += 10;
      if (text.length <= 20) score += 10;

      if (!best || score > best.score) {
        best = { present: true, color: pill.color, text, score };
      }
    }
    return best;
  };

  const findColorInsideTagValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try { return CSS.supports('color', value.trim()) ? value : null; }
      catch { return null; }
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const color = findColorInsideTagValue(entry);
        if (color) return color;
      }
      return null;
    }
    if (typeof value !== 'object') return null;

    const keys = ['color', 'colour', 'hex', 'hex_color', 'hexColor', 'background', 'background_color', 'backgroundColor'];
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'string') {
        try {
          if (CSS.supports('color', candidate.trim())) return candidate;
        } catch {}
      }
    }
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === 'object') {
        const color = findColorInsideTagValue(nested);
        if (color) return color;
      }
    }
    return null;
  };

  const getTagFromApi = (card) => {
    if (Array.isArray(card?.tags) && card.tags.length > 0) {
      const tag = card.tags[0];
      return {
        present: true,
        color: tag?.color || null,
        text: tag?.name || null,
        count: card.tags.length
      };
    }

    const sources = [card, card?.card].filter(Boolean);
    const keys = ['label', 'labels', 'collection_tag', 'collection_tags', 'user_tag', 'user_tags'];
    for (const source of sources) {
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
        if (!hasValue) continue;
        return { present: true, color: findColorInsideTagValue(value), text: null };
      }
    }
    return null;
  };

  const getCollectionTag = (card, root) =>
    getTagFromApi(card) ||
    getTagFromExplicitSelectors(root) ||
    getTagFromVisualDetection(root) ||
    { present: false, color: null, text: null };

  /* =========================================================
   *             AFFICHAGE : BADGE DE PRIX (collection)
   * ========================================================= */
  const showPriceBadge = (root, card, price) => {
    const row = getStatsRow(root);
    if (!row) return;

    const cardId = card.card_id || card.id;
    const selector = `.wm-price-badge[data-card-id="${cardId}"]`;
    const existing = row.querySelector(selector);

    const entry = STATE.priceCache[cardId];
    const age = entry ? (Date.now() - entry.timestamp) : 0;
    const freshStyle = getFreshnessStyle(age);

    const t24 = entry ? getTrend(cardId, CONFIG.TREND_WINDOWS.d1) : null;
    const trendInfo = t24
      ? classifyTrend(t24.deltaPct)
      : { symbol: '—', color: '#9ca3af', label: null };

    const title = buildBadgeTitle(cardId, card);

    if (existing && existing.querySelector('.wm-trend-symbol')) {
      const valueSpan = existing.querySelector('.wm-price-value');
      if (valueSpan) valueSpan.textContent = formatNumber(price);

      const trendSpan = existing.querySelector('.wm-trend-symbol');
      if (trendSpan) {
        trendSpan.textContent = trendInfo.symbol;
        trendSpan.style.color = trendInfo.color;
        trendSpan.style.opacity = trendInfo.label ? '1' : '0.4';
      }

      existing.style.background = freshStyle.bg;
      existing.style.borderColor = freshStyle.border;
      existing.title = title;
      return;
    }

    if (existing) existing.remove();

    row.style.position = 'relative';

    const badge = document.createElement('span');
    badge.className = 'wm-price-badge';
    badge.dataset.cardId = cardId;
    badge.title = title;

    badge.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 20;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      color: #ffffff !important;
      font: 700 11px/1 system-ui, sans-serif;
      white-space: nowrap;
      pointer-events: auto;
      cursor: default;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid ${freshStyle.border};
      background: ${freshStyle.bg};
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;

    const trendSpan = document.createElement('span');
    trendSpan.className = 'wm-trend-symbol';
    trendSpan.textContent = trendInfo.symbol;
    trendSpan.style.cssText = `
      font: 800 12px/1 system-ui, sans-serif;
      color: ${trendInfo.color};
      opacity: ${trendInfo.label ? '1' : '0.4'};
    `;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'wm-price-value';
    valueSpan.textContent = formatNumber(price);

    badge.append(trendSpan, valueSpan);

    badge.addEventListener('mousedown', (e) => e.stopPropagation());
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    badge.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleManualRefresh(cardId, root, card);
    });

    row.appendChild(badge);
  };

  /* =========================================================
   *             HELPER : flash visuel sur un badge marketplace
   * ========================================================= */
  const flashMarketBadge = (item, color) => {
    const badge = item.querySelector('.wm-market-list-badge');
    if (!badge) return;
    const prevBorder = badge.style.borderColor;
    const prevShadow = badge.style.boxShadow;
    badge.style.transition = 'box-shadow 0.15s ease, border-color 0.15s ease';
    badge.style.borderColor = color;
    badge.style.boxShadow = `0 0 12px ${color}`;
    setTimeout(() => {
      badge.style.borderColor = prevBorder;
      badge.style.boxShadow = prevShadow || 'none';
    }, 500);
  };

  /* =========================================================
   *             AFFICHAGE : BADGE MARKETPLACE LIST
   * ========================================================= */
  const renderMarketplaceListBadge = (item, auction, average, currentBid, rarity) => {
    const cardId = auction.card_id;
    const hasSales = typeof average === 'number';

    let freshStyle, trendInfo, title;

    if (hasSales) {
      const entry = STATE.priceCache[cardId];
      const age = entry ? (Date.now() - entry.timestamp) : 0;
      freshStyle = getFreshnessStyle(age);

      const t24 = getTrend(cardId, CONFIG.TREND_WINDOWS.d1);
      trendInfo = t24
        ? classifyTrend(t24.deltaPct)
        : { symbol: '—', color: '#d1d5db', label: null };

      const delta = average - currentBid;
      let comparisonText;
      if (delta > 0) comparisonText = `+${formatNumber(delta)} sous la moyenne`;
      else if (delta < 0) comparisonText = `${formatNumber(Math.abs(delta))} au-dessus`;
      else comparisonText = 'Au prix moyen';

      const date = new Date(entry?.timestamp || Date.now());
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      const titleLines = [
        `Prix moyen${rarity ? ' • ' + rarity : ''} : ${formatNumber(average)}`,
        `Mise actuelle : ${formatNumber(currentBid)}`,
        comparisonText,
        '',
        `Actualisé : ${dateStr} à ${timeStr} (${formatAge(age)})`
      ];
      if (t24) {
        const sign = t24.deltaPct >= 0 ? '+' : '';
        titleLines.push(`Tendance 24h : ${trendInfo.symbol} ${sign}${t24.deltaPct.toFixed(1)} %`);
      } else {
        titleLines.push(`Tendance 24h : — (données insuffisantes)`);
      }
      titleLines.push('');
      titleLines.push('Clic droit pour actualiser');
      title = titleLines.join('\n');
    } else {
      freshStyle = { bg: 'rgba(60,60,60,0.55)', border: 'rgba(120,120,120,0.65)' };
      trendInfo = { symbol: '?', color: '#9ca3af', label: null };

      const lastTry = STATE.noSalesRefresh[cardId];
      const lastTryLine = lastTry
        ? `Dernier essai : ${new Date(lastTry).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (${formatAge(Date.now() - lastTry)})`
        : 'Dernier essai : jamais';

      title = [
        `Prix moyen${rarity ? ' • ' + rarity : ''} : aucune vente enregistrée`,
        `Mise actuelle : ${formatNumber(currentBid)}`,
        '',
        lastTryLine,
        'Clic droit pour réessayer'
      ].join('\n');
    }

    // === Mise à jour si déjà présent ===
    const existing = item.querySelector('.wm-market-list-badge');
    if (existing) {
      const valueSpan = existing.querySelector('.wm-market-list-value');
      if (valueSpan) valueSpan.textContent = hasSales ? formatNumber(average) : '—';

      const trendSpan = existing.querySelector('.wm-trend-symbol');
      if (trendSpan) {
        trendSpan.textContent = trendInfo.symbol;
        trendSpan.style.color = trendInfo.color;
        trendSpan.style.opacity = trendInfo.label ? '1' : '0.4';
      }

      existing.style.background = freshStyle.bg;
      existing.style.borderColor = freshStyle.border;
      existing.title = title;
      return;
    }

    // === Création ===
    const badge = document.createElement('span');
    badge.className = 'wm-market-list-badge';
    badge.title = title;
    badge.dataset.cardId = cardId;
    badge.dataset.rarity = rarity || '';

    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      margin: 4px auto 0;
      border-radius: 6px;
      color: #ffffff !important;
      font: 700 11px/1 system-ui, sans-serif;
      white-space: nowrap;
      pointer-events: auto;
      cursor: default;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid ${freshStyle.border};
      background: ${freshStyle.bg};
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;

    const trendSpan = document.createElement('span');
    trendSpan.className = 'wm-trend-symbol';
    trendSpan.textContent = trendInfo.symbol;
    trendSpan.style.cssText = `
      font: 800 12px/1 system-ui, sans-serif;
      color: ${trendInfo.color};
      opacity: ${trendInfo.label ? '1' : '0.4'};
    `;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'wm-market-list-value';
    valueSpan.textContent = hasSales ? formatNumber(average) : '—';

    badge.append(trendSpan, valueSpan);

    badge.addEventListener('mousedown', (e) => e.stopPropagation());
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    badge.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      badge.classList.add('wm-loading');

      const start = Date.now();

      try {
        const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`);
        const avg = data?.summary?.[rarity]?.average
          ?? Object.values(data?.summary || {})[0]?.average;

        const elapsed = Date.now() - start;
        if (elapsed < 400) await sleep(400 - elapsed);

        if (typeof avg === 'number') {
          setCachedPrice(cardId, avg);
          delete STATE.noSalesRefresh[cardId];
          renderMarketplaceListBadge(item, auction, avg, currentBid, rarity);
          flashMarketBadge(item, 'rgba(34,197,94,1)');
        } else {
          STATE.noSalesRefresh[cardId] = Date.now();
          renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
          flashMarketBadge(item, 'rgba(234,179,8,1)');
        }
      } catch (err) {
        console.warn('[Wikimasters Helper] Refresh manuel marketplace échoué:', err);
        const elapsed = Date.now() - start;
        if (elapsed < 400) await sleep(400 - elapsed);
        flashMarketBadge(item, 'rgba(239,68,68,1)');
      } finally {
        badge.classList.remove('wm-loading');
      }
    });

    // === Insertion ===
    const priceRow = item.querySelector('.w-full.flex.items-center.justify-between.gap-2.text-xs');
    if (priceRow && priceRow.parentElement) {
      priceRow.parentElement.insertBefore(badge, priceRow.nextSibling);
    } else {
      const sellerLine = item.querySelector('p.truncate');
      if (sellerLine) {
        sellerLine.parentElement.insertBefore(badge, sellerLine);
      } else {
        const flexCol = item.querySelector('.flex.flex-col.items-center.gap-2\\.5');
        if (flexCol) flexCol.appendChild(badge);
      }
    }
  };

  /* =========================================================
   *             HALOS
   * ========================================================= */
  const updateCardHalo = (root, card) => {
    const tag = getCollectionTag(card, root);
    const favorite = isFavoriteCard(card, root);

    root.classList.remove('wm-halo-tag', 'wm-halo-favorite');
    root.style.removeProperty('--wm-tag-color');

    if (tag.present && tag.color) {
      root.style.setProperty('--wm-tag-color', tag.color);
      root.classList.add('wm-halo-tag');
      return;
    }

    if (favorite) {
      root.classList.add('wm-halo-favorite');
    }
  };

  /* =========================================================
   *             REFRESH MANUEL (collection)
   * ========================================================= */
  const handleManualRefresh = async (cardId, root, card) => {
    const badge = root.querySelector(`.wm-price-badge[data-card-id="${cardId}"]`);
    if (!badge) return;

    badge.classList.add('wm-loading');
    badge.title = 'Actualisation en cours...';

    try {
      const rarity = card.card?.rarity || card.rarity;
      const data = await fetchJson(
        `/api/marketplace/cards/${cardId}/sales?scope=summary`
      );
      const average = data?.summary?.[rarity]?.average
        ?? Object.values(data?.summary || {})[0]?.average;

      if (typeof average === 'number') {
        setCachedPrice(cardId, average);
        showPriceBadge(root, card, average);
      }
    } catch (e) {
      console.warn('[Wikimasters Helper] Refresh manuel échoué:', e);
    } finally {
      badge.classList.remove('wm-loading');
    }
  };

  /* =========================================================
   *             COLLECTION : file d'attente & workers
   * ========================================================= */
  const resetCollectionQueue = () => {
    STATE.queue.length = 0;
    STATE.queued.clear();
    STATE.inFlight.clear();
    STATE.fetched.clear();
    for (const controller of STATE.activePriceControllers) {
      controller.abort();
    }
    STATE.activePriceControllers.clear();
  };

  const enqueue = (card, root, generation) => {
    const cardId = card.card_id || card.id;
    const rarity = card.card?.rarity || card.rarity;

    updateCardHalo(root, card);

    const cached = getCachedPrice(cardId);

    if (cached) {
      showPriceBadge(root, card, cached.price);

      const age = Date.now() - cached.timestamp;
      if (age > CONFIG.CACHE_REFRESH_AGE) {
        refreshPriceInBackground(cardId, rarity);
      }
      return;
    }

    if (STATE.stopped || STATE.queued.has(cardId) ||
        STATE.inFlight.has(cardId) || STATE.fetched.has(cardId)) {
      return;
    }

    STATE.queued.add(cardId);
    STATE.queue.push({ card, root, generation, rarity });
  };

  const worker = async () => {
    while (STATE.queue.length && !STATE.stopped) {
      const item = STATE.queue.shift();
      if (!item) break;

      const { card, root, generation, rarity } = item;
      const cardId = card.card_id || card.id;
      STATE.queued.delete(cardId);

      if (generation !== STATE.collectionGeneration) continue;

      STATE.inFlight.add(cardId);
      const controller = new AbortController();
      STATE.activePriceControllers.add(controller);

      try {
        const average = await fetchPriceForCard(cardId, rarity, {
          signal: controller.signal
        });

        if (typeof average === 'number' &&
            generation === STATE.collectionGeneration &&
            root.isConnected) {
          showPriceBadge(root, card, average);
        }

        STATE.fetched.add(cardId);
        STATE.consecutiveLimits = 0;
        if (STATE.delay > CONFIG.DELAY_MIN) {
          STATE.delay = Math.max(CONFIG.DELAY_MIN, STATE.delay * CONFIG.RECOVERY_MULT);
        }
      } catch (error) {
        if (error?.name === 'AbortError') continue;

        if (error.status === 403 || error.status === 429) {
          STATE.consecutiveLimits++;
          STATE.delay = Math.min(
            CONFIG.DELAY_MAX,
            Math.max(STATE.delay, 400) * CONFIG.BACKOFF_MULT
          );
          if (generation === STATE.collectionGeneration) {
            STATE.queued.add(cardId);
            STATE.queue.push({ card, root, generation, rarity });
          }
          console.warn(`[Wikimasters Helper] Rate limit, délai=${Math.round(STATE.delay)}ms`);

          if (STATE.consecutiveLimits >= CONFIG.MAX_CONSECUTIVE_LIMITS) {
            STATE.stopped = true;
            console.warn('[Wikimasters Helper] Trop de rate limits, arrêt.');
            return;
          }
        } else {
          STATE.fetched.add(cardId);
          console.warn('[Wikimasters Helper] Erreur prix carte:', error);
        }
      } finally {
        STATE.activePriceControllers.delete(controller);
        STATE.inFlight.delete(cardId);
      }

      await sleep(STATE.delay);
    }
  };

  const processQueue = () => {
    const freeSlots = CONFIG.CONCURRENCY - STATE.workersRunning;
    if (freeSlots <= 0) return;

    for (let i = 0; i < freeSlots; i++) {
      STATE.workersRunning++;
      worker().finally(() => {
        STATE.workersRunning--;
        if (STATE.queue.length && !STATE.stopped) {
          processQueue();
        }
      });
    }
  };

  /* =========================================================
   *             COLLECTION : chargement page & scan
   * ========================================================= */
  const getCurrentCollectionPageNumber = () => {
    for (const element of document.querySelectorAll('span, p, div')) {
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const match = text.match(/^Page\s+(\d+)\s*\/\s*\d+$/i);
      if (match) {
        const page = Number(match[1]);
        if (Number.isInteger(page) && page >= 1) return page;
      }
    }
    return null;
  };

  const loadCollectionPage = async (pageNumber, signal) => {
    if (STATE.pageCardCache.has(pageNumber)) {
      return STATE.pageCardCache.get(pageNumber);
    }
    const apiPage = Math.max(0, pageNumber - 1);
    const data = await fetchJson(
      `/api/my-collection?sort=rarity&page=${apiPage}&stats=0`,
      { signal }
    );
    const cards = data.collection || [];
    STATE.pageCardCache.set(pageNumber, cards);
    return cards;
  };

  const scanCurrentCollectionPage = () => {
    if (!STATE.currentCollectionCards.length) return;

    const generation = STATE.collectionGeneration;
    const roots = getVisibleCardRoots();

    for (const root of roots) {
      let cardData = null;
      const apiCard = findCardInListByText(root, STATE.currentCollectionCards);

      if (apiCard) {
        cardData = {
          id: apiCard.card_id || apiCard.card?.id,
          card_id: apiCard.card_id || apiCard.card?.id,
          rarity: apiCard.card?.rarity,
          card: apiCard.card,
          tags: apiCard.tags,
          starred: apiCard.starred
        };
      }

      if (!cardData?.id) {
        const fiberData = getCardDataFromFiber(root);
        if (fiberData?.id) cardData = fiberData;
      }

      if (cardData?.id) {
        enqueue(cardData, root, generation);
      }
    }

    processQueue();
  };

  const switchCollectionPage = async (pageNumber) => {
    if (pageNumber === STATE.currentCollectionPage &&
        STATE.currentCollectionCards.length) {
      scanCurrentCollectionPage();
      return;
    }

    STATE.currentCollectionPage = pageNumber;
    STATE.currentCollectionCards = [];
    STATE.collectionGeneration++;
    const generation = STATE.collectionGeneration;

    resetCollectionQueue();

    if (STATE.collectionLoadController) {
      STATE.collectionLoadController.abort();
    }
    STATE.collectionLoadController = new AbortController();

    try {
      const cards = await loadCollectionPage(
        pageNumber,
        STATE.collectionLoadController.signal
      );

      if (generation !== STATE.collectionGeneration ||
          !location.pathname.startsWith('/collection')) {
        return;
      }

      STATE.currentCollectionCards = cards;
      scanCurrentCollectionPage();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error(`[Wikimasters Helper] Erreur page collection ${pageNumber}:`, error);
    }
  };

  const syncCollectionPage = () => {
    if (!location.pathname.startsWith('/collection')) return;

    const pageNumber = getCurrentCollectionPageNumber();
    if (!pageNumber) return;

    if (pageNumber !== STATE.currentCollectionPage) {
      switchCollectionPage(pageNumber);
    } else {
      scanCurrentCollectionPage();
    }
  };

  const scheduleCollectionSync = (wait = 80) => {
    clearTimeout(STATE.collectionSyncTimer);
    STATE.collectionSyncTimer = setTimeout(syncCollectionPage, wait);
  };

  /* =========================================================
   *             COLLECTION : démarrage & nettoyage
   * ========================================================= */
  const cleanupCollectionMode = () => {
    clearTimeout(STATE.collectionSyncTimer);
    STATE.collectionSyncTimer = null;

    if (STATE.collectionObserver) {
      STATE.collectionObserver.disconnect();
      STATE.collectionObserver = null;
    }
    if (STATE.collectionClickHandler) {
      document.removeEventListener('click', STATE.collectionClickHandler, true);
      STATE.collectionClickHandler = null;
    }
    if (STATE.collectionLoadController) {
      STATE.collectionLoadController.abort();
      STATE.collectionLoadController = null;
    }

    STATE.collectionGeneration++;
    STATE.currentCollectionPage = null;
    STATE.currentCollectionCards = [];
    resetCollectionQueue();
  };

  const startCollectionMode = () => {
    STATE.collectionObserver = new MutationObserver(() => {
      scheduleCollectionSync(80);
    });
    STATE.collectionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['fill', 'data-state', 'aria-pressed']
    });

    STATE.collectionClickHandler = () => {
      scheduleCollectionSync(80);
      setTimeout(() => scheduleCollectionSync(0), 300);
    };
    document.addEventListener('click', STATE.collectionClickHandler, true);

    scheduleCollectionSync(0);
  };

  /* =========================================================
   *             MARKETPLACE LIST : démarrage & sync
   * ========================================================= */
  const cleanupMarketplaceListMode = () => {
    clearTimeout(STATE.marketplaceListEnsureTimer);
    STATE.marketplaceListEnsureTimer = null;

    if (STATE.marketplaceListObserver) {
      STATE.marketplaceListObserver.disconnect();
      STATE.marketplaceListObserver = null;
    }
    if (STATE.marketplaceListController) {
      STATE.marketplaceListController.abort();
      STATE.marketplaceListController = null;
    }

    STATE.marketplaceListAuctions = null;
    STATE.marketplaceListPending = [];
    STATE.marketplaceListProcessing = false;

    document.querySelectorAll('.wm-market-list-badge').forEach(el => el.remove());
    document.querySelectorAll('[id^="marketplace-auction-"][data-wm-list-processed]').forEach(el => {
      delete el.dataset.wmListProcessed;
    });
  };

  const processMarketplaceListPending = async () => {
    if (STATE.marketplaceListProcessing) return;
    STATE.marketplaceListProcessing = true;

    while (STATE.marketplaceListPending.length > 0) {
      const task = STATE.marketplaceListPending.shift();
      const { item, auction, cardId, rarity, currentBid } = task;

      if (!item.isConnected) continue;

      try {
        const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`);
        const average = data?.summary?.[rarity]?.average
          ?? Object.values(data?.summary || {})[0]?.average;

        if (typeof average === 'number') {
          setCachedPrice(cardId, average);
          renderMarketplaceListBadge(item, auction, average, currentBid, rarity);
        } else {
          renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
        }
        item.dataset.wmListProcessed = 'done';

        STATE.consecutiveLimits = 0;
        STATE.delay = Math.max(CONFIG.DELAY_MIN, STATE.delay * CONFIG.RECOVERY_MULT);
      } catch (e) {
        if (e.status === 403 || e.status === 429) {
          STATE.consecutiveLimits++;
          STATE.delay = Math.min(CONFIG.DELAY_MAX, STATE.delay * CONFIG.BACKOFF_MULT);
          STATE.marketplaceListPending.unshift(task);
          item.dataset.wmListProcessed = 'pending';
        } else {
          item.dataset.wmListProcessed = 'error';
        }
      }

      await sleep(STATE.delay);
    }

    STATE.marketplaceListProcessing = false;
  };

  const ensureMarketplaceListUi = () => {
    if (!STATE.marketplaceListAuctions) return;

    const items = document.querySelectorAll('[id^="marketplace-auction-"]');

    for (const item of items) {
      if (item.dataset.wmListProcessed) continue;

      const listingId = item.id.replace('marketplace-auction-', '');
      const auction = STATE.marketplaceListAuctions.find(a => a.id === listingId);
      if (!auction) continue;

      item.dataset.wmListProcessed = 'pending';

      const cardId = auction.card_id;
      const rarity = auction.card?.rarity || auction.snapshot_rarity;
      const currentBid = auction.effective_bid ?? auction.current_bid ?? auction.base_amount;

      const cached = getCachedPrice(cardId);
      if (cached) {
        renderMarketplaceListBadge(item, auction, cached.price, currentBid, rarity);
        item.dataset.wmListProcessed = 'done';

        const age = Date.now() - cached.timestamp;
        if (age > CONFIG.CACHE_REFRESH_AGE) {
          refreshPriceInBackground(cardId, rarity);
        }
      } else {
        STATE.marketplaceListPending.push({ item, auction, cardId, rarity, currentBid });
      }
    }

    processMarketplaceListPending();
  };

  const scheduleMarketplaceListEnsure = (wait = 80) => {
    clearTimeout(STATE.marketplaceListEnsureTimer);
    STATE.marketplaceListEnsureTimer = setTimeout(ensureMarketplaceListUi, wait);
  };

  const refreshMarketplaceListIfSearchChanged = () => {
    if (!location.pathname.match(/^\/marketplace\/?$/)) return;

    const currentSearch = FETCH_INTERCEPT.lastMarketplaceQ || null;
    const previousSearch = STATE.marketplaceListLastSearch;

    if (currentSearch === previousSearch) return;

    STATE.marketplaceListLastSearch = currentSearch;

    cleanupMarketplaceListMode();
    startMarketplaceListMode();
  };

  const startMarketplaceListMode = async () => {
    cleanupMarketplaceListMode();

    const currentQ = FETCH_INTERCEPT.lastMarketplaceQ || null;
    STATE.marketplaceListLastSearch = currentQ;

    STATE.marketplaceListController = new AbortController();
    const signal = STATE.marketplaceListController.signal;

    const apiParams = new URLSearchParams();
    apiParams.set('page', '1');
    apiParams.set('limit', '50');
    apiParams.set('sort', 'recent');
    if (currentQ) apiParams.set('q', currentQ);

    const apiUrl = '/api/marketplace?' + apiParams.toString();

    try {
      const data = await fetchJson(apiUrl, { signal });
      if (signal.aborted) return;
      STATE.marketplaceListAuctions = data?.auctions || [];
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('[Wikimasters Helper] Marketplace list fetch failed:', e);
      return;
    }

    STATE.marketplaceListObserver = new MutationObserver(() => {
      scheduleMarketplaceListEnsure(80);
      refreshMarketplaceListIfSearchChanged();
    });
    STATE.marketplaceListObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleMarketplaceListEnsure(0);
  };

  /* =========================================================
   *             MARKETPLACE : détection panneau (détail)
   * ========================================================= */
  const findAuctionInfoPanel = () => {
    for (const panel of document.querySelectorAll('.card-frame')) {
      const text = (panel.innerText || '').replace(/\s+/g, ' ').trim();
      if (/MISE ACTUELLE|MISE DE D[ÉE]PART/i.test(text) &&
          /Temps restant/i.test(text)) {
        return panel;
      }
    }
    for (const element of document.querySelectorAll('div')) {
      const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
      if (!/MISE ACTUELLE|MISE DE D[ÉE]PART/i.test(text) ||
          !/Temps restant/i.test(text)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width >= 300 && rect.height >= 80 && rect.height <= 300) {
        return element;
      }
    }
    return null;
  };

  const findPriceContainerInPanel = (panel) => {
    const panelRect = panel.getBoundingClientRect();
    const topZone = panelRect.height * 0.5;

    for (const el of panel.querySelectorAll('div, span')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.top - panelRect.top > topZone) continue;

      const text = (el.textContent || '').trim();
      if (!/^\s*[\d\s.,]+\s*$/.test(text)) continue;
      if (el.children.length > 2) continue;

      return el;
    }
    return null;
  };

  const findBidButton = () =>
    [...document.querySelectorAll('button')].find(b =>
      b.textContent.trim() === 'Miser'
    ) || null;

  const isSellerView = () => {
    const text = document.body.innerText || '';
    return text.includes('Vous vendez cette carte') ||
           text.includes('Elle est réservée pour la durée');
  };

  /* =========================================================
   *             MARKETPLACE : vue vendeur (détail)
   * ========================================================= */
  const cleanupSellerAverageDom = () => {
    for (const wrapper of document.querySelectorAll('.wm-seller-price-wrapper')) {
      const originalPrice = wrapper.querySelector('[data-wm-original-price="1"]');
      if (originalPrice && wrapper.parentElement) {
        originalPrice.removeAttribute('data-wm-original-price');
        wrapper.parentElement.insertBefore(originalPrice, wrapper);
      }
      wrapper.remove();
    }
  };

  const insertSellerAveragePrice = (average) => {
    const panel = findAuctionInfoPanel();
    if (!panel) return false;

    const existing = panel.querySelector('.wm-seller-average');
    if (existing) {
      const value = existing.querySelector('.wm-seller-average-value');
      if (value) value.textContent = formatNumber(average);
      return true;
    }

    const priceContainer = findPriceContainerInPanel(panel);
    if (!priceContainer) return false;
    const currentPriceRow = priceContainer.parentElement;
    if (!currentPriceRow) return false;

    const wrapper = document.createElement('div');
    wrapper.className = 'wm-seller-price-wrapper';
    Object.assign(wrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: '5px'
    });

    priceContainer.setAttribute('data-wm-original-price', '1');
    currentPriceRow.insertBefore(wrapper, priceContainer);
    wrapper.appendChild(priceContainer);

    const line = document.createElement('div');
    line.className = 'wm-seller-average';

    const label = document.createElement('span');
    label.textContent = 'Prix moyen';

    const value = document.createElement('strong');
    value.className = 'wm-seller-average-value';
    value.textContent = formatNumber(average);
    Object.assign(value.style, {
      color: 'var(--color-accent)',
      fontWeight: '800'
    });

    line.append(
      createWikibidouIcon(14, 'var(--color-accent)'),
      label,
      value
    );
    wrapper.appendChild(line);

    return true;
  };

  /* =========================================================
   *             MARKETPLACE : vue acheteur (détail)
   * ========================================================= */
  const insertBuyerAverageComparison = (auction, average, bidButton) => {
    if (!bidButton?.isConnected) return false;

    let panel = bidButton;
    while (panel.parentElement) {
      panel = panel.parentElement;
      const text = panel.innerText || '';
      if (text.includes('Votre solde') && text.includes('Mise minimum')) break;
    }
    if (!panel) return false;

    const existing = panel.querySelector('.wm-market-comparison');
    if (existing) return true;

    const input = panel.querySelector('input[type="number"], input[inputmode="numeric"], input');

    const comparison = document.createElement('div');
    comparison.className = 'wm-market-comparison';

    const averageBlock = document.createElement('div');
    Object.assign(averageBlock.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: '#d1d5db'
    });

    const averageText = document.createElement('span');
    averageText.append(
      document.createTextNode('Prix moyen '),
      document.createTextNode(formatNumber(average))
    );
    averageBlock.append(
      createWikibidouIcon(16, '#34d399'),
      averageText
    );

    const difference = document.createElement('strong');
    comparison.append(averageBlock, difference);

    const updateDifference = () => {
      const defaultBid = auction.effective_bid ?? auction.current_bid ?? auction.base_amount ?? 0;
      const rawBid = input?.value || String(defaultBid);
      const bid = Number(String(rawBid).replace(/[^\d]/g, '')) || defaultBid;
      const delta = average - bid;

      if (delta > 0) {
        difference.textContent = `+${formatNumber(delta)} sous la moyenne`;
        difference.style.color = '#34d399';
      } else if (delta < 0) {
        difference.textContent = `${formatNumber(Math.abs(delta))} au-dessus`;
        difference.style.color = '#fb7185';
      } else {
        difference.textContent = 'Au prix moyen';
        difference.style.color = '#facc15';
      }
    };

    let bidRow = bidButton;
    while (bidRow && bidRow !== panel) {
      if (input && bidRow.contains(input)) break;
      bidRow = bidRow.parentElement;
    }

    if (bidRow && bidRow !== panel) {
      panel.insertBefore(comparison, bidRow);
    } else {
      panel.appendChild(comparison);
    }

    input?.addEventListener('input', updateDifference);
    updateDifference();
    return true;
  };

  /* =========================================================
   *             MARKETPLACE : sync UI (détail)
   * ========================================================= */
  const cleanupMarketplaceInjectedUi = () => {
    document.querySelectorAll('.wm-market-comparison').forEach(el => el.remove());
    cleanupSellerAverageDom();
  };

  const ensureMarketplaceUi = () => {
    if (!STATE.marketplaceContext) return;

    const { listingId, auction, average } = STATE.marketplaceContext;
    const match = location.pathname.match(/^\/marketplace\/([0-9a-f-]+)$/i);
    if (!match || match[1] !== listingId) return;

    const bidButton = findBidButton();
    if (bidButton) {
      cleanupSellerAverageDom();
      insertBuyerAverageComparison(auction, average, bidButton);
      return;
    }

    if (isSellerView()) {
      document.querySelectorAll('.wm-market-comparison').forEach(el => el.remove());
      insertSellerAveragePrice(average);
    }
  };

  const scheduleMarketplaceEnsure = (wait = 80) => {
    clearTimeout(STATE.marketplaceEnsureTimer);
    STATE.marketplaceEnsureTimer = setTimeout(ensureMarketplaceUi, wait);
  };

  /* =========================================================
   *             MARKETPLACE (détail) : démarrage & nettoyage
   * ========================================================= */
  const cleanupMarketplaceMode = () => {
    clearTimeout(STATE.marketplaceEnsureTimer);
    STATE.marketplaceEnsureTimer = null;

    if (STATE.marketplaceObserver) {
      STATE.marketplaceObserver.disconnect();
      STATE.marketplaceObserver = null;
    }
    if (STATE.marketplaceController) {
      STATE.marketplaceController.abort();
      STATE.marketplaceController = null;
    }
    STATE.marketplaceContext = null;
    cleanupMarketplaceInjectedUi();
  };

  const startMarketplaceMode = async (pathname) => {
    cleanupMarketplaceMode();

    const match = pathname.match(/^\/marketplace\/([0-9a-f-]+)$/i);
    if (!match) return;

    const listingId = match[1];
    const localGeneration = STATE.routeGeneration;

    STATE.marketplaceController = new AbortController();
    const signal = STATE.marketplaceController.signal;

    STATE.marketplaceObserver = new MutationObserver(() => {
      scheduleMarketplaceEnsure(80);
    });
    STATE.marketplaceObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    try {
      const listingData = await fetchJson(`/api/marketplace/${listingId}`, { signal });

      if (signal.aborted || localGeneration !== STATE.routeGeneration ||
          location.pathname !== pathname) return;

      const auction = listingData?.auction;
      if (!auction?.card_id || !auction?.card?.rarity) return;

      let average = getCachedPrice(auction.card_id)?.price;

      if (typeof average !== 'number') {
        const salesData = await fetchJson(
          `/api/marketplace/cards/${auction.card_id}/sales?scope=summary`,
          { signal }
        );
        if (signal.aborted || localGeneration !== STATE.routeGeneration ||
            location.pathname !== pathname) return;

        average = salesData?.summary?.[auction.card.rarity]?.average
          ?? Object.values(salesData?.summary || {})[0]?.average;

        if (typeof average === 'number') {
          setCachedPrice(auction.card_id, average);
        }
      }

      if (typeof average !== 'number') {
        console.warn('[Wikimasters Helper] Prix moyen non disponible.');
        return;
      }

      STATE.marketplaceContext = { listingId, auction, average };
      scheduleMarketplaceEnsure(0);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[Wikimasters Helper] Erreur marketplace:', error);
    }
  };

  /* =========================================================
   *             ROUTING SPA
   * ========================================================= */
  const cleanupCurrentMode = () => {
    cleanupCollectionMode();
    cleanupMarketplaceMode();
    cleanupMarketplaceListMode();
  };

  const getRouteKind = (pathname) => {
    if (pathname.startsWith('/collection')) return 'collection';
    if (/^\/marketplace\/?$/.test(pathname)) return 'marketplace-list';
    if (/^\/marketplace\/[0-9a-f-]+$/i.test(pathname)) return 'marketplace';
    return 'other';
  };

  const handleRouteChange = (force = false) => {
    const pathname = location.pathname;

    if (!force && pathname === STATE.currentRoute) return;

    STATE.currentRoute = pathname;
    STATE.routeGeneration++;
    STATE.stopped = false;
    STATE.consecutiveLimits = 0;
    STATE.delay = CONFIG.DELAY_START;
    STATE.fetched.clear();

    cleanupCurrentMode();

    if (!/^\/marketplace\/?$/.test(pathname)) {
      FETCH_INTERCEPT.lastMarketplaceQ = null;
    }

    const kind = getRouteKind(pathname);
    console.log('[Wikimasters Helper] Route:', pathname, '→', kind);

    if (kind === 'collection') {
      startCollectionMode();
      return;
    }
    if (kind === 'marketplace-list') {
      startMarketplaceListMode();
      return;
    }
    if (kind === 'marketplace') {
      startMarketplaceMode(pathname);
    }
  };

  const scheduleRouteCheck = (wait = 0) => {
    clearTimeout(STATE.routeCheckTimer);
    STATE.routeCheckTimer = setTimeout(() => handleRouteChange(false), wait);
  };

  /* =========================================================
   *             INTERCEPTION HISTORY API
   * ========================================================= */
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    scheduleRouteCheck(0);
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    scheduleRouteCheck(0);
    return result;
  };

  window.addEventListener('popstate', () => scheduleRouteCheck(0));

  const routeObserver = new MutationObserver(() => {
    if (location.pathname !== STATE.currentRoute) {
      scheduleRouteCheck(0);
    }
  });
  routeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  /* =========================================================
   *             INITIALISATION
   * ========================================================= */
  const init = () => {
    STATE.priceCache = loadCache();
    injectStyles();
    injectVersionBadge();
    handleRouteChange(true);
    console.log(`[Wikimasters Helper] V${VERSION} initialisé ✓`);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// ==UserScript==
// @name         Wikimasters Helper
// @namespace    wikimasters.helper
// @version      1.5.0
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

  const VERSION = '1.5.0';
  const DEBUG = false;

  const log = (...args) => { if (DEBUG) console.log('%c[WMH]', 'color:#34d399;font-weight:bold', ...args); };
  const logWarn = (...args) => { if (DEBUG) console.warn('%c[WMH]', 'color:#fbbf24;font-weight:bold', ...args); };
  const logErr = (...args) => { if (DEBUG) console.error('%c[WMH]', 'color:#f87171;font-weight:bold', ...args); };

  let rateLimitCount = 0;   // 429
  let forbiddenCount = 0;   // total 403

  const IS_MOBILE = window.matchMedia('(max-width: 767px)').matches;

  /* =========================================================
   *             INTERCEPTION FETCH
   * ========================================================= */
  const FETCH_INTERCEPT = {
    lastMarketplaceQ: null,
    lastPackCards: []
  };

  const _originalFetch = window.fetch.bind(window);

  window.fetch = function (...args) {
    let url = '';
    try {
      url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    } catch {}

    try {
      if (url.includes('/api/marketplace?')) {
        const u = new URL(url, location.origin);
        if (u.searchParams.has('q')) {
          FETCH_INTERCEPT.lastMarketplaceQ = u.searchParams.get('q') || null;
        }
      }
    } catch {}

    const promise = _originalFetch(...args);

    if (url.includes('/api/packs/open')) {
      promise
        .then((response) => {
          try {
            const clone = response.clone();
            clone
              .json()
              .then((data) => {
                if (data && Array.isArray(data.cards)) {
                  log(`📦 POST /api/packs/open reçu : ${data.cards.length} cartes`);
                  FETCH_INTERCEPT.lastPackCards = data.cards;
                  STATE.pullsFetched.clear();
                  STATE.pullsInFlight.clear();
                  if (location.pathname === '/pulls') {
                    schedulePullsSync(300);
                  }
                }
              })
              .catch(() => {});
          } catch {}
        })
        .catch(() => {});
    }

    return promise;
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

    // ─── Dispatcher rate-limité ───
    CONCURRENCY: 3,
    FETCH_WINDOW_MS: 60000,
    FETCH_WINDOW_MAX: 25,
    FETCH_WINDOW_PANIC: 15,
    PANIC_DURATION_MS: 60000,
    DISPATCHER_TICK_MS: 100,

    // ─── Priorité viewport ───
    VIEWPORT_ROOT_MARGIN: '200px 0px',

    // ─── Cooldown par carte sur 403 ───
    FORBIDDEN_COOLDOWN_MS: 30 * 1000,

    // ─── Filtre collection (debounce) ───
    FILTER_DEBOUNCE_MS: 400,

    LONG_PRESS_DURATION: 500,

    CHANGELOG_URL: 'https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/CHANGELOG.md',

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
    fetchWindow: [],
    inFlight: 0,
    dispatcherTimer: null,
    panicUntil: 0,
    consecutive403: 0,
    stopped: false,
    cacheSaveScheduled: false,

    coolingDown: new Map(),

    activePriceControllers: new Set(),
    collectionLoadController: null,
    marketplaceController: null,

    currentRoute: null,
    routeGeneration: 0,
    routeCheckTimer: null,

    collectionObserver: null,
    viewportObserver: null,
    collectionClickHandler: null,
    collectionSyncTimer: null,
    collectionGeneration: 0,
    currentCollectionPage: null,
    currentCollectionCards: [],

    pullsObserver: null,
    pullsInterval: null,
    pullsSyncTimer: null,
    pullsGeneration: 0,
    pullsFetched: new Set(),
    pullsInFlight: new Set(),

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

    noSalesRefresh: {},
    mobilePopup: null,
    changelogCache: null
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
      .wm-price-badge.wm-loading { animation: wm-pulse 1s infinite; }
      @keyframes wm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
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
        left: 20px;
        top: 4px;
        z-index: 9999;
        padding: 3px 8px;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
        font-size: 10px;
        font-weight: 500;
        color: inherit;
        background: transparent;
        border: none;
        cursor: pointer;
        opacity: 0.5;
        transition: opacity .2s ease;
        white-space: pre-line;
        text-align: left;
        line-height: 1.3;
        display: inline-block;
      }
      .wm-version-badge:hover { opacity: 1; }
      .wm-version-badge-mobile { left: 8px; top: 4px; }
      .wm-price-badge, .wm-market-list-badge {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      .wm-mobile-popup-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        animation: wm-popup-fadein 0.15s ease-out;
      }
      @keyframes wm-popup-fadein { from { opacity: 0; } to { opacity: 1; } }
      .wm-mobile-popup-content {
        background: #1a1a1a;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 14px;
        padding: 20px;
        max-width: 380px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        color: #ffffff;
        font: 500 14px/1.5 system-ui, sans-serif;
        position: relative;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        animation: wm-popup-slidein 0.18s ease-out;
      }
      @keyframes wm-popup-slidein {
        from { transform: translateY(10px) scale(0.98); opacity: 0; }
        to   { transform: translateY(0) scale(1); opacity: 1; }
      }
      .wm-mobile-popup-close {
        position: absolute; top: 8px; right: 8px;
        width: 32px; height: 32px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        border: none; color: #ffffff; font-size: 18px; line-height: 1;
        cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
      }
      .wm-mobile-popup-close:hover { background: rgba(255, 255, 255, 0.15); }
      .wm-mobile-popup-title {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        opacity: 0.55; margin: 0 0 6px 0;
      }
      .wm-mobile-popup-price {
        font-size: 28px; font-weight: 800; color: #34d399; margin: 0 0 16px 0; line-height: 1;
      }
      .wm-mobile-popup-row {
        display: flex; justify-content: space-between; padding: 6px 0;
        font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .wm-mobile-popup-row:last-of-type { border-bottom: none; }
      .wm-mobile-popup-label { opacity: 0.6; }
      .wm-mobile-popup-value { font-weight: 600; text-align: right; }
      .wm-mobile-popup-refresh {
        margin-top: 16px; width: 100%; padding: 12px; border-radius: 8px;
        border: none; background: rgba(52, 211, 153, 0.15);
        color: #34d399; font-weight: 700; font-size: 14px; cursor: pointer;
        transition: background 0.15s ease;
      }
      .wm-mobile-popup-refresh:hover, .wm-mobile-popup-refresh:active {
        background: rgba(52, 211, 153, 0.25);
      }
      .wm-mobile-popup-refresh:disabled { opacity: 0.5; cursor: wait; }
      .wm-mobile-popup-empty { font-size: 14px; opacity: 0.7; padding: 8px 0 16px 0; }
      .wm-whatsnew-version { margin-bottom: 20px; }
      .wm-whatsnew-version-header {
        display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;
      }
      .wm-whatsnew-version-number { font-size: 18px; font-weight: 800; color: #34d399; }
      .wm-whatsnew-version-date { font-size: 12px; opacity: 0.5; }
      .wm-whatsnew-section { margin-top: 8px; }
      .wm-whatsnew-section-title {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        opacity: 0.55; margin: 0 0 4px 0;
      }
      .wm-whatsnew-list { margin: 0; padding-left: 16px; font-size: 13px; }
      .wm-whatsnew-list li { margin-bottom: 3px; }
      .wm-whatsnew-loading { text-align: center; padding: 20px 0; opacity: 0.6; }
      .wm-whatsnew-error { text-align: center; padding: 20px 0; color: #f87171; font-size: 13px; }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const updateVersionBadgeLabel = () => {
    const badge = document.querySelector('.wm-version-badge');
    if (!badge) return;
    let txt = `WMH - v${VERSION}`;
    if (rateLimitCount > 0 || forbiddenCount > 0) {
      const parts = [];
      if (rateLimitCount > 0) parts.push(`R:${rateLimitCount}`);
      if (forbiddenCount > 0) parts.push(`403:${forbiddenCount}`);
      txt += `\n⚠️ ${parts.join(' · ')}`;
    }
    badge.textContent = txt;
  };

  const injectVersionBadge = () => {
    if (document.querySelector('.wm-version-badge')) return;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'wm-version-badge' + (IS_MOBILE ? ' wm-version-badge-mobile' : '');
    badge.textContent = `WMH - v${VERSION}`;
    badge.title = `Wikimasters Helper • v${VERSION}\nCliquer pour voir les nouveautés`;
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWhatsNewPopup();
    });
    document.body.appendChild(badge);
  };

  /* =========================================================
   *             UTILITAIRES
   * ========================================================= */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(value);

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

  const isFilterActive = () => {
    try {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        if (input.type === 'hidden') continue;
        if (input.offsetParent === null) continue;
        if (input.value && input.value.trim().length > 0) return true;
      }
    } catch {}
    return false;
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
    let best = null, bestDist = Infinity;
    for (const p of entry.history) {
      if (p.timestamp < minTime || p.timestamp > maxTime) continue;
      const dist = Math.abs(p.timestamp - target);
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    if (!best || !best.price) return null;
    const deltaPct = ((entry.price - best.price) / best.price) * 100;
    return { deltaPct, referencePrice: best.price, referenceAge: now - best.timestamp };
  };

  const buildBadgeTitle = (cardId, card = null) => {
    const entry = STATE.priceCache[cardId];
    if (!entry || typeof entry.price !== 'number') return '';
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

  const createWikibidouIcon = (size, color) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    Object.assign(svg.style, { width: `${size}px`, height: `${size}px`, flexShrink: '0', color });
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
          if (e && typeof e.timestamp === 'number') {
            if (!Array.isArray(e.history)) {
              e.history = (typeof e.price === 'number') ? [{ price: e.price, timestamp: e.timestamp }] : [];
            }
            if (typeof e.noSales !== 'boolean') e.noSales = false;
            if (typeof e.price !== 'number') e.price = null;
          }
        }
        return saved.prices;
      }
      return {};
    } catch { return {}; }
  };

  const saveCache = () => {
    try {
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
        expiresAt: Date.now() + CONFIG.CACHE_MAX_AGE,
        prices: STATE.priceCache
      }));
    } catch (e) { logErr('Erreur sauvegarde cache:', e); }
  };

  const saveCacheLater = () => {
    if (STATE.cacheSaveScheduled) return;
    STATE.cacheSaveScheduled = true;
    const run = () => { STATE.cacheSaveScheduled = false; saveCache(); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1000 });
    else setTimeout(run, 0);
  };

  const getCachedPrice = (cardId) => {
    const entry = STATE.priceCache[cardId];
    if (!entry) return null;
    if (typeof entry.timestamp !== 'number') return null;
    if (Date.now() - entry.timestamp > CONFIG.CACHE_MAX_AGE) return null;
    if (typeof entry.price === 'number') return entry;
    if (entry.noSales) return entry;
    return null;
  };

  const getStaleCachedPrice = (cardId) => {
    const entry = STATE.priceCache[cardId];
    if (!entry) return null;
    if (typeof entry.price === 'number') return entry;
    return null;
  };

  const setCachedPrice = (cardId, price) => {
    const now = Date.now();
    let entry = STATE.priceCache[cardId];
    if (!entry) {
      entry = { price, noSales: false, timestamp: now, history: [] };
      STATE.priceCache[cardId] = entry;
    } else {
      entry.price = price;
      entry.noSales = false;
      entry.timestamp = now;
    }
    if (!Array.isArray(entry.history)) entry.history = [];
    const last = entry.history[entry.history.length - 1];
    const shouldRecord = !last || last.price !== price || (now - last.timestamp) > CONFIG.HISTORY_MIN_INTERVAL;
    if (shouldRecord) {
      entry.history.push({ price, timestamp: now });
      if (entry.history.length > CONFIG.HISTORY_MAX_POINTS) entry.history.shift();
    }
    saveCacheLater();
  };

  const setCachedNoSales = (cardId) => {
    const now = Date.now();
    let entry = STATE.priceCache[cardId];
    if (!entry) {
      entry = { price: null, noSales: true, timestamp: now, history: [] };
      STATE.priceCache[cardId] = entry;
    } else {
      entry.noSales = true;
      entry.timestamp = now;
    }
    saveCacheLater();
  };

  /* =========================================================
   *             COOLDOWN (403 par carte)
   * ========================================================= */
  const isCardCoolingDown = (cardId) => {
    const cd = STATE.coolingDown.get(cardId);
    if (!cd) return false;
    if (Date.now() < cd.until) return true;
    STATE.coolingDown.delete(cardId);
    return false;
  };

  const markCardForbidden = (cardId, title) => {
    const until = Date.now() + CONFIG.FORBIDDEN_COOLDOWN_MS;
    STATE.coolingDown.set(cardId, { until });
    forbiddenCount++;
    updateVersionBadgeLabel();
    logWarn(`🚫 403 "${title || cardId.substring(0, 8)}" → cooldown ${CONFIG.FORBIDDEN_COOLDOWN_MS / 1000}s`);
  };

  /* =========================================================
   *             API
   * ========================================================= */
  const fetchJson = async (url, { signal } = {}) => {
    const response = await fetch(url, { credentials: 'include', cache: 'default', signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  };

  const fetchPriceForCard = async (cardId, rarity, { signal, forceRefresh = false, title = null } = {}) => {
    if (!forceRefresh && isCardCoolingDown(cardId)) return undefined;

    const cached = getCachedPrice(cardId);
    if (!forceRefresh && cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CONFIG.CACHE_REFRESH_AGE) {
        return typeof cached.price === 'number' ? cached.price : null;
      }
      refreshPriceInBackground(cardId, rarity);
      return typeof cached.price === 'number' ? cached.price : null;
    }

    try {
      const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`, { signal });
      const average = data?.summary?.[rarity]?.average
        ?? Object.values(data?.summary || {})[0]?.average;
      if (typeof average === 'number') {
        setCachedPrice(cardId, average);
        STATE.consecutive403 = 0;
        return average;
      }
      setCachedNoSales(cardId);
      STATE.consecutive403 = 0;
      return null;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      if (e.status === 403) {
        markCardForbidden(cardId, title);
        STATE.consecutive403++;
        if (STATE.consecutive403 >= 1) {
          STATE.panicUntil = Date.now() + CONFIG.PANIC_DURATION_MS;
          logWarn(`⚠️ Mode panique activé (fenêtre réduite à ${CONFIG.FETCH_WINDOW_PANIC}/min pendant ${CONFIG.PANIC_DURATION_MS/1000}s)`);
        }
        return undefined;
      }
      const fallback = getStaleCachedPrice(cardId);
      if (fallback) return fallback.price;
      return undefined;
    }
  };

  const refreshPriceInBackground = async (cardId, rarity) => {
    if (isCardCoolingDown(cardId)) return;
    try {
      const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`);
      const average = data?.summary?.[rarity]?.average
        ?? Object.values(data?.summary || {})[0]?.average;
      if (typeof average === 'number') setCachedPrice(cardId, average);
      else setCachedNoSales(cardId);
    } catch (e) {
      if (e?.status === 403) markCardForbidden(cardId, cardId.substring(0, 8));
    }
  };

  /* =========================================================
   *             DISPATCHER
   * ========================================================= */
  const pruneFetchWindow = () => {
    const cutoff = Date.now() - CONFIG.FETCH_WINDOW_MS;
    while (STATE.fetchWindow.length > 0 && STATE.fetchWindow[0] < cutoff) {
      STATE.fetchWindow.shift();
    }
  };

  const currentWindowMax = () => {
    if (Date.now() < STATE.panicUntil) return CONFIG.FETCH_WINDOW_PANIC;
    return CONFIG.FETCH_WINDOW_MAX;
  };

  const canDispatch = () => {
    if (STATE.stopped) return false;
    if (STATE.queue.length === 0) return false;
    if (STATE.inFlight >= CONFIG.CONCURRENCY) return false;
    pruneFetchWindow();
    if (STATE.fetchWindow.length >= currentWindowMax()) return false;
    return true;
  };

  const processItem = async (item) => {
    const { card, root, generation, rarity } = item;
    const cardId = card.card_id || card.id;
    const title = card.card?.wikipedia_title || card.title || cardId.substring(0, 8);

    if (generation !== STATE.collectionGeneration &&
        generation !== STATE.pullsGeneration) return;

    try {
      const average = await fetchPriceForCard(cardId, rarity, { title });

      if (root.isConnected) {
        if (typeof average === 'number') showPriceBadge(root, card, average, 'ok');
        else if (average === null) showPriceBadge(root, card, null, 'nosales');
        else if (isCardCoolingDown(cardId)) showPriceBadge(root, card, null, 'blocked');
        else showPriceBadge(root, card, null, 'error');

        // Marquer comme traité (ne reviendra pas dans la queue)
        root.dataset.wmFetched = '1';
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      logErr('Erreur processItem:', e);
    }
  };

  const dispatch = () => {
    while (canDispatch()) {
      const item = STATE.queue.shift();
      STATE.fetchWindow.push(Date.now());
      STATE.inFlight++;

      processItem(item).finally(() => {
        STATE.inFlight--;
      });
    }
  };

  const startDispatcher = () => {
    if (STATE.dispatcherTimer) return;
    STATE.dispatcherTimer = setInterval(dispatch, CONFIG.DISPATCHER_TICK_MS);
  };

  const resetDispatcher = () => {
    STATE.queue.length = 0;
    STATE.fetchWindow.length = 0;
    STATE.inFlight = 0;
    STATE.panicUntil = 0;
    STATE.consecutive403 = 0;
    for (const controller of STATE.activePriceControllers) {
      try { controller.abort(); } catch {}
    }
    STATE.activePriceControllers.clear();
  };

  /* =========================================================
   *             ENQUEUE
   * ========================================================= */
  const enqueue = (card, root, generation, priority = 0) => {
    const cardId = card.card_id || card.id;
    const rarity = card.card?.rarity || card.rarity;

    updateCardHalo(root, card);

    if (isCardCoolingDown(cardId)) {
      if (!root.querySelector(`.wm-price-badge[data-card-id="${cardId}"]`)) {
        showPriceBadge(root, card, null, 'blocked');
      }
      root.dataset.wmFetched = '1';
      return;
    }

    const cached = getCachedPrice(cardId);
    if (cached) {
      if (typeof cached.price === 'number') showPriceBadge(root, card, cached.price, 'ok');
      else if (cached.noSales) showPriceBadge(root, card, null, 'nosales');
      root.dataset.wmFetched = '1';
      const age = Date.now() - cached.timestamp;
      if (age > CONFIG.CACHE_REFRESH_AGE) refreshPriceInBackground(cardId, rarity);
      return;
    }

    if (STATE.stopped) return;

    const item = { card, root, generation, rarity, priority };

    if (priority > 0) {
      const insertAt = STATE.queue.findIndex(it => it.priority < priority);
      if (insertAt === -1) STATE.queue.push(item);
      else STATE.queue.splice(insertAt, 0, item);
    } else {
      STATE.queue.push(item);
    }
  };

  /* =========================================================
   *             WHAT'S NEW
   * ========================================================= */
  const parseChangelog = (markdown, count = 3) => {
    const versions = [];
    const lines = markdown.split('\n');
    let current = null;
    for (const line of lines) {
      const m = line.match(/^##\s+\[([\d.]+)\]\s+—\s+(.+)$/);
      if (m) {
        if (current) versions.push(current);
        if (versions.length >= count) { current = null; break; }
        current = { version: m[1], date: m[2], sections: [] };
        continue;
      }
      if (!current) continue;
      const sm = line.match(/^###\s+(.+)$/);
      if (sm) { current.sections.push({ title: sm[1], items: [] }); continue; }
      const im = line.match(/^-\s+(.+)$/);
      if (im && current.sections.length > 0) current.sections[current.sections.length - 1].items.push(im[1]);
    }
    if (current && versions.length < count) versions.push(current);
    return versions;
  };

  const openWhatsNewPopup = async () => {
    closeMobilePopup();
    const overlay = document.createElement('div');
    overlay.className = 'wm-mobile-popup-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMobilePopup(); });
    const content = document.createElement('div');
    content.className = 'wm-mobile-popup-content';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wm-mobile-popup-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMobilePopup(); });
    content.appendChild(closeBtn);
    const title = document.createElement('p');
    title.className = 'wm-mobile-popup-title';
    title.textContent = "Nouveautés";
    content.appendChild(title);
    const loading = document.createElement('div');
    loading.className = 'wm-whatsnew-loading';
    loading.textContent = 'Chargement...';
    content.appendChild(loading);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    STATE.mobilePopup = overlay;
    try {
      let markdown = STATE.changelogCache;
      if (!markdown) {
        const response = await _originalFetch(CONFIG.CHANGELOG_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        markdown = await response.text();
        STATE.changelogCache = markdown;
      }
      const versions = parseChangelog(markdown, 3);
      content.removeChild(loading);
      if (versions.length === 0) {
        const err = document.createElement('div');
        err.className = 'wm-whatsnew-error';
        err.textContent = 'Impossible de lire le changelog.';
        content.appendChild(err);
        return;
      }
      for (const v of versions) {
        const versionBlock = document.createElement('div');
        versionBlock.className = 'wm-whatsnew-version';
        const header = document.createElement('div');
        header.className = 'wm-whatsnew-version-header';
        const num = document.createElement('span');
        num.className = 'wm-whatsnew-version-number';
        num.textContent = `v${v.version}`;
        const date = document.createElement('span');
        date.className = 'wm-whatsnew-version-date';
        date.textContent = v.date;
        header.append(num, date);
        versionBlock.appendChild(header);
        for (const section of v.sections) {
          if (section.items.length === 0) continue;
          const secBlock = document.createElement('div');
          secBlock.className = 'wm-whatsnew-section';
          const secTitle = document.createElement('p');
          secTitle.className = 'wm-whatsnew-section-title';
          secTitle.textContent = section.title;
          secBlock.appendChild(secTitle);
          const list = document.createElement('ul');
          list.className = 'wm-whatsnew-list';
          for (const item of section.items) {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
          }
          secBlock.appendChild(list);
          versionBlock.appendChild(secBlock);
        }
        content.appendChild(versionBlock);
      }
    } catch (e) {
      logErr('Erreur chargement CHANGELOG:', e);
      if (content.contains(loading)) content.removeChild(loading);
      const err = document.createElement('div');
      err.className = 'wm-whatsnew-error';
      err.textContent = 'Impossible de charger les nouveautés. Vérifie ta connexion.';
      content.appendChild(err);
    }
  };

  /* =========================================================
   *             DÉTECTION CARTE (Fiber)
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
        return { id: card.id || card.card_id || card.cardId, rarity: card.rarity || card.grade, card };
      }
      child = child.child;
      depth++;
    }
    return null;
  };

  const getCardDataFromFiberDeep = (domEl) => {
    if (!domEl) return null;
    const fiberKey = Object.keys(domEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;
    const fromChild = getCardDataFromFiber(domEl);
    if (fromChild?.id) return fromChild;
    let fiber = domEl[fiberKey];
    let depth = 0;
    while (fiber && depth < 12) {
      const card = fiber.memoizedProps?.card;
      if (card?.id || card?.card_id || card?.cardId) {
        return { id: card.id || card.card_id || card.cardId, rarity: card.rarity || card.grade, card };
      }
      fiber = fiber.return;
      depth++;
    }
    return null;
  };

  const getVisibleCardRoots = () => {
    const roots = [];
    for (const sword of document.querySelectorAll('svg.lucide-swords')) {
      let element = sword;
      for (let i = 0; i < 10 && element.parentElement; i++) {
        element = element.parentElement;
        const rect = element.getBoundingClientRect();
        if (rect.width >= 110 && rect.width <= 260 &&
            rect.height >= 180 && rect.height <= 500 &&
            element.offsetParent !== null) {
          roots.push(element);
          break;
        }
      }
    }
    return roots;
  };

  const getPackCardRoots = () => {
    const roots = new Set();
    for (const el of document.querySelectorAll('[class*="glow-"]')) {
      const cls = typeof el.className === 'string' ? el.className : '';
      if (!/glow-/.test(cls)) continue;
      const h3 = el.querySelector('h3');
      if (!h3) continue;
      roots.add(el);
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
    } catch { return null; }
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
    try { elements = [...root.querySelectorAll(selectors.join(', '))]; } catch { elements = []; }
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
      try { return CSS.supports('color', value.trim()) ? value : null; } catch { return null; }
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
        try { if (CSS.supports('color', candidate.trim())) return candidate; } catch {}
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
      return { present: true, color: tag?.color || null, text: tag?.name || null, count: card.tags.length };
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
   *             POPUP MOBILE
   * ========================================================= */
  const closeMobilePopup = () => {
    if (STATE.mobilePopup) {
      STATE.mobilePopup.remove();
      STATE.mobilePopup = null;
    }
  };

  const buildMobilePopupContent = (cardId, card, rarity) => {
    const entry = getCachedPrice(cardId);
    const hasPrice = entry && typeof entry.price === 'number';
    const container = document.createElement('div');
    container.className = 'wm-mobile-popup-content';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wm-mobile-popup-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMobilePopup(); });
    container.appendChild(closeBtn);
    const title = document.createElement('p');
    title.className = 'wm-mobile-popup-title';
    title.textContent = `Prix moyen${rarity ? ' • ' + rarity : ''}`;
    container.appendChild(title);
    if (hasPrice) {
      const priceEl = document.createElement('p');
      priceEl.className = 'wm-mobile-popup-price';
      priceEl.textContent = formatNumber(entry.price);
      container.appendChild(priceEl);
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const rowDate = document.createElement('div');
      rowDate.className = 'wm-mobile-popup-row';
      const lblDate = document.createElement('span');
      lblDate.className = 'wm-mobile-popup-label';
      lblDate.textContent = 'Actualisé';
      const valDate = document.createElement('span');
      valDate.className = 'wm-mobile-popup-value';
      valDate.textContent = `${dateStr} à ${timeStr} (${formatAge(Date.now() - entry.timestamp)})`;
      rowDate.append(lblDate, valDate);
      container.appendChild(rowDate);
      const t24 = getTrend(cardId, CONFIG.TREND_WINDOWS.d1);
      const row24 = document.createElement('div');
      row24.className = 'wm-mobile-popup-row';
      const lbl24 = document.createElement('span');
      lbl24.className = 'wm-mobile-popup-label';
      lbl24.textContent = 'Tendance 24h';
      const val24 = document.createElement('span');
      val24.className = 'wm-mobile-popup-value';
      if (t24) {
        const c = classifyTrend(t24.deltaPct);
        const sign = t24.deltaPct >= 0 ? '+' : '';
        val24.textContent = `${c.symbol} ${sign}${t24.deltaPct.toFixed(1)} %`;
        val24.style.color = c.color;
      } else {
        val24.textContent = '—';
        val24.style.opacity = '0.5';
      }
      row24.append(lbl24, val24);
      container.appendChild(row24);
      const t7d = getTrend(cardId, CONFIG.TREND_WINDOWS.d7);
      const row7d = document.createElement('div');
      row7d.className = 'wm-mobile-popup-row';
      const lbl7d = document.createElement('span');
      lbl7d.className = 'wm-mobile-popup-label';
      lbl7d.textContent = 'Tendance 7j';
      const val7d = document.createElement('span');
      val7d.className = 'wm-mobile-popup-value';
      if (t7d) {
        const c = classifyTrend(t7d.deltaPct);
        const sign = t7d.deltaPct >= 0 ? '+' : '';
        val7d.textContent = `${c.symbol} ${sign}${t7d.deltaPct.toFixed(1)} %`;
        val7d.style.color = c.color;
      } else {
        val7d.textContent = '—';
        val7d.style.opacity = '0.5';
      }
      row7d.append(lbl7d, val7d);
      container.appendChild(row7d);
    } else {
      const empty = document.createElement('p');
      empty.className = 'wm-mobile-popup-empty';
      empty.textContent = 'Aucune vente enregistrée pour cette carte.';
      container.appendChild(empty);
    }
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'wm-mobile-popup-refresh';
    refreshBtn.type = 'button';
    refreshBtn.textContent = 'Rafraîchir';
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Actualisation...';
      try { await doForceRefresh(cardId, card, rarity); } catch (err) { logErr('Refresh popup échoué:', err); }
      closeMobilePopup();
      openMobilePopup(cardId, card, rarity);
    });
    container.appendChild(refreshBtn);
    return container;
  };

  const openMobilePopup = (cardId, card, rarity) => {
    closeMobilePopup();
    const overlay = document.createElement('div');
    overlay.className = 'wm-mobile-popup-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMobilePopup(); });
    const content = buildMobilePopupContent(cardId, card, rarity);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    STATE.mobilePopup = overlay;
  };

  /* =========================================================
   *             REFRESH MANUEL
   * ========================================================= */
  const doForceRefresh = async (cardId, card, rarity) => {
    const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`);
    const average = data?.summary?.[rarity]?.average
      ?? Object.values(data?.summary || {})[0]?.average;
    if (typeof average === 'number') {
      if (STATE.coolingDown.has(cardId)) STATE.coolingDown.delete(cardId);
      setCachedPrice(cardId, average);
      return true;
    }
    setCachedNoSales(cardId);
    return false;
  };

  /* =========================================================
   *             INTERACTIONS BADGE
   * ========================================================= */
  const attachBadgeInteractions = (badge, opts) => {
    const { cardId, card, rarity, isMarketplace = false, onRefreshDone = null } = opts;
    if (IS_MOBILE) {
      let longPressTimer = null;
      let touchStartX = 0, touchStartY = 0, triggered = false;
      badge.addEventListener('touchstart', (e) => {
        triggered = false;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        longPressTimer = setTimeout(async () => {
          triggered = true;
          badge.classList.add('wm-loading');
          try {
            const hasPrice = await doForceRefresh(cardId, card, rarity);
            if (onRefreshDone) onRefreshDone(hasPrice);
            else showPriceBadge(badge.closest('[data-wm-root]') || badge.parentElement, card, hasPrice ? STATE.priceCache[cardId].price : null, hasPrice ? 'ok' : 'nosales');
          } catch (err) {
            logErr('Appui long refresh échoué:', err);
            if (!onRefreshDone) showPriceBadge(badge.closest('[data-wm-root]') || badge.parentElement, card, null, 'error');
          } finally { badge.classList.remove('wm-loading'); }
        }, CONFIG.LONG_PRESS_DURATION);
      }, { passive: true });
      badge.addEventListener('touchmove', (e) => {
        if (!longPressTimer) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);
        if (dx > 10 || dy > 10) { clearTimeout(longPressTimer); longPressTimer = null; }
      }, { passive: true });
      badge.addEventListener('touchend', (e) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          if (!triggered) { e.preventDefault(); e.stopPropagation(); openMobilePopup(cardId, card, rarity); }
        }
      });
      badge.addEventListener('touchcancel', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });
      badge.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
    } else {
      badge.addEventListener('mousedown', (e) => e.stopPropagation());
      badge.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
      badge.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMarketplace) {
          const start = Date.now();
          badge.classList.add('wm-loading');
          doForceRefresh(cardId, card, rarity)
            .then((hasPrice) => {
              const elapsed = Date.now() - start;
              const wait = Math.max(0, 400 - elapsed);
              setTimeout(() => {
                if (onRefreshDone) onRefreshDone(hasPrice);
                badge.classList.remove('wm-loading');
              }, wait);
            })
            .catch((err) => { logErr('Refresh marketplace échoué:', err); badge.classList.remove('wm-loading'); });
        } else {
          handleManualRefresh(cardId, badge.closest('[data-wm-root]') || badge.parentElement, card);
        }
      });
    }
  };

  /* =========================================================
   *             AFFICHAGE BADGE DE PRIX
   * ========================================================= */
  const showPriceBadge = (root, card, price, state) => {
    const row = getStatsRow(root);
    if (!row) return;
    const cardId = card.card_id || card.id;
    const rarity = card.card?.rarity || card.rarity || '';
    if (!state) state = typeof price === 'number' ? 'ok' : 'nosales';
    const selector = `.wm-price-badge[data-card-id="${cardId}"]`;
    const existing = row.querySelector(selector);
    let freshStyle, trendInfo, title, displayValue;
    if (state === 'ok') {
      const entry = STATE.priceCache[cardId];
      const age = entry ? (Date.now() - entry.timestamp) : 0;
      freshStyle = getFreshnessStyle(age);
      const t24 = entry ? getTrend(cardId, CONFIG.TREND_WINDOWS.d1) : null;
      trendInfo = t24 ? classifyTrend(t24.deltaPct) : { symbol: '—', color: '#9ca3af', label: null };
      title = buildBadgeTitle(cardId, card);
      displayValue = formatNumber(price);
    } else if (state === 'nosales') {
      freshStyle = { bg: 'rgba(60,60,60,0.55)', border: 'rgba(120,120,120,0.65)' };
      trendInfo = { symbol: '?', color: '#9ca3af', label: null };
      displayValue = '—';
      title = [`Prix moyen${rarity ? ' • ' + rarity : ''} : aucune vente enregistrée`, '', 'Clic droit pour réessayer'].join('\n');
    } else if (state === 'blocked') {
      freshStyle = { bg: 'rgba(120,20,20,0.75)', border: 'rgba(200,50,50,0.9)' };
      trendInfo = { symbol: '✕', color: '#ffffff', label: 'blocked' };
      displayValue = '—';
      title = [`Prix moyen${rarity ? ' • ' + rarity : ''} : temporairement indisponible`, '', `Carte en cooldown (${CONFIG.FORBIDDEN_COOLDOWN_MS / 1000}s).`, 'Elle sera retentée automatiquement.'].join('\n');
    } else {
      freshStyle = { bg: 'rgba(220,38,38,0.55)', border: 'rgba(239,68,68,0.80)' };
      trendInfo = { symbol: '!', color: '#ffffff', label: 'error' };
      displayValue = '—';
      title = [`Prix moyen${rarity ? ' • ' + rarity : ''} : erreur de récupération`, '', 'Vérifie ta connexion, ou clic droit pour réessayer.'].join('\n');
    }
    if (existing && existing.querySelector('.wm-trend-symbol')) {
      const valueSpan = existing.querySelector('.wm-price-value');
      if (valueSpan) valueSpan.textContent = displayValue;
      const trendSpan = existing.querySelector('.wm-trend-symbol');
      if (trendSpan) {
        trendSpan.textContent = trendInfo.symbol;
        trendSpan.style.color = trendInfo.color;
        trendSpan.style.opacity = trendInfo.label ? '1' : '0.4';
      }
      existing.style.background = freshStyle.bg;
      existing.style.borderColor = freshStyle.border;
      existing.title = title;
      existing.dataset.state = state;
      return;
    }
    if (existing) existing.remove();
    row.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = 'wm-price-badge';
    badge.dataset.cardId = cardId;
    badge.dataset.state = state;
    badge.title = title;
    badge.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      z-index: 20; display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 8px; border-radius: 6px; color: #ffffff !important;
      font: 700 11px/1 system-ui, sans-serif; white-space: nowrap;
      pointer-events: auto; cursor: default;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      border: 1px solid ${freshStyle.border}; background: ${freshStyle.bg};
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;
    const trendSpan = document.createElement('span');
    trendSpan.className = 'wm-trend-symbol';
    trendSpan.textContent = trendInfo.symbol;
    trendSpan.style.cssText = `font: 800 12px/1 system-ui, sans-serif; color: ${trendInfo.color}; opacity: ${trendInfo.label ? '1' : '0.4'};`;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'wm-price-value';
    valueSpan.textContent = displayValue;
    badge.append(trendSpan, valueSpan);
    attachBadgeInteractions(badge, { cardId, card, rarity, isMarketplace: false });
    row.appendChild(badge);
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
    if (favorite) root.classList.add('wm-halo-favorite');
  };

  /* =========================================================
   *             REFRESH MANUEL
   * ========================================================= */
  const handleManualRefresh = async (cardId, root, card) => {
    const badge = root.querySelector(`.wm-price-badge[data-card-id="${cardId}"]`);
    if (!badge) return;
    badge.classList.add('wm-loading');
    badge.title = 'Actualisation en cours...';
    try {
      const rarity = card.card?.rarity || card.rarity;
      const hasPrice = await doForceRefresh(cardId, card, rarity);
      if (hasPrice) showPriceBadge(root, card, STATE.priceCache[cardId].price, 'ok');
      else showPriceBadge(root, card, null, 'nosales');
    } catch (e) {
      logErr('Refresh manuel échoué:', e);
      if (e?.status === 403) showPriceBadge(root, card, null, 'blocked');
      else showPriceBadge(root, card, null, 'error');
    } finally { badge.classList.remove('wm-loading'); }
  };

  /* =========================================================
   *             COLLECTION : scan (viewport-first)
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
    if (STATE.pageCardCache.has(pageNumber)) return STATE.pageCardCache.get(pageNumber);
    const apiPage = Math.max(0, pageNumber - 1);
    const data = await fetchJson(`/api/my-collection?sort=rarity&page=${apiPage}&stats=0`, { signal });
    const cards = data.collection || [];
    STATE.pageCardCache.set(pageNumber, cards);
    return cards;
  };

  const setupViewportObserver = () => {
    if (STATE.viewportObserver) return;
    STATE.viewportObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const root = entry.target;
        processRootForEnqueue(root);
        STATE.viewportObserver.unobserve(root);
        delete root.dataset.wmObserving;
      }
    }, {
      rootMargin: CONFIG.VIEWPORT_ROOT_MARGIN,
      threshold: 0.01
    });
  };

  const processRootForEnqueue = (root) => {
    if (!root.isConnected) return;
    if (root.dataset.wmEnqueued === '1') return;
    if (root.dataset.wmFetched === '1') return;

    const generation = STATE.collectionGeneration;
    let cardData = getCardDataFromFiberDeep(root);

    if (!cardData?.id && STATE.currentCollectionCards.length > 0) {
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
    }
    if (!cardData?.id) return;

    root.dataset.wmEnqueued = '1';
    enqueue(cardData, root, generation, 2);
  };

  const scanCurrentCollectionPage = () => {
    setupViewportObserver();
    const roots = getVisibleCardRoots();
    const margin = 200;

    for (const root of roots) {
      if (root.dataset.wmEnqueued === '1') continue;
      if (root.dataset.wmFetched === '1') continue;
      if (root.dataset.wmObserving === '1') continue;

      const rect = root.getBoundingClientRect();
      const inViewport = rect.bottom > -margin && rect.top < window.innerHeight + margin;

      if (inViewport) {
        processRootForEnqueue(root);
      } else {
        root.dataset.wmObserving = '1';
        STATE.viewportObserver.observe(root);
      }
    }
  };

  const switchCollectionPage = async (pageNumber) => {
    if (pageNumber === STATE.currentCollectionPage && STATE.currentCollectionCards.length) {
      scanCurrentCollectionPage();
      return;
    }
    STATE.currentCollectionPage = pageNumber;
    STATE.currentCollectionCards = [];
    STATE.collectionGeneration++;
    const generation = STATE.collectionGeneration;
    resetDispatcher();
    if (STATE.collectionLoadController) STATE.collectionLoadController.abort();
    STATE.collectionLoadController = new AbortController();
    try {
      const cards = await loadCollectionPage(pageNumber, STATE.collectionLoadController.signal);
      if (generation !== STATE.collectionGeneration || !location.pathname.startsWith('/collection')) return;
      STATE.currentCollectionCards = cards;
      scanCurrentCollectionPage();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      logErr(`Erreur page collection ${pageNumber}:`, error);
    }
  };

  const syncCollectionPage = () => {
    if (!location.pathname.startsWith('/collection')) return;
    const pageNumber = getCurrentCollectionPageNumber();
    if (pageNumber) {
      if (pageNumber !== STATE.currentCollectionPage) switchCollectionPage(pageNumber);
      else scanCurrentCollectionPage();
    } else {
      scanCurrentCollectionPage();
    }
  };

  const scheduleCollectionSync = (wait = null) => {
    clearTimeout(STATE.collectionSyncTimer);
    const actualWait = wait !== null ? wait : (isFilterActive() ? CONFIG.FILTER_DEBOUNCE_MS : 80);
    STATE.collectionSyncTimer = setTimeout(syncCollectionPage, actualWait);
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
    if (STATE.viewportObserver) {
      STATE.viewportObserver.disconnect();
      STATE.viewportObserver = null;
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

    document.querySelectorAll('[data-wm-enqueued]').forEach(el => { delete el.dataset.wmEnqueued; });
    document.querySelectorAll('[data-wm-observing]').forEach(el => { delete el.dataset.wmObserving; });
    document.querySelectorAll('[data-wm-fetched]').forEach(el => { delete el.dataset.wmFetched; });

    resetDispatcher();
  };

  const startCollectionMode = () => {
    STATE.collectionObserver = new MutationObserver(() => scheduleCollectionSync());
    STATE.collectionObserver.observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['fill', 'data-state', 'aria-pressed']
    });
    STATE.collectionClickHandler = () => {
      scheduleCollectionSync();
      setTimeout(() => scheduleCollectionSync(0), 300);
    };
    document.addEventListener('click', STATE.collectionClickHandler, true);
    scheduleCollectionSync(0);
    startDispatcher();
  };

  /* =========================================================
   *             PULLS (paquets)
   * ========================================================= */
  const scanPullsCards = () => {
    if (location.pathname !== '/pulls') return;
    const cards = FETCH_INTERCEPT.lastPackCards;
    if (!Array.isArray(cards) || cards.length === 0) return;
    const roots = getPackCardRoots();
    if (roots.length === 0) return;
    for (const root of roots) {
      const titleEl = root.querySelector('h3');
      if (!titleEl) continue;
      const title = (titleEl.textContent || '').trim();
      if (!title) continue;
      const apiCard = cards.find(c => (c.wikipedia_title || '').trim() === title);
      if (!apiCard) continue;
      const cardId = apiCard.id;
      const rarity = apiCard.rarity;
      const row = getStatsRow(root);
      if (!row) continue;
      const selector = `.wm-price-badge[data-card-id="${cardId}"]`;
      if (row.querySelector(selector)) continue;
      if (isCardCoolingDown(cardId)) {
        showPriceBadge(root, { card_id: cardId, rarity, card: apiCard }, null, 'blocked');
        continue;
      }
      if (STATE.pullsFetched.has(cardId)) {
        const cached = getCachedPrice(cardId);
        if (cached) {
          if (typeof cached.price === 'number') showPriceBadge(root, { card_id: cardId, rarity, card: apiCard }, cached.price, 'ok');
          else if (cached.noSales) showPriceBadge(root, { card_id: cardId, rarity, card: apiCard }, null, 'nosales');
        }
        continue;
      }
      if (STATE.pullsInFlight.has(cardId)) continue;
      STATE.pullsInFlight.add(cardId);
      const cardForBadge = { card_id: cardId, rarity, card: apiCard };
      fetchPriceForCard(cardId, rarity, { title }).then(avg => {
        STATE.pullsInFlight.delete(cardId);
        STATE.pullsFetched.add(cardId);
        if (!root.isConnected) return;
        if (typeof avg === 'number') showPriceBadge(root, cardForBadge, avg, 'ok');
        else if (avg === null) showPriceBadge(root, cardForBadge, null, 'nosales');
        else if (isCardCoolingDown(cardId)) showPriceBadge(root, cardForBadge, null, 'blocked');
        else showPriceBadge(root, cardForBadge, null, 'error');
      }).catch(() => { STATE.pullsInFlight.delete(cardId); });
    }
  };

  const schedulePullsSync = (wait = 80) => {
    clearTimeout(STATE.pullsSyncTimer);
    STATE.pullsSyncTimer = setTimeout(scanPullsCards, wait);
  };

  const cleanupPullsMode = () => {
    clearTimeout(STATE.pullsSyncTimer);
    STATE.pullsSyncTimer = null;
    if (STATE.pullsInterval) { clearInterval(STATE.pullsInterval); STATE.pullsInterval = null; }
    if (STATE.pullsObserver) { STATE.pullsObserver.disconnect(); STATE.pullsObserver = null; }
    STATE.pullsGeneration++;
    STATE.pullsFetched.clear();
    STATE.pullsInFlight.clear();
    document.querySelectorAll('.animate-card-flip .wm-price-badge').forEach(el => el.remove());
  };

  const startPullsMode = () => {
    schedulePullsSync(0);
    if (STATE.pullsInterval) clearInterval(STATE.pullsInterval);
    let elapsed = 0;
    STATE.pullsInterval = setInterval(() => {
      elapsed += 500;
      scanPullsCards();
      if (elapsed >= 30000) { clearInterval(STATE.pullsInterval); STATE.pullsInterval = null; }
    }, 500);
    STATE.pullsObserver = new MutationObserver(() => schedulePullsSync(80));
    STATE.pullsObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  };

  /* =========================================================
   *             MARKETPLACE LIST
   * ========================================================= */
  const cleanupMarketplaceListMode = () => {
    clearTimeout(STATE.marketplaceListEnsureTimer);
    STATE.marketplaceListEnsureTimer = null;
    if (STATE.marketplaceListObserver) { STATE.marketplaceListObserver.disconnect(); STATE.marketplaceListObserver = null; }
    if (STATE.marketplaceListController) { STATE.marketplaceListController.abort(); STATE.marketplaceListController = null; }
    STATE.marketplaceListAuctions = null;
    STATE.marketplaceListPending = [];
    STATE.marketplaceListProcessing = false;
    document.querySelectorAll('.wm-market-list-badge').forEach(el => el.remove());
    document.querySelectorAll('[id^="marketplace-auction-"][data-wm-list-processed]').forEach(el => { delete el.dataset.wmListProcessed; });
  };

  const renderMarketplaceListBadge = (item, auction, average, currentBid, rarity) => {
    const cardId = auction.card_id;
    const hasSales = typeof average === 'number';
    let freshStyle, trendInfo, title;
    if (hasSales) {
      const entry = STATE.priceCache[cardId];
      const age = entry ? (Date.now() - entry.timestamp) : 0;
      freshStyle = getFreshnessStyle(age);
      const t24 = getTrend(cardId, CONFIG.TREND_WINDOWS.d1);
      trendInfo = t24 ? classifyTrend(t24.deltaPct) : { symbol: '—', color: '#d1d5db', label: null };
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
        comparisonText, '',
        `Actualisé : ${dateStr} à ${timeStr} (${formatAge(age)})`
      ];
      if (t24) {
        const sign = t24.deltaPct >= 0 ? '+' : '';
        titleLines.push(`Tendance 24h : ${trendInfo.symbol} ${sign}${t24.deltaPct.toFixed(1)} %`);
      } else titleLines.push(`Tendance 24h : — (données insuffisantes)`);
      titleLines.push(''); titleLines.push('Clic droit pour actualiser');
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
        `Mise actuelle : ${formatNumber(currentBid)}`, '', lastTryLine, 'Clic droit pour réessayer'
      ].join('\n');
    }
    const existing = item.querySelector('.wm-market-list-badge');
    if (existing) {
      const valueSpan = existing.querySelector('.wm-market-list-value');
      if (valueSpan) valueSpan.textContent = hasSales ? formatNumber(average) : '—';
      const trendSpan = existing.querySelector('.wm-trend-symbol');
      if (trendSpan) { trendSpan.textContent = trendInfo.symbol; trendSpan.style.color = trendInfo.color; trendSpan.style.opacity = trendInfo.label ? '1' : '0.4'; }
      existing.style.background = freshStyle.bg;
      existing.style.borderColor = freshStyle.border;
      existing.title = title;
      return;
    }
    const badge = document.createElement('span');
    badge.className = 'wm-market-list-badge';
    badge.title = title;
    badge.dataset.cardId = cardId;
    badge.dataset.rarity = rarity || '';
    badge.style.cssText = `
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
      margin: 4px auto 0; border-radius: 6px; color: #ffffff !important;
      font: 700 11px/1 system-ui, sans-serif; white-space: nowrap;
      pointer-events: auto; cursor: default;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      border: 1px solid ${freshStyle.border}; background: ${freshStyle.bg};
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;
    const trendSpan = document.createElement('span');
    trendSpan.className = 'wm-trend-symbol';
    trendSpan.textContent = trendInfo.symbol;
    trendSpan.style.cssText = `font: 800 12px/1 system-ui, sans-serif; color: ${trendInfo.color}; opacity: ${trendInfo.label ? '1' : '0.4'};`;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'wm-market-list-value';
    valueSpan.textContent = hasSales ? formatNumber(average) : '—';
    badge.append(trendSpan, valueSpan);
    const onRefreshDone = (hasPrice) => {
      const newAvg = hasPrice ? STATE.priceCache[cardId]?.price : null;
      if (typeof newAvg === 'number') {
        delete STATE.noSalesRefresh[cardId];
        renderMarketplaceListBadge(item, auction, newAvg, currentBid, rarity);
      } else {
        STATE.noSalesRefresh[cardId] = Date.now();
        renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
      }
    };
    attachBadgeInteractions(badge, { cardId, card: { card_id: cardId, rarity }, rarity, isMarketplace: true, onRefreshDone });
    const priceRow = item.querySelector('.w-full.flex.items-center.justify-between.gap-2.text-xs');
    if (priceRow && priceRow.parentElement) priceRow.parentElement.insertBefore(badge, priceRow.nextSibling);
    else {
      const sellerLine = item.querySelector('p.truncate');
      if (sellerLine) sellerLine.parentElement.insertBefore(badge, sellerLine);
      else {
        const flexCol = item.querySelector('.flex.flex-col.items-center.gap-2\\.5');
        if (flexCol) flexCol.appendChild(badge);
      }
    }
  };

  const processMarketplaceListPending = async () => {
    if (STATE.marketplaceListProcessing) return;
    STATE.marketplaceListProcessing = true;
    while (STATE.marketplaceListPending.length > 0) {
      const task = STATE.marketplaceListPending.shift();
      const { item, auction, cardId, rarity, currentBid } = task;
      if (!item.isConnected) continue;
      if (isCardCoolingDown(cardId)) {
        renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
        item.dataset.wmListProcessed = 'blocked';
        continue;
      }
      try {
        const data = await fetchJson(`/api/marketplace/cards/${cardId}/sales?scope=summary`);
        const average = data?.summary?.[rarity]?.average
          ?? Object.values(data?.summary || {})[0]?.average;
        if (typeof average === 'number') {
          setCachedPrice(cardId, average);
          renderMarketplaceListBadge(item, auction, average, currentBid, rarity);
        } else {
          setCachedNoSales(cardId);
          renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
        }
        item.dataset.wmListProcessed = 'done';
      } catch (e) {
        if (e.status === 403) {
          markCardForbidden(cardId, auction.card?.wikipedia_title || cardId.substring(0, 8));
          renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
          item.dataset.wmListProcessed = 'blocked';
        } else if (e.status === 429) {
          rateLimitCount++;
          updateVersionBadgeLabel();
          STATE.marketplaceListPending.unshift(task);
          item.dataset.wmListProcessed = 'pending';
        } else {
          item.dataset.wmListProcessed = 'error';
        }
      }
      await sleep(250);
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
      if (isCardCoolingDown(cardId)) {
        renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
        item.dataset.wmListProcessed = 'blocked';
        continue;
      }
      const cached = getCachedPrice(cardId);
      if (cached) {
        if (typeof cached.price === 'number') renderMarketplaceListBadge(item, auction, cached.price, currentBid, rarity);
        else if (cached.noSales) renderMarketplaceListBadge(item, auction, null, currentBid, rarity);
        item.dataset.wmListProcessed = 'done';
        const age = Date.now() - cached.timestamp;
        if (age > CONFIG.CACHE_REFRESH_AGE) refreshPriceInBackground(cardId, rarity);
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
    apiParams.set('page', '1'); apiParams.set('limit', '50'); apiParams.set('sort', 'recent');
    if (currentQ) apiParams.set('q', currentQ);
    const apiUrl = '/api/marketplace?' + apiParams.toString();
    try {
      const data = await fetchJson(apiUrl, { signal });
      if (signal.aborted) return;
      STATE.marketplaceListAuctions = data?.auctions || [];
    } catch (e) {
      if (e?.name === 'AbortError') return;
      logErr('Marketplace list fetch failed:', e);
      return;
    }
    STATE.marketplaceListObserver = new MutationObserver(() => {
      scheduleMarketplaceListEnsure(80);
      refreshMarketplaceListIfSearchChanged();
    });
    STATE.marketplaceListObserver.observe(document.body, { childList: true, subtree: true });
    scheduleMarketplaceListEnsure(0);
  };

  /* =========================================================
   *             MARKETPLACE DÉTAIL
   * ========================================================= */
  const findAuctionInfoPanel = () => {
    for (const panel of document.querySelectorAll('.card-frame')) {
      const text = (panel.innerText || '').replace(/\s+/g, ' ').trim();
      if (/MISE ACTUELLE|MISE DE D[ÉE]PART/i.test(text) && /Temps restant/i.test(text)) return panel;
    }
    for (const element of document.querySelectorAll('div')) {
      const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
      if (!/MISE ACTUELLE|MISE DE D[ÉE]PART/i.test(text) || !/Temps restant/i.test(text)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width >= 300 && rect.height >= 80 && rect.height <= 300) return element;
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

  const findBidButton = () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Miser') || null;
  const isSellerView = () => {
    const text = document.body.innerText || '';
    return text.includes('Vous vendez cette carte') || text.includes('Elle est réservée pour la durée');
  };

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
    Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '5px' });
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
    Object.assign(value.style, { color: 'var(--color-accent)', fontWeight: '800' });
    line.append(createWikibidouIcon(14, 'var(--color-accent)'), label, value);
    wrapper.appendChild(line);
    return true;
  };

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
    Object.assign(averageBlock.style, { display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db' });
    const averageText = document.createElement('span');
    averageText.append(document.createTextNode('Prix moyen '), document.createTextNode(formatNumber(average)));
    averageBlock.append(createWikibidouIcon(16, '#34d399'), averageText);
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
    if (bidRow && bidRow !== panel) panel.insertBefore(comparison, bidRow);
    else panel.appendChild(comparison);
    input?.addEventListener('input', updateDifference);
    updateDifference();
    return true;
  };

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

  const cleanupMarketplaceMode = () => {
    clearTimeout(STATE.marketplaceEnsureTimer);
    STATE.marketplaceEnsureTimer = null;
    if (STATE.marketplaceObserver) { STATE.marketplaceObserver.disconnect(); STATE.marketplaceObserver = null; }
    if (STATE.marketplaceController) { STATE.marketplaceController.abort(); STATE.marketplaceController = null; }
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
    STATE.marketplaceObserver = new MutationObserver(() => scheduleMarketplaceEnsure(80));
    STATE.marketplaceObserver.observe(document.body, { childList: true, subtree: true });
    try {
      const listingData = await fetchJson(`/api/marketplace/${listingId}`, { signal });
      if (signal.aborted || localGeneration !== STATE.routeGeneration || location.pathname !== pathname) return;
      const auction = listingData?.auction;
      if (!auction?.card_id || !auction?.card?.rarity) return;
      let average = getCachedPrice(auction.card_id)?.price;
      if (typeof average !== 'number') {
        const salesData = await fetchJson(`/api/marketplace/cards/${auction.card_id}/sales?scope=summary`, { signal });
        if (signal.aborted || localGeneration !== STATE.routeGeneration || location.pathname !== pathname) return;
        average = salesData?.summary?.[auction.card.rarity]?.average
          ?? Object.values(salesData?.summary || {})[0]?.average;
        if (typeof average === 'number') setCachedPrice(auction.card_id, average);
      }
      if (typeof average !== 'number') return;
      STATE.marketplaceContext = { listingId, auction, average };
      scheduleMarketplaceEnsure(0);
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  };

  /* =========================================================
   *             ROUTING SPA
   * ========================================================= */
  const cleanupCurrentMode = () => {
    cleanupCollectionMode();
    cleanupPullsMode();
    cleanupMarketplaceMode();
    cleanupMarketplaceListMode();
    closeMobilePopup();
  };

  const getRouteKind = (pathname) => {
    if (pathname.startsWith('/collection')) return 'collection';
    if (pathname === '/pulls' || pathname.startsWith('/pulls/')) return 'pulls';
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
    resetDispatcher();
    cleanupCurrentMode();
    if (!/^\/marketplace\/?$/.test(pathname)) FETCH_INTERCEPT.lastMarketplaceQ = null;
    const kind = getRouteKind(pathname);
    if (kind === 'collection') return startCollectionMode();
    if (kind === 'pulls') return startPullsMode();
    if (kind === 'marketplace-list') return startMarketplaceListMode();
    if (kind === 'marketplace') return startMarketplaceMode(pathname);
  };

  const scheduleRouteCheck = (wait = 0) => {
    clearTimeout(STATE.routeCheckTimer);
    STATE.routeCheckTimer = setTimeout(() => handleRouteChange(false), wait);
  };

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
    if (location.pathname !== STATE.currentRoute) scheduleRouteCheck(0);
  });
  routeObserver.observe(document.documentElement, { childList: true, subtree: true });

  /* =========================================================
   *             INITIALISATION
   * ========================================================= */
  const init = () => {
    STATE.priceCache = loadCache();
    log('Init — v' + VERSION + ' | cache : ' + Object.keys(STATE.priceCache).length + ' cartes');
    injectStyles();
    injectVersionBadge();
    handleRouteChange(true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
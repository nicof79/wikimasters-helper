// ─────────────────────────────────────────────────────────────
// Wikimasters Helper — Outil console
// Voir tools/README.md pour l'usage.
// À coller dans la console DevTools (F12) sur une page wiki-masters.com.
// ─────────────────────────────────────────────────────────────
(() => {
  const KEY = 'wikimasters-helper-cache';
  const raw = localStorage.getItem(KEY);
  if (!raw) { console.log('ℹ️  Cache vide.'); return; }

  const parsed = JSON.parse(raw);
  const prices = parsed.prices || {};
  const ids = Object.keys(prices);

  const now = Date.now();
  const ages = ids.map(id => now - (prices[id].timestamp || now));
  const avgAge = ages.reduce((a, b) => a + b, 0) / (ages.length || 1);
  const oldest = Math.max(...ages);
  const newest = Math.min(...ages);

  const withHistory = ids.filter(id => Array.isArray(prices[id].history) && prices[id].history.length > 1).length;
  const totalHistoryPoints = ids.reduce((sum, id) => sum + (prices[id].history?.length || 0), 0);

  const sizeKB = (raw.length / 1024).toFixed(1);
  const expiresIn = parsed.expiresAt ? ((parsed.expiresAt - now) / (60 * 1000)).toFixed(0) : '?';

  console.log('=== Wikimasters Helper — Stats cache ===');
  console.log(`Cartes en cache        : ${ids.length}`);
  console.log(`Taille totale          : ${sizeKB} Ko`);
  console.log(`Expire dans            : ${expiresIn} min`);
  console.log(`Cartes avec historique : ${withHistory} (${totalHistoryPoints} points au total)`);
  console.log(`Âge moyen des prix     : ${(avgAge / 3600000).toFixed(1)} h`);
  console.log(`Plus vieux prix        : ${(oldest / 3600000).toFixed(1)} h`);
  console.log(`Plus récent prix       : ${(newest / 60000).toFixed(0)} min`);
})();
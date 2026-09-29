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

  if (ids.length === 0) { console.log('ℹ️  Aucune carte.'); return; }

  if (!confirm(`Réinitialiser l'historique des tendances pour ${ids.length} cartes ? Les prix actuels seront conservés.`)) {
    console.log('Annulé.');
    return;
  }

  let count = 0;
  for (const id of ids) {
    const e = prices[id];
    if (e && typeof e.price === 'number' && typeof e.timestamp === 'number') {
      e.history = [{ price: e.price, timestamp: e.timestamp }];
      count++;
    }
  }

  localStorage.setItem(KEY, JSON.stringify(parsed));
  console.log(`✅ Historique réinitialisé pour ${count} cartes. Recharge la page.`);
})();
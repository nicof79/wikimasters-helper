// ─────────────────────────────────────────────────────────────
// Wikimasters Helper — Outil console
// Voir tools/README.md pour l'usage.
// À coller dans la console DevTools (F12) sur une page wiki-masters.com.
// ─────────────────────────────────────────────────────────────
(() => {
  const KEY = 'wikimasters-helper-cache';
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    console.log('ℹ️  Aucun cache à supprimer.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const count = parsed?.prices ? Object.keys(parsed.prices).length : 0;

    if (!confirm(`Supprimer le cache (${count} cartes) ? Action irréversible.`)) {
      console.log('Annulé.');
      return;
    }

    localStorage.removeItem(KEY);
    console.log(`✅ Cache supprimé (${count} cartes).`);
  } catch (e) {
    console.error('❌ Erreur :', e);
  }
})();
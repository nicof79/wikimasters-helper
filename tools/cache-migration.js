// ─────────────────────────────────────────────────────────────
// Wikimasters Helper — Outil console
// Voir tools/README.md pour l'usage.
// À coller dans la console DevTools (F12) sur une page wiki-masters.com.
// ─────────────────────────────────────────────────────────────

// One-shot : migration du cache v1.2.7 → v1.2.9. Ne devrait plus servir après.
// Si tu arrives sur ce projet après la v1.2.9, tu n'en as pas besoin.

(() => {
  const OLD_KEY = 'wm-price-helper-v2';
  const NEW_KEY = 'wikimasters-helper-cache';

  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) {
    console.log('❌ Aucun cache trouvé sous l\'ancienne clé. Rien à migrer.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.prices) {
      console.log('⚠️  Structure inattendue. Migration annulée.');
      return;
    }

    const count = Object.keys(parsed.prices).length;

    if (localStorage.getItem(NEW_KEY)) {
      if (!confirm(`La nouvelle clé existe déjà. Écraser son contenu par ${count} cartes de l'ancienne ?`)) {
        console.log('Annulé.');
        return;
      }
    }

    localStorage.setItem(NEW_KEY, raw);
    localStorage.removeItem(OLD_KEY);
    console.log(`✅ Migration réussie : ${count} cartes copiées et ancienne clé supprimée.`);
  } catch (e) {
    console.error('❌ Erreur :', e);
  }
})();
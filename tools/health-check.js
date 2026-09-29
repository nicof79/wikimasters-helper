// ─────────────────────────────────────────────────────────────
// Wikimasters Helper — Outil console
// Voir tools/README.md pour l'usage.
// À coller dans la console DevTools (F12) sur une page wiki-masters.com.
// ─────────────────────────────────────────────────────────────

(() => {
  console.log('=== Wikimasters Helper — Check de santé ===\n');

  // 1. Version du script
  const versionBadge = document.querySelector('.wm-version-badge');
  console.log('1. Badge version    :', versionBadge ? versionBadge.textContent : '❌ ABSENT');

  // 2. CSS injecté
  const cssOk = [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => r.selectorText?.includes('wm-halo')); }
    catch { return false; }
  });
  console.log('2. CSS injecté      :', cssOk ? '✅' : '❌ ABSENT');

  // 3. Cache
  const raw = localStorage.getItem('wikimasters-helper-cache');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const count = Object.keys(parsed.prices || {}).length;
      console.log('3. Cache            : ✅ ' + count + ' cartes');
      console.log('   Taille           : ' + (raw.length / 1024).toFixed(1) + ' Ko');
      console.log('   Expire dans      : ' + Math.round((parsed.expiresAt - Date.now()) / 60000) + ' min');
    } catch (e) {
      console.log('3. Cache            : ❌ Corrompu (' + e.message + ')');
    }
  } else {
    console.log('3. Cache            : ⚠️  Vide (normal si première visite)');
  }

  // 4. Badges injectés
  const priceBadges = document.querySelectorAll('.wm-price-badge').length;
  const marketBadges = document.querySelectorAll('.wm-market-list-badge').length;
  const comparison = document.querySelectorAll('.wm-market-comparison').length;
  console.log('4. Badges prix      : ' + priceBadges + ' (collection)');
  console.log('   Badges marché    : ' + marketBadges + ' (marketplace liste)');
  console.log('   Comparateurs     : ' + comparison + ' (marketplace détail)');

  // 5. Halos
  const halosFav = document.querySelectorAll('.wm-halo-favorite').length;
  const halosTag = document.querySelectorAll('.wm-halo-tag').length;
  console.log('5. Halos favoris    : ' + halosFav);
  console.log('   Halos tags       : ' + halosTag);

  // 6. Erreurs visibles dans le DOM
  const errors = document.querySelectorAll('[data-wm-list-processed="error"]');
  console.log('6. Erreurs de fetch : ' + errors.length + (errors.length > 0 ? ' ⚠️' : ''));

    // 6bis. Badges par état
  const badgesOk = document.querySelectorAll('.wm-price-badge[data-state="ok"]').length;
  const badgesNoSales = document.querySelectorAll('.wm-price-badge[data-state="nosales"]').length;
  const badgesError = document.querySelectorAll('.wm-price-badge[data-state="error"]').length;
  console.log('   Badges prix OK   : ' + badgesOk);
  console.log('   Badges sans vente: ' + badgesNoSales);
  console.log('   Badges en erreur : ' + badgesError + (badgesError > 0 ? ' ⚠️' : ''));

  // 7. Route actuelle
  console.log('7. Route            : ' + location.pathname);

  console.log('\n=== Fin du check ===');
})();
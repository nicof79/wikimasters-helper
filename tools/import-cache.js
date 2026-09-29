// ─────────────────────────────────────────────────────────────
// Wikimasters Helper — Outil console
// Voir tools/README.md pour l'usage.
// À coller dans la console DevTools (F12) sur une page wiki-masters.com.
// ─────────────────────────────────────────────────────────────
(() => {
  const KEY = 'wikimasters-helper-cache';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed || !parsed.prices) {
          console.log('⚠️  Fichier invalide.');
          return;
        }

        const count = Object.keys(parsed.prices).length;

        if (localStorage.getItem(KEY) && !confirm(`Écraser le cache actuel par ${count} cartes ?`)) {
          console.log('Annulé.');
          return;
        }

        localStorage.setItem(KEY, ev.target.result);
        console.log(`✅ Import réussi (${count} cartes). Recharge la page.`);
      } catch (err) {
        console.error('❌ Erreur :', err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
})();
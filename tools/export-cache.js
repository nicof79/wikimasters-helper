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
  const count = Object.keys(parsed.prices || {}).length;

  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `wikimasters-helper-cache-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`✅ Export lancé (${count} cartes).`);
})();
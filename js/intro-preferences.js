// Guarda se a introdução já foi vista (localStorage 'ej-intro') e o idioma ('ej-lang', o mesmo do i18n.js).
// "Ouvir o guia ao entrar" vale uma vez: fica em sessionStorage e o a11y.js consome ao abrir o site.
window.EJ = window.EJ || {};
EJ.introPreferences = (() => {
  const key = 'ej-intro';
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return { completed: value?.completed === true && ['pt', 'en'].includes(localStorage.getItem('ej-lang')), guide: value?.guide === true };
    } catch { return { completed: false, guide: false }; }
  }
  function complete(language, guide) {
    if (!['pt', 'en'].includes(language)) return false;
    try {
      localStorage.setItem('ej-lang', language);
      localStorage.setItem(key, JSON.stringify({ completed: true, guide: !!guide }));
      sessionStorage.setItem('ej-intro-pass', '1');              // index.html abre o site uma vez sem voltar aqui
      if (guide) sessionStorage.setItem('ej-guide-once', 'true');
      else sessionStorage.removeItem('ej-guide-once');
    } catch { /* Navigation remains available when storage is blocked. */ }
    return true;
  }
  return { read, complete };
})();
/* Progressive enhancement for the project documentation. No network or account access. */
(() => {
  const toggle = document.querySelector('.ps-nav-toggle');
  const navigation = document.querySelector('.ps-nav-links');
  toggle?.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    navigation.classList.toggle('is-open', expanded);
  });
  navigation?.addEventListener('click', event => {
    if (event.target.closest('a')) {
      navigation.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const text = document.getElementById(button.dataset.copy).textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById(button.dataset.copy));
        const selection = window.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        button.textContent = 'Selected';
      }
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    });
  });
})();

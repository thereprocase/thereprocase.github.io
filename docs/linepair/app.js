const letterCase = document.querySelector('#letter-case');
const polarity = document.querySelector('#polarity');
const study = document.querySelector('#size-study');
const updateSizeLabels = () => {
  for (const row of study.children) {
    const size = parseFloat(getComputedStyle(row.querySelector('.size-word')).fontSize);
    row.querySelector('.size-note').textContent = `${Math.round(size * 10) / 10} PX`;
  }
};
new ResizeObserver(updateSizeLabels).observe(study);
updateSizeLabels();
letterCase.addEventListener('change', () => {
  for (const word of study.querySelectorAll('.size-word')) word.textContent = letterCase.value;
});
polarity.addEventListener('click', () => {
  const reversed = study.classList.toggle('reversed');
  polarity.setAttribute('aria-pressed', String(reversed));
});

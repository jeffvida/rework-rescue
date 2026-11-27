// Hero (27 Nov): "Imagine your [word] running smoothly." All words sit stacked in one grid cell, so the box is always
// as wide and tall as the longest word and nothing around it moves. One word is shown at a time with a slow fade.
// Pauses while the hero is off screen, while hovered and while the tab is hidden. With reduced motion (or without
// JavaScript) the first word, "enquiries", simply stays.

export function mountImagineRotate() {
  const box = document.querySelector('[data-rri-rotate]');
  if (!box) return;
  const words = [...box.children];
  if (words.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let i = 0;
  let onScreen = true;
  let hovered = false;
  const fig = box.closest('figure') || box;
  fig.addEventListener('mouseenter', () => { hovered = true; });
  fig.addEventListener('mouseleave', () => { hovered = false; });
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }).observe(fig);
  }
  setInterval(() => {
    if (!onScreen || hovered || document.hidden) return;
    words[i].classList.remove('is-on');
    i = (i + 1) % words.length;
    words[i].classList.add('is-on');
  }, 3500);
}

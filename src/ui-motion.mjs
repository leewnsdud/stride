let pointerInput = false;
export function trackInputModality() {
  const pointer = () => { pointerInput = true; document.documentElement.dataset.input = "pointer"; };
  const keyboard = () => { pointerInput = false; document.documentElement.dataset.input = "keyboard"; };
  document.addEventListener('pointerdown', pointer, true);
  document.addEventListener('keydown', keyboard, true);
  return () => {
    document.removeEventListener('pointerdown', pointer, true);
    document.removeEventListener('keydown', keyboard, true);
  };
}
export function allowUiMotion() {
  return pointerInput && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export const uiEase = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function reveal(element, { duration = 160, offset = 0 } = {}) {
  if (!element) return;
  const running = element.getAnimations();
  const current = running.length ? getComputedStyle(element) : null;
  const from = current ? { opacity:current.opacity, transform:current.transform } : { opacity:.35, transform:`translateX(${offset}px)` };
  running.forEach(animation => animation.cancel());
  if (!allowUiMotion()) return;
  return element.animate([from,{opacity:1,transform:'none'}], {duration,easing:uiEase});
}

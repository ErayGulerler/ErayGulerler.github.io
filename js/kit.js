// Small helpers shared by the instruments on the page. No libraries.
const SVG_NS = 'http://www.w3.org/2000/svg';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  return fill(node, attrs, kids);
}
export function svg(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(SVG_NS, tag);
  return fill(node, attrs, kids);
}
function fill(node, attrs, kids) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.setAttribute('class', value);
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const kid of kids.flat()) if (kid != null) node.append(kid);
  return node;
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = t => 1 - (1 - t) ** 3;

// Run draw(t) with t from 0 to 1. Returns a function that cancels it.
export function tween(ms, draw, ease = easeInOut) {
  if (reducedMotion() || ms <= 0) { draw(1); return () => {}; }
  let frame;
  const begin = performance.now();
  const step = now => {
    const t = clamp((now - begin) / ms, 0, 1);
    draw(ease(t));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

// A requestAnimationFrame loop that only runs while the element is on screen and the tab is visible.
export function whileVisible(element, tick) {
  let frame = 0, last = 0, seen = false;
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    tick(dt, now);
    frame = requestAnimationFrame(step);
  };
  const update = () => {
    const run = seen && !document.hidden;
    if (run && !frame) { last = performance.now(); frame = requestAnimationFrame(step); }
    if (!run && frame) { cancelAnimationFrame(frame); frame = 0; }
  };
  new IntersectionObserver(entries => { seen = entries.at(-1).isIntersecting; update(); }).observe(element);
  document.addEventListener('visibilitychange', update);
}

export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export function onThemeChange(run) {
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
}
export const group = n => n.toLocaleString('en-US');

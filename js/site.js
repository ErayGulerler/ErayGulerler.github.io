// Everything the pages share: the theme switch, two keyboard shortcuts, the rail of hops,
// slider fills, the Warsaw clock, and lazy loading for the figures. Each figure is a module in this folder.
import { paintRange } from './kit.js';

const root = document.documentElement;
const dark = matchMedia('(prefers-color-scheme: dark)');

function mode() { return root.dataset.theme || (dark.matches ? 'dark' : 'light'); }
function reflect() {
  root.dataset.mode = mode();
  const button = document.querySelector('.theme');
  if (button) button.setAttribute('aria-label', mode() === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
}
dark.addEventListener('change', reflect);
reflect();

document.querySelector('.theme')?.addEventListener('click', event => {
  const next = mode() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    reflect();
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || still) return apply();
  const box = event.currentTarget.getBoundingClientRect();
  root.style.setProperty('--wx', box.left + box.width / 2 + 'px');
  root.style.setProperty('--wy', box.top + box.height / 2 + 'px');
  root.classList.add('theme-wipe');
  document.startViewTransition(apply).finished.finally(() => root.classList.remove('theme-wipe'));
});

const instruments = {
  topology: () => import('./topology.js'),
  ray: () => import('./ray.js'),
  ladder: () => import('./ladder.js'),
  replay: () => import('./ladder.js'),
  fraud: () => import('./fraud.js'),
  matrix: () => import('./small.js'),
  gate: () => import('./small.js'),
  schedule: () => import('./small.js'),
  parcel: () => import('./small.js'),
};
const watcher = new IntersectionObserver((entries, self) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    self.unobserve(entry.target);
    const name = entry.target.dataset.instrument;
    instruments[name]().then(module => module[name](entry.target)).catch(error => {
      console.error(error);
      entry.target.querySelector('.fallback')?.removeAttribute('hidden');
    });
  }
}, { rootMargin: '500px 0px' });
for (const figure of document.querySelectorAll('[data-instrument]')) watcher.observe(figure);

// Sliders: keep the filled part of the track in step with the thumb.
for (const input of document.querySelectorAll('input[type="range"]')) {
  paintRange(input);
  input.addEventListener('input', () => paintRange(input));
}

// Segmented controls: one thumb slides to whichever option is checked.
for (const seg of document.querySelectorAll('.seg')) {
  const place = () => {
    const label = seg.querySelector('label:has(input:checked)');
    if (!label) return;
    seg.style.setProperty('--x', label.offsetLeft + 'px');
    seg.style.setProperty('--w', label.offsetWidth + 'px');
    seg.dataset.thumb = '';
  };
  seg.addEventListener('change', place);
  new ResizeObserver(place).observe(seg);
}

// Two keys work anywhere outside a text field: / goes to the router prompt, t switches the theme.
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea, select')) return;
  const prompt = document.querySelector('#cli-input');
  if (event.key === '/' && prompt) {
    event.preventDefault();
    prompt.focus({ preventScroll: true });
    prompt.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  if (event.key === 't') document.querySelector('.theme')?.click();
});

// The rail of hops: mark the section being read, and move the packet between hops with the scroll.
const rail = document.querySelector('.hops');
if (rail) {
  const hops = [...rail.querySelectorAll('a')].map(link => ({ link, section: document.querySelector(link.getAttribute('href')) }));
  const packet = rail.querySelector('.hop-packet');
  let queued = false;
  const place = () => {
    queued = false;
    const line = scrollY + innerHeight * .4;
    const tops = hops.map(hop => hop.section.getBoundingClientRect().top + scrollY);
    tops[0] = innerHeight * .4;   // so the packet rests on the first hop at the top of the page
    let here = 0;
    while (here < hops.length - 1 && tops[here + 1] <= line) here++;
    if (innerHeight + scrollY >= root.scrollHeight - 2) here = hops.length - 1;
    const next = Math.min(here + 1, hops.length - 1);
    const share = next === here ? 0 : Math.min(1, Math.max(0, (line - tops[here]) / (tops[next] - tops[here])));
    const from = hops[here].link.offsetTop, to = hops[next].link.offsetTop;
    packet.style.setProperty('--y', from + (to - from) * share + 'px');
    hops.forEach((hop, i) => (i === here ? hop.link.setAttribute('aria-current', 'true') : hop.link.removeAttribute('aria-current')));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  place();
}

// Figures load as they scroll into view and some change height, so a jump to a section
// can land short. When the scrolling stops, check the target and go again if it moved.
let target = null;
addEventListener('click', event => {
  const link = event.target.closest?.('a[href^="#"]');
  target = link && document.querySelector(link.getAttribute('href'));
});
for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, () => { target = null; }, { passive: true });
addEventListener('scrollend', () => {
  if (!target) return;
  const off = target.getBoundingClientRect().top - parseFloat(getComputedStyle(root).scrollPaddingTop);
  const atEnd = innerHeight + scrollY >= root.scrollHeight - 2;
  if (Math.abs(off) > 4 && !(off > 0 && atEnd)) target.scrollIntoView();
  else target = null;
});

// The footer says what time it is where I am.
const clock = document.querySelector('footer .clock');
if (clock) {
  const warsaw = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.querySelector('time').textContent = warsaw.format(new Date()); };
  tick();
  setInterval(tick, 20000);
  clock.hidden = false;
}

console.log('%cHello. Nothing here is minified, so view source works. https://github.com/ErayGulerler/ErayGulerler.github.io', 'font: 600 13px ui-monospace, monospace');

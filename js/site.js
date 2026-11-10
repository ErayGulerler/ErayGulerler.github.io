// Theme switch and lazy loading for the instruments. Each one is a module in this folder.
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

console.log('%cHello. Nothing here is minified, so view source works. https://github.com/ErayGulerler/ErayGulerler.github.io', 'font: 600 13px ui-monospace, monospace');
